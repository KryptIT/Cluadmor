import { isAdmin } from "@/lib/admin";
import { sql } from "@/lib/db";
import { digest, noStoreJson, opaque } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isAdmin(req.headers)) return noStoreJson({ ok: false, error: "unauthorized" }, 401);

  let body: { ownerId?: string; name?: string };
  try { body = await req.json(); } catch { return noStoreJson({ ok: false, error: "invalid_json" }, 400); }
  if (!body.ownerId || !body.name) return noStoreJson({ ok: false, error: "missing_fields" }, 400);

  const secret = opaque("CLMS", 32);
  const rows = await sql`
    INSERT INTO services(owner_id, name, secret_hash)
    VALUES (${body.ownerId}, ${body.name.slice(0, 80)}, ${digest(secret)})
    RETURNING id, name, created_at
  `;

  return noStoreJson({ ok: true, service: rows[0], secret }, 201);
}
