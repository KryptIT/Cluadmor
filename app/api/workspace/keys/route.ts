import { sql } from "@/lib/db";
import { ensureWorkspaceSchema } from "@/lib/ensure-schema";
import { digest, noStoreJson, opaque } from "@/lib/security";
import { workspaceIdentity } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureWorkspaceSchema();
  const identity = await workspaceIdentity(req);
  if (!identity) return noStoreJson({ ok: false, error: "login_required" }, 401);

  const url = new URL(req.url);
  const serviceId = url.searchParams.get("serviceId");

  const rows = serviceId
    ? await sql`
        SELECT k.id, k.service_id, s.name AS service_name, k.roblox_user_id,
               k.roblox_username, k.discord_user_id, k.expires_at, k.revoked_at, k.created_at,
               (k.hwid_hash IS NOT NULL) AS hwid_bound
        FROM license_keys k
        JOIN services s ON s.id = k.service_id
        WHERE s.owner_id = ${identity.userId} AND s.id = ${serviceId}
        ORDER BY k.created_at DESC
      `
    : await sql`
        SELECT k.id, k.service_id, s.name AS service_name, k.roblox_user_id,
               k.roblox_username, k.discord_user_id, k.expires_at, k.revoked_at, k.created_at,
               (k.hwid_hash IS NOT NULL) AS hwid_bound
        FROM license_keys k
        JOIN services s ON s.id = k.service_id
        WHERE s.owner_id = ${identity.userId}
        ORDER BY k.created_at DESC
      `;

  return noStoreJson({ ok: true, keys: rows });
}

export async function POST(req: Request) {
  await ensureWorkspaceSchema();
  const identity = await workspaceIdentity(req);
  if (!identity) return noStoreJson({ ok: false, error: "login_required" }, 401);

  let body: {
    serviceId?: string;
    expiresAt?: string | null;
  };

  try { body = await req.json(); }
  catch { return noStoreJson({ ok: false, error: "invalid_json" }, 400); }

  if (!body.serviceId) return noStoreJson({ ok: false, error: "missing_service_id" }, 400);

  const owned = await sql`
    SELECT id FROM services
    WHERE id = ${body.serviceId} AND owner_id = ${identity.userId}
    LIMIT 1
  `;
  if (!owned[0]) return noStoreJson({ ok: false, error: "service_not_owned" }, 403);

  const key = opaque("CLM", 24);
  const rows = await sql`
    INSERT INTO license_keys(
      service_id, key_hash, hwid_hash, roblox_user_id, roblox_username, discord_user_id, expires_at
    )
    VALUES (
      ${body.serviceId},
      ${digest(key)},
      NULL,
      NULL,
      NULL,
      NULL,
      ${body.expiresAt || null}
    )
    RETURNING id, service_id, expires_at, created_at
  `;

  return noStoreJson({ ok: true, license: rows[0], key }, 201);
}
