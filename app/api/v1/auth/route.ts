import { blacklistError, findRuntimeBlacklist } from "@/lib/blacklist";
import { sql } from "@/lib/db";
import { ensureWorkspaceSchema } from "@/lib/ensure-schema";
import { clientIp, clientNonceHash, digest, noStoreJson, normalizeHwid } from "@/lib/security";
import { issueSession } from "@/lib/session";
import { keySharingDetected, recordTelemetry, revokeKeyForAbuse, tooManyKeyFailures } from "@/lib/telemetry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  serviceId?: string;
  key?: string;
  hwid?: string;
  robloxUserId?: string;
  robloxUsername?: string;
  discordUserId?: string;
  nonce?: string;
};

function fail(error: string, status: number, detail: string, failedCheck = error) {
  return noStoreJson({ ok: false, error, failedCheck, detail }, status);
}

export async function POST(req: Request) {
  await ensureWorkspaceSchema();
  let body: Body;

  try {
    body = await req.json();
  } catch {
    return fail("invalid_json", 400, "Request body is not valid JSON.", "request_json");
  }

  if (!body.serviceId) return fail("missing_service_id", 400, "Service ID is missing.", "required_service_id");
  if (!body.key) return fail("missing_key", 400, "SCRIPT_KEY is missing.", "required_key");
  if (!body.hwid) return fail("missing_hwid", 400, "HWID could not be resolved.", "required_hwid");

  const services = await sql`
    SELECT id, owner_id, enabled, require_hwid,
           require_roblox_user_id, require_roblox_username, require_discord_user_id
    FROM services
    WHERE id = ${body.serviceId}
    LIMIT 1
  `;

  const service = services[0] as any;
  if (!service) return fail("invalid_service", 404, "Service does not exist.", "service_exists");
  if (!service.enabled) return fail("service_disabled", 403, "Service is disabled.", "service_enabled");

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
    return fail(
      reason,
      403,
      blacklist.reason
        ? `Blocked by owner blacklist: ${blacklist.reason}`
        : `Blocked by owner blacklist (${blacklist.kind}).`,
      `blacklist_${String(blacklist.kind).toLowerCase()}`
    );
  }

  const keyHash = digest(body.key);

  if (await tooManyKeyFailures(ipHash)) {
    return fail("rate_limited", 429, "Too many failed key checks from this network. Try again later.", "key_rate_limit");
  }

  const rows = await sql`
    SELECT id, hwid_hash, roblox_user_id, roblox_username, discord_user_id,
           expires_at, revoked_at
    FROM license_keys
    WHERE service_id = ${service.id}
      AND key_hash = ${keyHash}
    LIMIT 1
  `;

  const key = rows[0] as any;

  if (!key) {
    await recordTelemetry({ serviceId: service.id, eventType: "AUTH_REJECTED", hwidHash, ipHash, reason: "invalid_key" });
    return fail("invalid_key", 401, "The supplied key does not exist for this service.", "key_exists");
  }

  if (key.revoked_at) {
    await recordTelemetry({ serviceId: service.id, keyId: key.id, eventType: "AUTH_REJECTED", hwidHash, ipHash, reason: "revoked_key" });
    return fail("revoked_key", 401, "This key has been revoked.", "key_not_revoked");
  }

  if (key.expires_at && new Date(key.expires_at).getTime() <= Date.now()) {
    await recordTelemetry({ serviceId: service.id, keyId: key.id, eventType: "AUTH_REJECTED", hwidHash, ipHash, reason: "expired_key" });
    return fail("expired_key", 401, "This key has expired.", "key_not_expired");
  }

  if (await keySharingDetected(key.id)) {
    await revokeKeyForAbuse(key.id, "shared_key");
    await recordTelemetry({ serviceId: service.id, keyId: key.id, eventType: "AUTH_REJECTED", hwidHash, ipHash, reason: "auto_revoked_shared" });
    return fail("key_revoked", 403, "This key was automatically revoked after shared-key use was detected.", "key_sharing");
  }

  if (service.require_hwid) {
    if (key.hwid_hash && key.hwid_hash !== hwidHash) {
      await recordTelemetry({ serviceId: service.id, keyId: key.id, eventType: "AUTH_REJECTED", hwidHash, ipHash, reason: "hwid_mismatch" });
      return fail("hwid_mismatch", 403, "The key is bound to a different HWID.", "hwid_binding");
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
    await recordTelemetry({ serviceId: service.id, keyId: key.id, eventType: "AUTH_REJECTED", hwidHash, ipHash, reason: "roblox_user_id_mismatch" });
    return fail("roblox_user_id_mismatch", 403, "The key is bound to a different Roblox UserId.", "roblox_user_id_binding");
  }

  if (
    service.require_roblox_username &&
    String(key.roblox_username || "").toLowerCase() !== String(body.robloxUsername || "").toLowerCase()
  ) {
    await recordTelemetry({ serviceId: service.id, keyId: key.id, eventType: "AUTH_REJECTED", hwidHash, ipHash, reason: "roblox_username_mismatch" });
    return fail("roblox_username_mismatch", 403, "The key is bound to a different Roblox username.", "roblox_username_binding");
  }

  if (service.require_discord_user_id && String(key.discord_user_id || "") !== String(body.discordUserId || "")) {
    await recordTelemetry({ serviceId: service.id, keyId: key.id, eventType: "AUTH_REJECTED", hwidHash, ipHash, reason: "discord_user_id_mismatch" });
    return fail("discord_user_id_mismatch", 403, "The key is bound to a different Discord UserId.", "discord_user_id_binding");
  }

  await sql`
    INSERT INTO audit_events(service_id, key_id, kind, ip_hash)
    VALUES (${service.id}, ${key.id}, 'AUTH_OK', ${ipHash})
  `;

  await recordTelemetry({ serviceId: service.id, keyId: key.id, eventType: "AUTH_SUCCESS", hwidHash, ipHash });

  return noStoreJson({
    ok: true,
    session: issueSession({
      serviceId: service.id,
      keyId: key.id,
      ownerId: service.owner_id,
      hwidHash,
      clientNonceHash: clientNonceHash(body.nonce) ?? undefined
    }),
    expiresIn: 300
  });
}
