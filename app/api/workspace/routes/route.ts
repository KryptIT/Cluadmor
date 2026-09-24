import { sql } from "@/lib/db";
import { ensureWorkspaceSchema } from "@/lib/ensure-schema";
import { noStoreJson } from "@/lib/security";
import { workspaceIdentity } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureWorkspaceSchema();
  const identity = await workspaceIdentity(req);
  if (!identity) return noStoreJson({ ok: false, error: "login_required" }, 401);

  const url = new URL(req.url);
  const serviceId = url.searchParams.get("serviceId");
  if (!serviceId) return noStoreJson({ ok: false, error: "missing_service_id" }, 400);

  const owned = await sql`
    SELECT id
    FROM services
    WHERE id = ${serviceId}
      AND owner_id = ${identity.userId}
    LIMIT 1
  `;

  if (!owned[0]) {
    return noStoreJson({ ok: false, error: "service_not_owned" }, 403);
  }

  const rows = await sql`
    SELECT
      r.id,
      r.service_id,
      r.script_id,
      r.target_service_id,
      r.match_type,
      r.match_value,
      r.priority,
      r.enabled,
      ss.name AS script_name,
      COALESCE(target.id, script_service.id) AS resolved_target_service_id,
      COALESCE(target.name, script_service.name) AS target_service_name
    FROM script_routes r
    LEFT JOIN service_scripts ss ON ss.id = r.script_id
    LEFT JOIN services script_service ON script_service.id = ss.service_id
    LEFT JOIN services target ON target.id = r.target_service_id
    WHERE r.service_id = ${serviceId}
      AND (
        (r.target_service_id IS NOT NULL AND target.owner_id = ${identity.userId})
        OR
        (r.script_id IS NOT NULL AND script_service.owner_id = ${identity.userId})
      )
    ORDER BY
      CASE r.match_type WHEN 'PLACE' THEN 0 WHEN 'UNIVERSE' THEN 1 ELSE 2 END,
      r.priority DESC,
      r.created_at ASC
  `;

  return noStoreJson({
    ok: true,
    routes: rows.map((row: any) => ({
      ...row,
      target_service_id: row.resolved_target_service_id
    }))
  });
}

export async function POST(req: Request) {
  await ensureWorkspaceSchema();

  const identity = await workspaceIdentity(req);
  if (!identity) return noStoreJson({ ok: false, error: "login_required" }, 401);

  let body: {
    serviceId?: string;
    targetServiceId?: string;
    scriptId?: string;
    matchType?: "PLACE" | "UNIVERSE" | "DEFAULT";
    matchValue?: string;
    priority?: number;
  };

  try {
    body = await req.json();
  } catch {
    return noStoreJson({ ok: false, error: "invalid_json" }, 400);
  }

  if (!body.serviceId || !body.targetServiceId || !body.scriptId || !body.matchType) {
    return noStoreJson({ ok: false, error: "missing_fields" }, 400);
  }

  const matchType = body.matchType;
  const matchValue =
    matchType === "DEFAULT" ? "" : String(body.matchValue || "").trim();

  if (!["PLACE", "UNIVERSE", "DEFAULT"].includes(matchType)) {
    return noStoreJson({ ok: false, error: "invalid_match_type" }, 400);
  }

  if (matchType !== "DEFAULT" && !/^\d{1,20}$/.test(matchValue)) {
    return noStoreJson({ ok: false, error: "invalid_match_value" }, 400);
  }

  const valid = await sql`
    SELECT source.id
    FROM services source
    JOIN services target
      ON target.id = ${body.targetServiceId}
     AND target.owner_id = ${identity.userId}
     AND target.enabled = true
    JOIN service_scripts ss
      ON ss.id = ${body.scriptId}
     AND ss.service_id = target.id
    WHERE source.id = ${body.serviceId}
      AND source.owner_id = ${identity.userId}
      AND source.enabled = true
    LIMIT 1
  `;

  if (!valid[0]) {
    return noStoreJson({ ok: false, error: "service_or_script_not_owned" }, 403);
  }

  const rows = await sql`
    INSERT INTO script_routes(
      service_id,
      script_id,
      target_service_id,
      match_type,
      match_value,
      priority
    )
    VALUES (
      ${body.serviceId},
      ${body.scriptId},
      ${body.targetServiceId},
      ${matchType},
      ${matchValue},
      ${Math.floor(body.priority || 0)}
    )
    ON CONFLICT(service_id, match_type, match_value)
    DO UPDATE SET
      script_id = EXCLUDED.script_id,
      target_service_id = EXCLUDED.target_service_id,
      priority = EXCLUDED.priority,
      enabled = true
    RETURNING
      id,
      service_id,
      script_id,
      target_service_id,
      match_type,
      match_value,
      priority,
      enabled
  `;

  return noStoreJson({ ok: true, route: rows[0] }, 201);
}

export async function DELETE(req: Request) {
  await ensureWorkspaceSchema();

  const identity = await workspaceIdentity(req);
  if (!identity) return noStoreJson({ ok: false, error: "login_required" }, 401);

  let body: { id?: string };

  try {
    body = await req.json();
  } catch {
    return noStoreJson({ ok: false, error: "invalid_json" }, 400);
  }

  if (!body.id) {
    return noStoreJson({ ok: false, error: "missing_id" }, 400);
  }

  const rows = await sql`
    DELETE FROM script_routes r
    USING services s
    WHERE r.id = ${body.id}
      AND s.id = r.service_id
      AND s.owner_id = ${identity.userId}
    RETURNING r.id
  `;

  if (!rows[0]) {
    return noStoreJson({ ok: false, error: "not_found" }, 404);
  }

  return noStoreJson({ ok: true });
}
