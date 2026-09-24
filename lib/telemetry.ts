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
