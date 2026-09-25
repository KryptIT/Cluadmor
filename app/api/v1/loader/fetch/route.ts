import { randomBytes, randomInt } from "crypto";
import { decryptConfig } from "@/lib/config-crypto";
import { sql } from "@/lib/db";
import { ensureWorkspaceSchema } from "@/lib/ensure-schema";
import { clientIp, clientNonceHash, digest, noStoreJson, normalizeHwid, opaque } from "@/lib/security";
import { HEARTBEAT_INTERVAL_SECONDS, HEARTBEAT_TTL_SECONDS } from "@/lib/runtime-session";
import { recordTelemetry } from "@/lib/telemetry";
import { protectedBrowserResponse } from "@/lib/protected-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// How long a delivered script stays runnable; a captured copy replayed later refuses to start.
const DELIVERY_TTL_SECONDS = 120;

function deliveryGuard(
  token: string,
  matchType: string,
  matchValue: string,
  expiresAt: number,
  keySystemEnabled: boolean
) {
  const routeCheck =
    matchType === "PLACE"
      ? `if tostring(game.PlaceId) ~= "${matchValue}" then error("[Claudmor] invalid place", 0) end\n`
      : matchType === "UNIVERSE"
        ? `if tostring(game.GameId) ~= "${matchValue}" then error("[Claudmor] invalid universe", 0) end\n`
        : "";

  const keyCheck = keySystemEnabled
    ? 'if type(__cm.SCRIPT_KEY) ~= "string" or __cm.SCRIPT_KEY == "" then error("[Claudmor] SCRIPT_KEY missing", 0) end\n'
    : "";

  return `local __cm = type(_G) == "table" and _G or {}
if type(getgenv) == "function" then
    local __ok, __env = pcall(getgenv)
    if __ok and type(__env) == "table" then __cm = __env end
end
${keyCheck}if __cm.__CLAUDMOR_AUTHORIZED ~= true then error("[Claudmor] unauthorized execution", 0) end
if __cm.__CLAUDMOR_DELIVERY ~= "${token}" then error("[Claudmor] invalid delivery token", 0) end
local __cmNow = os.time()
pcall(function() __cmNow = workspace:GetServerTimeNow() end)
if __cmNow > ${expiresAt} then error("[Claudmor] delivery expired", 0) end
${routeCheck}`;
}

function randomName() {
  return "_" + randomBytes(8).toString("hex");
}

// Harmless throwaway statements mixed into the guard so no two deliveries share a byte layout.
function decoyStatements() {
  const count = randomInt(3, 8);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const name = randomName();
    const roll = randomInt(3);
    if (roll === 0) {
      out.push(`local ${name} = "${randomBytes(randomInt(4, 13)).toString("hex")}"`);
    } else if (roll === 1) {
      out.push(`local ${name} = ${randomInt(1, 2147483647)}`);
    } else {
      out.push(`local ${name} = function() return ${randomInt(1, 2147483647)} end`);
    }
  }
  return out;
}

function shuffle<T>(items: T[]) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

// Guard for nonce-aware loaders: a one-off env slot, random local names and a randomized
// check order, so no two deliveries share a shape a generic bypass could patch.
function randomizedGuard(
  token: string,
  slot: string,
  matchType: string,
  matchValue: string,
  expiresAt: number,
  keySystemEnabled: boolean
) {
  const env = randomName();
  const now = randomName();
  const checks = [
    ...(keySystemEnabled
      ? [`if type(${env}.SCRIPT_KEY) ~= "string" or ${env}.SCRIPT_KEY == "" then error("[Claudmor] SCRIPT_KEY missing", 0) end`]
      : []),
    `if ${env}["${slot}"] ~= "${token}" then error("[Claudmor] invalid delivery token", 0) end`,
    `local ${now} = os.time() pcall(function() ${now} = workspace:GetServerTimeNow() end) if ${now} > ${expiresAt} then error("[Claudmor] delivery expired", 0) end`
  ];

  if (matchType === "PLACE") {
    checks.push(`if tostring(game.PlaceId) ~= "${matchValue}" then error("[Claudmor] invalid place", 0) end`);
  } else if (matchType === "UNIVERSE") {
    checks.push(`if tostring(game.GameId) ~= "${matchValue}" then error("[Claudmor] invalid universe", 0) end`);
  }

  const lines = shuffle([...checks, ...decoyStatements()]).map(line => `do ${line} end`);
  return `local ${env} = type(_G) == "table" and _G or {}
if type(getgenv) == "function" then
    local __ok, __resolved = pcall(getgenv)
    if __ok and type(__resolved) == "table" then ${env} = __resolved end
end
` + lines.join("\n") + "\n";
}

