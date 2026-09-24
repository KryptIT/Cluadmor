import { decryptConfig, encryptConfig } from "@/lib/config-crypto";
import { ensureWorkspaceSchema } from "@/lib/ensure-schema";
import { sql } from "@/lib/db";
import { noStoreJson } from "@/lib/security";
import { workspaceIdentity } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureWorkspaceSchema();

  const identity = await workspaceIdentity(req);
  if (!identity) return noStoreJson({ ok: false, error: "login_required" }, 401);

  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (id) {
    const rows = await sql`
      SELECT
        ss.id,
        ss.name,
        ss.source_ciphertext,
        ss.obfuscated_ciphertext,
        ss.obfuscated_at,
        ss.obfuscation_preset,
        ss.updated_at,
        ss.service_id,
        s.name AS service_name
      FROM service_scripts ss
      JOIN services s ON s.id = ss.service_id
      WHERE ss.id = ${id}
        AND s.owner_id = ${identity.userId}
      LIMIT 1
    `;

    if (!rows[0]) return noStoreJson({ ok: false, error: "not_found" }, 404);

    const row = rows[0] as any;
    const raw = decryptConfig(row.source_ciphertext) as { source?: string };
    const built = row.obfuscated_ciphertext
      ? decryptConfig(row.obfuscated_ciphertext) as { source?: string }
      : null;

    return noStoreJson({
      ok: true,
      script: {
        id: row.id,
        name: row.name,
        serviceId: row.service_id,
        serviceName: row.service_name,
        source: raw.source || "",
        obfuscated: built?.source || "",
        obfuscatedAt: row.obfuscated_at,
        preset: row.obfuscation_preset || "executor",
        updatedAt: row.updated_at,
        buildStale: !!row.obfuscated_at && new Date(row.updated_at).getTime() > new Date(row.obfuscated_at).getTime()
      }
    });
  }

  const rows = await sql`
    SELECT
      ss.id,
      ss.name,
      ss.service_id,
      s.name AS service_name,
      ss.created_at,
      ss.updated_at,
      ss.obfuscated_at,
      ss.obfuscation_preset,
      (ss.obfuscated_ciphertext IS NOT NULL) AS has_build
    FROM service_scripts ss
    JOIN services s ON s.id = ss.service_id
    WHERE s.owner_id = ${identity.userId}
    ORDER BY ss.updated_at DESC
  `;

  return noStoreJson({ ok: true, scripts: rows });
}

export async function POST(req: Request) {
  await ensureWorkspaceSchema();

  const identity = await workspaceIdentity(req);
  if (!identity) return noStoreJson({ ok: false, error: "login_required" }, 401);

  let body: {
    id?: string;
    serviceId?: string;
    name?: string;
    source?: string;
    preset?: string;
  };

  try { body = await req.json(); }
  catch { return noStoreJson({ ok: false, error: "invalid_json" }, 400); }

  const name = String(body.name || "").trim();
  const source = String(body.source || "");
  const preset = String(body.preset || "executor").trim() || "executor";

  if (!body.serviceId || name.length < 1 || name.length > 100 || source.length < 1 || source.length > 2_000_000) {
    return noStoreJson({ ok: false, error: "invalid_fields" }, 400);
  }

  const owned = await sql`
    SELECT id
    FROM services
    WHERE id = ${body.serviceId}
      AND owner_id = ${identity.userId}
    LIMIT 1
  `;

  if (!owned[0]) return noStoreJson({ ok: false, error: "service_not_owned" }, 403);

  if (body.id) {
    const rows = await sql`
      UPDATE service_scripts ss
      SET
        name = ${name},
        source_ciphertext = ${encryptConfig({ source })},
        obfuscation_preset = ${preset},
        updated_at = now()
      FROM services s
      WHERE ss.id = ${body.id}
        AND s.id = ss.service_id
        AND s.owner_id = ${identity.userId}
        AND ss.service_id = ${body.serviceId}
      RETURNING ss.id, ss.name, ss.service_id, ss.updated_at, ss.obfuscated_at
    `;

    if (!rows[0]) return noStoreJson({ ok: false, error: "script_not_owned" }, 403);
    return noStoreJson({ ok: true, script: rows[0] });
  }

  const rows = await sql`
    INSERT INTO service_scripts(
      service_id,
      name,
      source_ciphertext,
      obfuscation_preset
    )
    VALUES (
      ${body.serviceId},
      ${name},
      ${encryptConfig({ source })},
      ${preset}
    )
    RETURNING id, name, service_id, created_at, updated_at
  `;

  return noStoreJson({ ok: true, script: rows[0] }, 201);
}
