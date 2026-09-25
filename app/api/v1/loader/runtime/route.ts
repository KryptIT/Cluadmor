import { blacklistError, findRuntimeBlacklist } from "@/lib/blacklist";
import { decryptConfig } from "@/lib/config-crypto";
import { sql } from "@/lib/db";
import { ensureWorkspaceSchema } from "@/lib/ensure-schema";
import { ensurePublicAccessKey } from "@/lib/key-system";
import { protectedBrowserResponse } from "@/lib/protected-view";
import { clientIp, digest, normalizeHwid } from "@/lib/security";
import { recordTelemetry, tooManyKeyFailures } from "@/lib/telemetry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  serviceId?: string;
  key?: string;
  hwid?: string;
  robloxUserId?: string;
  robloxUsername?: string;
  discordUserId?: string;
};

function text(body: string, status: number) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "Pragma": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Vary": "X-Claudmor-Client, X-Claudmor-Protocol"
    }
  });
}

export async function GET(req: Request) {
  return protectedBrowserResponse(req, "loader");
}

export async function POST(req: Request) {
  await ensureWorkspaceSchema();

  if (req.headers.get("x-claudmor-client") !== "executor") {
    return text("client_header_check_failed: X-Claudmor-Client must be executor", 403);
  }

  if (req.headers.get("x-claudmor-protocol") !== "1") {
    return text("protocol_check_failed: X-Claudmor-Protocol must be 1", 403);
  }

  const userAgent = (req.headers.get("user-agent") || "").toLowerCase();
  const secFetchMode = req.headers.get("sec-fetch-mode");
  const secFetchSite = req.headers.get("sec-fetch-site");

  if (userAgent.includes("mozilla/") && (secFetchMode || secFetchSite)) {
    return text("browser_client_check_failed: browser navigation rejected", 403);
  }

  let body: Body;
  try { body = await req.json(); }
  catch { return text("json_check_failed: invalid_json", 400); }

  if (!body.serviceId) return text("required_field_check_failed: serviceId", 400);
  if (!body.hwid) return text("required_field_check_failed: hwid", 400);

  const services = await sql`
    SELECT id, enabled, key_system_enabled, require_hwid,
           require_roblox_user_id, require_roblox_username, require_discord_user_id
    FROM services
    WHERE id = ${body.serviceId}
    LIMIT 1
  `;

  const service = services[0] as any;
  if (!service) return text("service_check_failed: invalid_service", 404);
  if (!service.enabled) return text("service_check_failed: service_disabled", 403);
  if (service.key_system_enabled && !body.key) return text("required_field_check_failed: key", 400);

  const rawIp = clientIp(req.headers);
  const hwid = normalizeHwid(body.hwid);
  const hwidHash = digest(hwid);
  const ipHash = digest(rawIp);

  const blacklist = await findRuntimeBlacklist({
    ip: rawIp,
    hwid,
    robloxUserId: body.robloxUserId,
    discordUserId: body.discordUserId
  });

  if (blacklist) {
    const reason = blacklistError(String(blacklist.kind));
    await recordTelemetry({ serviceId: service.id, eventType: "AUTH_REJECTED", hwidHash, ipHash, reason });
    return text(
      `blacklist_check_failed: ${reason}${blacklist.reason ? " (" + blacklist.reason + ")" : ""}`,
      403
    );
  }

  let key: any;

  if (!service.key_system_enabled) {
    key = await ensurePublicAccessKey(service.id);
  } else {
    if (await tooManyKeyFailures(ipHash)) {
      return text("key_rate_limit_check_failed: rate_limited", 429);
    }

    const keys = await sql`
      SELECT id, hwid_hash, roblox_user_id, roblox_username, discord_user_id,
             expires_at, revoked_at
      FROM license_keys
      WHERE service_id = ${service.id}
        AND key_hash = ${digest(String(body.key || ""))}
        AND COALESCE(system_managed, false) = false
      LIMIT 1
    `;

    key = keys[0] as any;

    if (!key) {
      await recordTelemetry({ serviceId: service.id, eventType: "AUTH_REJECTED", hwidHash, ipHash, reason: "invalid_key" });
      return text("key_check_failed: invalid_key", 401);
    }

    if (key.revoked_at) return text("key_check_failed: revoked_key", 401);
    if (key.expires_at && new Date(key.expires_at).getTime() <= Date.now()) {
      return text("key_check_failed: expired_key", 401);
    }

    if (service.require_hwid) {
      if (key.hwid_hash && key.hwid_hash !== hwidHash) {
        return text("hwid_check_failed: hwid_mismatch", 403);
      }

      if (!key.hwid_hash) {
        await sql`
          UPDATE license_keys
          SET hwid_hash = ${hwidHash}
          WHERE id = ${key.id}
            AND hwid_hash IS NULL
        `;
      }
    }

    if (service.require_roblox_user_id && String(key.roblox_user_id || "") !== String(body.robloxUserId || "")) {
      return text("roblox_user_id_check_failed: mismatch", 403);
    }

    if (
      service.require_roblox_username &&
      String(key.roblox_username || "").toLowerCase() !== String(body.robloxUsername || "").toLowerCase()
    ) {
      return text("roblox_username_check_failed: mismatch", 403);
    }

    if (service.require_discord_user_id && String(key.discord_user_id || "") !== String(body.discordUserId || "")) {
      return text("discord_user_id_check_failed: mismatch", 403);
    }
  }

  const loaders = await sql`
    SELECT loader_ciphertext
    FROM service_loaders
    WHERE service_id = ${service.id}
    LIMIT 1
  `;

  if (!loaders[0]) return text("loader_check_failed: loader_not_published", 404);

  const decoded = decryptConfig((loaders[0] as any).loader_ciphertext) as { source?: string };
  const source = String(decoded.source || "");
  if (!source) return text("loader_check_failed: loader_unavailable", 503);

  await sql`
    INSERT INTO audit_events(service_id, key_id, kind, ip_hash)
    VALUES (${service.id}, ${key.id}, 'LOADER_BOOTSTRAP', ${ipHash})
  `;

  return text(source, 200);
}
