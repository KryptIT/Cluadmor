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
    SELECT id FROM services WHERE id = ${serviceId} AND owner_id = ${identity.userId} LIMIT 1
  `;
  if (!owned[0]) return noStoreJson({ ok: false, error: "service_not_owned" }, 403);

  const rows = await sql`
    SELECT r.id, r.service_id, r.script_id, r.match_type, r.match_value,
           r.priority, r.enabled, ss.name AS script_name
    FROM script_routes r
    JOIN service_scripts ss ON ss.id = r.script_id
    WHERE r.service_id = ${serviceId}
    ORDER BY
      CASE r.match_type WHEN 'PLACE' THEN 0 WHEN 'UNIVERSE' THEN 1 ELSE 2 END,
      r.priority DESC,
      r.created_at ASC
  `;

  return noStoreJson({ ok: true, routes: rows });
}

export async function POST(req: Request) {
  await ensureWorkspaceSchema();
  const identity = await workspaceIdentity(req);
  if (!identity) return noStoreJson({ ok: false, error: "login_required" }, 401);

  let body: {
    serviceId?: string;
    scriptId?: string;
    matchType?: "PLACE" | "UNIVERSE" | "DEFAULT";
    matchValue?: string;
    priority?: number;
  };

  try { body = await req.json(); }
  catch { return noStoreJson({ ok: false, error: "invalid_json" }, 400); }

  if (!body.serviceId || !body.scriptId || !body.matchType) {
    return noStoreJson({ ok: false, error: "missing_fields" }, 400);
  }

  const matchType = body.matchType;
  const matchValue = matchType === "DEFAULT" ? "" : String(body.matchValue || "").trim();

  if (!["PLACE", "UNIVERSE", "DEFAULT"].includes(matchType)) {
    return noStoreJson({ ok: false, error: "invalid_match_type" }, 400);
  }
  if (matchType !== "DEFAULT" && !/^\d{1,20}$/.test(matchValue)) {
    return noStoreJson({ ok: false, error: "invalid_match_value" }, 400);
  }

  const valid = await sql`
    SELECT s.id
    FROM services s
    JOIN service_scripts ss ON ss.service_id = s.id
    WHERE s.id = ${body.serviceId}
      AND s.owner_id = ${identity.userId}
      AND ss.id = ${body.scriptId}
    LIMIT 1
  `;
  if (!valid[0]) return noStoreJson({ ok: false, error: "service_or_script_not_owned" }, 403);

  const rows = await sql`
    INSERT INTO script_routes(service_id, script_id, match_type, match_value, priority)
    VALUES (
      ${body.serviceId}, ${body.scriptId}, ${matchType}, ${matchValue},
      ${Math.floor(body.priority || 0)}
    )
    ON CONFLICT(service_id, match_type, match_value)
    DO UPDATE SET
      script_id = EXCLUDED.script_id,
      priority = EXCLUDED.priority,
      enabled = true
    RETURNING id, service_id, script_id, match_type, match_value, priority, enabled
  `;

  return noStoreJson({ ok: true, route: rows[0] }, 201);
}

export async function DELETE(req: Request) {
  await ensureWorkspaceSchema();
  const identity = await workspaceIdentity(req);
  if (!identity) return noStoreJson({ ok: false, error: "login_required" }, 401);

  let body: { id?: string };
  try { body = await req.json(); }
  catch { return noStoreJson({ ok: false, error: "invalid_json" }, 400); }

  if (!body.id) return noStoreJson({ ok: false, error: "missing_id" }, 400);

  const rows = await sql`
    DELETE FROM script_routes r
    USING services s
    WHERE r.id = ${body.id}
      AND s.id = r.service_id
      AND s.owner_id = ${identity.userId}
    RETURNING r.id
  `;

  if (!rows[0]) return noStoreJson({ ok: false, error: "not_found" }, 404);
  return noStoreJson({ ok: true });
}
