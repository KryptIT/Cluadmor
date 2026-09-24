import { sql } from "@/lib/db";
import { noStoreJson } from "@/lib/security";
import { workspaceIdentity } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RangeId = "24h" | "7d" | "30d";

function validRange(value: string | null): RangeId {
  return value === "24h" || value === "30d" ? value : "7d";
}

async function timeline24h(serviceId: string) {
  return sql`
    WITH buckets AS (
      SELECT generate_series(
        date_trunc('hour', now()) - interval '23 hours',
        date_trunc('hour', now()),
        interval '1 hour'
      ) AS bucket
    ),
    counts AS (
      SELECT
        date_trunc('hour', created_at) AS bucket,
        count(*) FILTER (WHERE event_type = 'AUTH_SUCCESS')::int AS auth_success,
        count(*) FILTER (WHERE event_type = 'AUTH_REJECTED')::int AS auth_rejected,
        count(*) FILTER (WHERE event_type = 'SCRIPT_DELIVERY')::int AS deliveries
      FROM telemetry_events
      WHERE service_id = ${serviceId}
        AND created_at >= now() - interval '24 hours'
      GROUP BY 1
    )
    SELECT
      b.bucket,
      coalesce(c.auth_success, 0)::int AS auth_success,
      coalesce(c.auth_rejected, 0)::int AS auth_rejected,
      coalesce(c.deliveries, 0)::int AS deliveries
    FROM buckets b
    LEFT JOIN counts c USING(bucket)
    ORDER BY b.bucket ASC
  `;
}

async function timelineDays(serviceId: string, days: 7 | 30) {
  if (days === 30) {
    return sql`
      WITH buckets AS (
        SELECT generate_series(
          date_trunc('day', now()) - interval '29 days',
          date_trunc('day', now()),
          interval '1 day'
        ) AS bucket
      ),
      counts AS (
        SELECT
          date_trunc('day', created_at) AS bucket,
          count(*) FILTER (WHERE event_type = 'AUTH_SUCCESS')::int AS auth_success,
          count(*) FILTER (WHERE event_type = 'AUTH_REJECTED')::int AS auth_rejected,
          count(*) FILTER (WHERE event_type = 'SCRIPT_DELIVERY')::int AS deliveries
        FROM telemetry_events
        WHERE service_id = ${serviceId}
          AND created_at >= now() - interval '30 days'
        GROUP BY 1
      )
      SELECT
        b.bucket,
        coalesce(c.auth_success, 0)::int AS auth_success,
        coalesce(c.auth_rejected, 0)::int AS auth_rejected,
        coalesce(c.deliveries, 0)::int AS deliveries
      FROM buckets b
      LEFT JOIN counts c USING(bucket)
      ORDER BY b.bucket ASC
    `;
  }

  return sql`
    WITH buckets AS (
      SELECT generate_series(
        date_trunc('day', now()) - interval '6 days',
        date_trunc('day', now()),
        interval '1 day'
      ) AS bucket
    ),
    counts AS (
      SELECT
        date_trunc('day', created_at) AS bucket,
        count(*) FILTER (WHERE event_type = 'AUTH_SUCCESS')::int AS auth_success,
        count(*) FILTER (WHERE event_type = 'AUTH_REJECTED')::int AS auth_rejected,
        count(*) FILTER (WHERE event_type = 'SCRIPT_DELIVERY')::int AS deliveries
      FROM telemetry_events
      WHERE service_id = ${serviceId}
        AND created_at >= now() - interval '7 days'
      GROUP BY 1
    )
    SELECT
      b.bucket,
      coalesce(c.auth_success, 0)::int AS auth_success,
      coalesce(c.auth_rejected, 0)::int AS auth_rejected,
      coalesce(c.deliveries, 0)::int AS deliveries
    FROM buckets b
    LEFT JOIN counts c USING(bucket)
    ORDER BY b.bucket ASC
  `;
}

