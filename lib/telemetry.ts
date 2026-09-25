import { sql } from "@/lib/db";

export type TelemetryEvent = {
  serviceId: string;
  keyId?: string | null;
  scriptId?: string | null;
  eventType: "AUTH_SUCCESS" | "AUTH_REJECTED" | "SCRIPT_DELIVERY" | "ROUTE_MISS";
  hwidHash?: string | null;
  ipHash?: string | null;
  placeId?: string | null;
  universeId?: string | null;
  routeType?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
};

const KEY_FAILURE_LIMIT = 25;

// Throttles key guessing: too many invalid-key rejections from one IP in the last 10 minutes.
export async function tooManyKeyFailures(ipHash: string) {
  try {
    const rows = await sql`
      SELECT count(*)::int AS failures
      FROM telemetry_events
      WHERE ip_hash = ${ipHash}
        AND event_type = 'AUTH_REJECTED'
        AND reason = 'invalid_key'
        AND created_at > now() - interval '10 minutes'
    `;
    return Number((rows[0] as any)?.failures || 0) >= KEY_FAILURE_LIMIT;
  } catch {
    return false;
  }
}

// Key-sharing thresholds within one hour. Deliberately generous so normal HWID resets and
// mobile IP changes do not trip them; lower them to be stricter.
const SHARED_KEY_MAX_HWIDS = 6;
const SHARED_KEY_MAX_IPS = 12;

// True when one key has been used from too many devices or networks in the last hour.
export async function keySharingDetected(keyId: string) {
  try {
    const rows = await sql`
      SELECT count(DISTINCT hwid_hash)::int AS hwids, count(DISTINCT ip_hash)::int AS ips
      FROM telemetry_events
      WHERE key_id = ${keyId}
        AND created_at > now() - interval '1 hour'
        AND (
          event_type = 'AUTH_SUCCESS'
          OR (event_type = 'AUTH_REJECTED' AND reason = 'hwid_mismatch')
        )
    `;
    const row = rows[0] as any;
    return Number(row?.hwids || 0) >= SHARED_KEY_MAX_HWIDS || Number(row?.ips || 0) >= SHARED_KEY_MAX_IPS;
  } catch {
    return false;
  }
}

// Revokes a key and ends every live runtime session using it.
export async function revokeKeyForAbuse(keyId: string, reason: string) {
  await sql`UPDATE license_keys SET revoked_at = now() WHERE id = ${keyId} AND revoked_at IS NULL`;
  await sql`
    UPDATE runtime_sessions
    SET revoked_at = now(), revoke_reason = ${reason}
    WHERE key_id = ${keyId} AND revoked_at IS NULL
  `;
}

export async function recordTelemetry(event: TelemetryEvent) {
  try {
    await sql`
      INSERT INTO telemetry_events(
        service_id,
        key_id,
        script_id,
        event_type,
        hwid_hash,
        ip_hash,
        place_id,
        universe_id,
        route_type,
        reason,
        metadata
      )
      VALUES (
        ${event.serviceId},
        ${event.keyId || null},
        ${event.scriptId || null},
        ${event.eventType},
        ${event.hwidHash || null},
        ${event.ipHash || null},
        ${event.placeId || null},
        ${event.universeId || null},
        ${event.routeType || null},
        ${event.reason || null},
        ${JSON.stringify(event.metadata || {})}::jsonb
      )
    `;
  } catch {
    // Telemetry must never break authentication or script delivery.
  }
}
