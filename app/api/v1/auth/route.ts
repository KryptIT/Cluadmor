import { sql } from "@/lib/db";
import { clientIp, digest, noStoreJson, normalizeHwid } from "@/lib/security";
import { issueSession } from "@/lib/session";
import { recordTelemetry } from "@/lib/telemetry";

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

export async function POST(req: Request) {
  let body: Body;

  try {
    body = await req.json();
  } catch {
    return noStoreJson({ ok: false, error: "invalid_json" }, 400);
  }

  if (!body.serviceId || !body.key || !body.hwid) {
    return noStoreJson({ ok: false, error: "missing_fields" }, 400);
  }

  const services = await sql`
    SELECT id, owner_id, enabled, require_hwid,
           require_roblox_user_id, require_roblox_username, require_discord_user_id
    FROM services
    WHERE id = ${body.serviceId}
    LIMIT 1
  `;

  const service = services[0] as any;
  if (!service || !service.enabled) {
    return noStoreJson({ ok: false, error: "invalid_service" }, 404);
  }

  const hwid = normalizeHwid(body.hwid);
  const hwidHash = digest(hwid);
  const ipHash = digest(clientIp(req.headers));
  const keyHash = digest(body.key);

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
    await recordTelemetry({
      serviceId: service.id,
      eventType: "AUTH_REJECTED",
      hwidHash,
      ipHash,
      reason: "invalid_key"
    });
    return noStoreJson({ ok: false, error: "invalid_key" }, 401);
  }

  if (key.revoked_at) {
    await recordTelemetry({
      serviceId: service.id,
      keyId: key.id,
      eventType: "AUTH_REJECTED",
      hwidHash,
      ipHash,
      reason: "revoked_key"
    });
    return noStoreJson({ ok: false, error: "invalid_key" }, 401);
  }

  if (key.expires_at && new Date(key.expires_at).getTime() <= Date.now()) {
    await recordTelemetry({
      serviceId: service.id,
      keyId: key.id,
      eventType: "AUTH_REJECTED",
      hwidHash,
      ipHash,
      reason: "expired_key"
    });
    return noStoreJson({ ok: false, error: "invalid_key" }, 401);
  }

  if (service.require_hwid) {
    if (key.hwid_hash && key.hwid_hash !== hwidHash) {
      await recordTelemetry({
        serviceId: service.id,
        keyId: key.id,
        eventType: "AUTH_REJECTED",
        hwidHash,
        ipHash,
        reason: "hwid_mismatch"
      });
      return noStoreJson({ ok: false, error: "hwid_mismatch" }, 403);
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

  if (
    service.require_roblox_user_id &&
    String(key.roblox_user_id || "") !== String(body.robloxUserId || "")
  ) {
    await recordTelemetry({
      serviceId: service.id,
      keyId: key.id,
      eventType: "AUTH_REJECTED",
      hwidHash,
      ipHash,
      reason: "roblox_user_id_mismatch"
    });
    return noStoreJson({ ok: false, error: "roblox_user_id_mismatch" }, 403);
  }

  if (
    service.require_roblox_username &&
    String(key.roblox_username || "").toLowerCase() !==
      String(body.robloxUsername || "").toLowerCase()
  ) {
    await recordTelemetry({
      serviceId: service.id,
      keyId: key.id,
      eventType: "AUTH_REJECTED",
      hwidHash,
      ipHash,
      reason: "roblox_username_mismatch"
    });
    return noStoreJson({ ok: false, error: "roblox_username_mismatch" }, 403);
  }

  if (
    service.require_discord_user_id &&
    String(key.discord_user_id || "") !== String(body.discordUserId || "")
  ) {
    await recordTelemetry({
      serviceId: service.id,
      keyId: key.id,
      eventType: "AUTH_REJECTED",
      hwidHash,
      ipHash,
      reason: "discord_user_id_mismatch"
    });
    return noStoreJson({ ok: false, error: "discord_user_id_mismatch" }, 403);
  }

  await sql`
    INSERT INTO audit_events(service_id, key_id, kind, ip_hash)
    VALUES (
      ${service.id},
      ${key.id},
      'AUTH_OK',
      ${ipHash}
    )
  `;

  await recordTelemetry({
    serviceId: service.id,
    keyId: key.id,
    eventType: "AUTH_SUCCESS",
    hwidHash,
    ipHash
  });

  return noStoreJson({
    ok: true,
    session: issueSession({
      serviceId: service.id,
      keyId: key.id,
      ownerId: service.owner_id,
      hwidHash
    }),
    expiresIn: 300
  });
}