export async function GET(req: Request) {
  const identity = await workspaceIdentity(req);
  if (!identity) return noStoreJson({ ok: false, error: "login_required" }, 401);

  const url = new URL(req.url);
  const serviceId = url.searchParams.get("serviceId") || "";
  const range = validRange(url.searchParams.get("range"));

  if (!serviceId) {
    return noStoreJson({ ok: false, error: "missing_service_id" }, 400);
  }

  const owned = await sql`
    SELECT id, name
    FROM services
    WHERE id = ${serviceId}
      AND owner_id = ${identity.userId}
    LIMIT 1
  `;

  if (!owned[0]) {
    return noStoreJson({ ok: false, error: "service_not_owned" }, 403);
  }

  const window =
    range === "24h" ? "24 hours" :
    range === "30d" ? "30 days" :
    "7 days";

  const summary = await sql`
    SELECT
      count(*) FILTER (WHERE event_type = 'AUTH_SUCCESS')::int AS auth_success,
      count(*) FILTER (WHERE event_type = 'AUTH_REJECTED')::int AS auth_rejected,
      count(*) FILTER (WHERE event_type = 'SCRIPT_DELIVERY')::int AS deliveries,
      count(*) FILTER (WHERE event_type = 'ROUTE_MISS')::int AS route_misses,
      count(DISTINCT hwid_hash) FILTER (WHERE hwid_hash IS NOT NULL)::int AS unique_devices,
      count(DISTINCT key_id) FILTER (WHERE key_id IS NOT NULL)::int AS keys_seen
    FROM telemetry_events
    WHERE service_id = ${serviceId}
      AND created_at >= now() - ${window}::interval
  `;

  const timeline =
    range === "24h"
      ? await timeline24h(serviceId)
      : await timelineDays(serviceId, range === "30d" ? 30 : 7);

  const [scripts, places, universes, rejections, recent] = await Promise.all([
    sql`
      SELECT
        coalesce(ss.name, 'Unknown script') AS label,
        count(*)::int AS count
      FROM telemetry_events t
      LEFT JOIN service_scripts ss ON ss.id = t.script_id
      WHERE t.service_id = ${serviceId}
        AND t.event_type = 'SCRIPT_DELIVERY'
        AND t.created_at >= now() - ${window}::interval
      GROUP BY ss.id, ss.name
      ORDER BY count DESC
      LIMIT 8
    `,
    sql`
      SELECT place_id AS label, count(*)::int AS count
      FROM telemetry_events
      WHERE service_id = ${serviceId}
        AND event_type = 'SCRIPT_DELIVERY'
        AND place_id IS NOT NULL
        AND place_id <> ''
        AND created_at >= now() - ${window}::interval
      GROUP BY place_id
      ORDER BY count DESC
      LIMIT 8
    `,
    sql`
      SELECT universe_id AS label, count(*)::int AS count
      FROM telemetry_events
      WHERE service_id = ${serviceId}
        AND event_type = 'SCRIPT_DELIVERY'
        AND universe_id IS NOT NULL
        AND universe_id <> ''
        AND created_at >= now() - ${window}::interval
      GROUP BY universe_id
      ORDER BY count DESC
      LIMIT 8
    `,
    sql`
      SELECT coalesce(reason, 'unknown') AS label, count(*)::int AS count
      FROM telemetry_events
      WHERE service_id = ${serviceId}
        AND event_type = 'AUTH_REJECTED'
        AND created_at >= now() - ${window}::interval
      GROUP BY reason
      ORDER BY count DESC
      LIMIT 8
    `,
    sql`
      SELECT
        t.event_type,
        t.reason,
        t.place_id,
        t.universe_id,
        t.route_type,
        t.created_at,
        ss.name AS script_name
      FROM telemetry_events t
      LEFT JOIN service_scripts ss ON ss.id = t.script_id
      WHERE t.service_id = ${serviceId}
      ORDER BY t.created_at DESC
      LIMIT 30
    `
  ]);

  return noStoreJson({
    ok: true,
    service: owned[0],
    range,
    summary: summary[0] || {
      auth_success: 0,
      auth_rejected: 0,
      deliveries: 0,
      route_misses: 0,
      unique_devices: 0,
      keys_seen: 0
    },
    timeline,
    topScripts: scripts,
    topPlaces: places,
    topUniverses: universes,
    rejectionReasons: rejections,
    recent
  });
}