async function findRoute(
  serviceId: string,
  ownerId: string,
  placeId: string,
  universeId: string
) {
  const rows = await sql`
    SELECT
      r.match_type,
      r.match_value,
      r.script_id,
      r.target_service_id,
      ss.name AS script_name,
      ss.obfuscated_ciphertext,
      script_service.id AS script_service_id,
      script_service.name AS script_service_name,
      target.name AS target_service_name
    FROM script_routes r
    LEFT JOIN service_scripts ss ON ss.id = r.script_id
    LEFT JOIN services script_service ON script_service.id = ss.service_id
    LEFT JOIN services target ON target.id = r.target_service_id
    WHERE r.service_id = ${serviceId}
      AND r.enabled = true
      AND (
        (
          r.script_id IS NOT NULL
          AND script_service.owner_id = ${ownerId}
          AND script_service.enabled = true
        )
        OR
        (
          r.target_service_id IS NOT NULL
          AND target.owner_id = ${ownerId}
          AND target.enabled = true
        )
      )
      AND (
        (r.match_type = 'PLACE' AND r.match_value = ${placeId})
        OR
        (r.match_type = 'UNIVERSE' AND r.match_value = ${universeId})
        OR
        (r.match_type = 'DEFAULT')
      )
    ORDER BY
      CASE
        WHEN r.match_type = 'PLACE' AND r.match_value = ${placeId} THEN 0
        WHEN r.match_type = 'UNIVERSE' AND r.match_value = ${universeId} THEN 1
        ELSE 2
      END,
      r.priority DESC,
      r.created_at ASC
    LIMIT 1
  `;

  return (rows[0] as any) || null;
}

export async function GET(req: Request) {
  return protectedBrowserResponse(req, "script");
}

