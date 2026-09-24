import { decryptConfig, encryptConfig } from "@/lib/config-crypto";
import { sql } from "@/lib/db";
import { noStoreJson } from "@/lib/security";
import { workspaceIdentity } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const identity = await workspaceIdentity(req);
  if (!identity) return noStoreJson({ ok: false, error: "login_required" }, 401);

  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (id) {
    const rows = await sql`
      SELECT ss.id, ss.name, ss.source_ciphertext, ss.service_id, s.name AS service_name
      FROM service_scripts ss
      JOIN services s ON s.id = ss.service_id
      WHERE ss.id = ${id} AND s.owner_id = ${identity.userId}
      LIMIT 1
    `;
    if (!rows[0]) return noStoreJson({ ok: false, error: "not_found" }, 404);

    const row = rows[0] as any;
    const decoded = decryptConfig(row.source_ciphertext) as { source?: string };

    return noStoreJson({
      ok: true,
      script: {
        id: row.id,
        name: row.name,
        serviceId: row.service_id,
        serviceName: row.service_name,
        source: decoded.source || ""
      }
    });
  }

  const rows = await sql`
    SELECT ss.id, ss.name, ss.service_id, s.name AS service_name, ss.created_at, ss.updated_at
    FROM service_scripts ss
    JOIN services s ON s.id = ss.service_id
    WHERE s.owner_id = ${identity.userId}
    ORDER BY ss.updated_at DESC
  `;

  return noStoreJson({ ok: true, scripts: rows });
}

export async function POST(req: Request) {
  const identity = await workspaceIdentity(req);
  if (!identity) return noStoreJson({ ok: false, error: "login_required" }, 401);

  let body: { serviceId?: string; name?: string; source?: string };
  try { body = await req.json(); }
  catch { return noStoreJson({ ok: false, error: "invalid_json" }, 400); }

  const name = String(body.name || "").trim();
  const source = String(body.source || "");

  if (!body.serviceId || name.length < 1 || name.length > 100 || source.length < 1 || source.length > 2_000_000) {
    return noStoreJson({ ok: false, error: "invalid_fields" }, 400);
  }

  const owned = await sql`
    SELECT id FROM services
    WHERE id = ${body.serviceId} AND owner_id = ${identity.userId}
    LIMIT 1
  `;
  if (!owned[0]) return noStoreJson({ ok: false, error: "service_not_owned" }, 403);

  const rows = await sql`
    INSERT INTO service_scripts(service_id, name, source_ciphertext)
    VALUES (${body.serviceId}, ${name}, ${encryptConfig({ source })})
    RETURNING id, name, service_id, created_at, updated_at
  `;

  return noStoreJson({ ok: true, script: rows[0] }, 201);
}
