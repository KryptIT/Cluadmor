import { decryptConfig } from "@/lib/config-crypto";
import { sql } from "@/lib/db";
import { ensureWorkspaceSchema } from "@/lib/ensure-schema";
import { clientIp, digest, noStoreJson, normalizeHwid, opaque } from "@/lib/security";
import { recordTelemetry } from "@/lib/telemetry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function deliveryGuard(token: string, matchType: string, matchValue: string) {
  const routeCheck =
    matchType === "PLACE"
      ? `if tostring(game.PlaceId) ~= "${matchValue}" then error("[Claudmor] invalid place", 0) end\n`
      : matchType === "UNIVERSE"
        ? `if tostring(game.GameId) ~= "${matchValue}" then error("[Claudmor] invalid universe", 0) end\n`
        : "";

  return `local __cm = (getgenv and getgenv()) or _G
if type(__cm.SCRIPT_KEY) ~= "string" or __cm.SCRIPT_KEY == "" then error("[Claudmor] SCRIPT_KEY missing", 0) end
if __cm.__CLAUDMOR_AUTHORIZED ~= true then error("[Claudmor] unauthorized execution", 0) end
if __cm.__CLAUDMOR_DELIVERY ~= "${token}" then error("[Claudmor] invalid delivery token", 0) end
${routeCheck}`;
}

export async function POST(req: Request) {
  await ensureWorkspaceSchema();
  let body: {
    ticket?: string;
    hwid?: string;
    placeId?: string | number;
    universeId?: string | number;
  };

  try { body = await req.json(); }
  catch { return noStoreJson({ ok: false, error: "invalid_json" }, 400); }

  if (!body.ticket || !body.hwid) {
    return noStoreJson({ ok: false, error: "missing_fields" }, 400);
  }

  const ticketHash = digest(body.ticket);
  const hwidHash = digest(normalizeHwid(body.hwid));
  const placeId = String(body.placeId || "").trim();
  const universeId = String(body.universeId || "").trim();

  const consumed = await sql`
    UPDATE bootstrap_tickets
    SET consumed_at = now()
    WHERE ticket_hash = ${ticketHash}
      AND hwid_hash = ${hwidHash}
      AND consumed_at IS NULL
      AND expires_at > now()
    RETURNING service_id, key_id
  `;

  if (!consumed[0]) {
    return noStoreJson({ ok: false, error: "invalid_or_consumed_ticket" }, 401);
  }

  const ticket = consumed[0] as any;

  const access = await sql`
    SELECT k.id
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

  const rows = await sql`
    SELECT r.match_type, r.match_value,
           ss.id AS script_id, ss.name AS script_name,
           ss.obfuscated_ciphertext,
           target.id AS target_service_id,
           target.name AS target_service_name
    FROM script_routes r
    JOIN services source ON source.id = r.service_id
    JOIN service_scripts ss ON ss.id = r.script_id
    JOIN services target ON target.id = ss.service_id
    WHERE r.service_id = ${ticket.service_id}
      AND r.enabled = true
      AND target.enabled = true
      AND target.owner_id = source.owner_id
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

  if (!rows[0]) {
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

  const row = rows[0] as any;
  if (!row.obfuscated_ciphertext) {
    return noStoreJson({
      ok: false,
      error: "script_not_built",
      detail: "The routed script has not been obfuscated yet."
    }, 409);
  }

  const decoded = decryptConfig(row.obfuscated_ciphertext) as { source?: string };
  const payload = String(decoded.source || "");

  if (!payload) {
    return noStoreJson({ ok: false, error: "empty_build" }, 500);
  }

  const deliveryToken = opaque("CMD", 18);
  const source = deliveryGuard(
    deliveryToken,
    String(row.match_type),
    String(row.match_value || "")
  ) + payload;

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
    scriptId: row.script_id,
    eventType: "SCRIPT_DELIVERY",
    hwidHash,
    ipHash,
    placeId,
    universeId,
    routeType: String(row.match_type)
  });

  return noStoreJson({
    ok: true,
    deliveryToken,
    source,
    scriptName: row.script_name,
    scriptId: row.script_id,
    targetServiceId: row.target_service_id,
    targetServiceName: row.target_service_name,
    protected: true,
    matched: {
      type: row.match_type,
      value: row.match_value
    }
  });
}