export async function POST(req: Request) {
  await ensureWorkspaceSchema();

  let body: {
    ticket?: string;
    hwid?: string;
    placeId?: string | number;
    universeId?: string | number;
    nonce?: string;
  };

  try {
    body = await req.json();
  } catch {
    return noStoreJson({ ok: false, error: "invalid_json" }, 400);
  }

  if (!body.ticket || !body.hwid) {
    return noStoreJson({ ok: false, error: "missing_fields" }, 400);
  }

  const ticketHash = digest(body.ticket);
  const hwidHash = digest(normalizeHwid(body.hwid));
  const placeId = String(body.placeId || "").trim();
  const universeId = String(body.universeId || "").trim();
  const nonceHash = clientNonceHash(body.nonce);

  // Tickets minted by a nonce-aware loader can only be redeemed by that same run.
  const consumed = await sql`
    UPDATE bootstrap_tickets
    SET consumed_at = now()
    WHERE ticket_hash = ${ticketHash}
      AND hwid_hash = ${hwidHash}
      AND (client_nonce_hash IS NULL OR client_nonce_hash = ${nonceHash})
      AND consumed_at IS NULL
      AND expires_at > now()
    RETURNING service_id, key_id, client_nonce_hash
  `;

  if (!consumed[0]) {
    return noStoreJson({ ok: false, error: "invalid_or_consumed_ticket" }, 401);
  }

  const ticket = consumed[0] as any;

  const access = await sql`
    SELECT k.id, s.owner_id, s.key_system_enabled
    FROM license_keys k
    JOIN services s ON s.id = k.service_id
    WHERE k.id = ${ticket.key_id}
      AND s.id = ${ticket.service_id}
      AND s.enabled = true
      AND k.revoked_at IS NULL
      AND (k.expires_at IS NULL OR k.expires_at > now())
    LIMIT 1
  `;

  if (!access[0]) {
    await recordTelemetry({
      serviceId: ticket.service_id,
      keyId: ticket.key_id,
      eventType: "AUTH_REJECTED",
      hwidHash,
      ipHash: digest(clientIp(req.headers)),
      placeId,
      universeId,
      reason: "license_inactive"
    });

    return noStoreJson({ ok: false, error: "license_inactive" }, 403);
  }

  const ownerId = String((access[0] as any).owner_id);
  let currentServiceId = String(ticket.service_id);
  let resolved: any = null;
  let firstMatch: { type: string; value: string } | null = null;
  const visited = new Set<string>();

  for (let depth = 0; depth < 8; depth++) {
    if (visited.has(currentServiceId)) {
      await recordTelemetry({
        serviceId: ticket.service_id,
        keyId: ticket.key_id,
        eventType: "ROUTE_MISS",
        hwidHash,
        ipHash: digest(clientIp(req.headers)),
        placeId,
        universeId,
        reason: "route_cycle"
      });

      return noStoreJson({ ok: false, error: "route_cycle" }, 409);
    }

    visited.add(currentServiceId);

    const route = await findRoute(
      currentServiceId,
      ownerId,
      placeId,
      universeId
    );

    if (!route) break;

    if (!firstMatch) {
      firstMatch = {
        type: String(route.match_type),
        value: String(route.match_value || "")
      };
    }

    if (route.script_id) {
      resolved = route;
      break;
    }

    if (route.target_service_id) {
      currentServiceId = String(route.target_service_id);
      continue;
    }

    break;
  }

  if (!resolved) {
    await recordTelemetry({
      serviceId: ticket.service_id,
      keyId: ticket.key_id,
      eventType: "ROUTE_MISS",
      hwidHash,
      ipHash: digest(clientIp(req.headers)),
      placeId,
      universeId,
      reason: "no_script_route"
    });

    return noStoreJson({ ok: false, error: "no_script_route" }, 404);
  }

  if (!resolved.obfuscated_ciphertext) {
    return noStoreJson({
      ok: false,
      error: "script_not_built",
      detail: "The resolved target script has not been obfuscated yet."
    }, 409);
  }

  const decoded = decryptConfig(resolved.obfuscated_ciphertext) as { source?: string };
  const payload = String(decoded.source || "");

  if (!payload) {
    return noStoreJson({ ok: false, error: "empty_build" }, 500);
  }

  const deliveryToken = opaque("CMD", 24);
  const guardMatch = firstMatch || {
    type: String(resolved.match_type),
    value: String(resolved.match_value || "")
  };

  const expiresAt = Math.floor(Date.now() / 1000) + DELIVERY_TTL_SECONDS;
  // Only nonce-aware loaders know to fill the random slot; older loaders keep the fixed guard.
  const guardSlot = ticket.client_nonce_hash ? randomName() : null;

  // Per-delivery watermark: a leaked copy of this script can be traced back to the key that got it.
  const watermark = opaque("CMW", 12);
  const heartbeatToken = opaque("CMH", 24);

  const source =
    `-- ${watermark}\n` +
    (guardSlot
      ? randomizedGuard(
          deliveryToken,
          guardSlot,
          guardMatch.type,
          guardMatch.value,
          expiresAt,
          (access[0] as any).key_system_enabled !== false
        )
      : deliveryGuard(
          deliveryToken,
          guardMatch.type,
          guardMatch.value,
          expiresAt,
          (access[0] as any).key_system_enabled !== false
        )) + payload;

  await sql`
    INSERT INTO runtime_sessions(
      service_id, key_id, hwid_hash, client_nonce_hash, token_hash, watermark, expires_at
    )
    VALUES (
      ${ticket.service_id},
      ${ticket.key_id},
      ${hwidHash},
      ${ticket.client_nonce_hash || null},
      ${digest(heartbeatToken)},
      ${watermark},
      now() + (${HEARTBEAT_TTL_SECONDS} * interval '1 second')
    )
  `;

  const ipHash = digest(clientIp(req.headers));

  await sql`
    INSERT INTO audit_events(service_id, key_id, kind, ip_hash)
    VALUES (
      ${ticket.service_id},
      ${ticket.key_id},
      'SCRIPT_DELIVERY',
      ${ipHash}
    )
  `;

  await recordTelemetry({
    serviceId: ticket.service_id,
    keyId: ticket.key_id,
    scriptId: resolved.script_id,
    eventType: "SCRIPT_DELIVERY",
    hwidHash,
    ipHash,
    placeId,
    universeId,
    routeType: guardMatch.type,
    metadata: { watermark }
  });

  return noStoreJson({
    ok: true,
    deliveryToken,
    ...(guardSlot ? { guardSlot } : {}),
    heartbeat: {
      endpoint: "/api/v1/loader/heartbeat",
      token: heartbeatToken,
      interval: HEARTBEAT_INTERVAL_SECONDS
    },
    source,
    scriptName: resolved.script_name,
    scriptId: resolved.script_id,
    targetServiceId: resolved.script_service_id,
    targetServiceName: resolved.script_service_name,
    protected: true,
    matched: guardMatch
  });
}
