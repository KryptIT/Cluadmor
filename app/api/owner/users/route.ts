import { sql } from "@/lib/db";
import { ensureWorkspaceSchema } from "@/lib/ensure-schema";
import { noStoreJson } from "@/lib/security";
import { workspaceIdentity } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireOwner(req: Request) {
  await ensureWorkspaceSchema();
  const identity = await workspaceIdentity(req);
  if (!identity) return { error: noStoreJson({ ok: false, error: "login_required" }, 401) };
  if (!identity.owner) return { error: noStoreJson({ ok: false, error: "owner_required" }, 403) };
  return { identity };
}

export async function GET(req: Request) {
  const owned = await requireOwner(req);
  if ("error" in owned) return owned.error;

  const users = await sql`
    SELECT id, email, username, display_name, avatar_url,
           obfuscation_credits, unlimited_obfuscation_credits, created_at
    FROM users
    ORDER BY unlimited_obfuscation_credits DESC, created_at DESC
    LIMIT 250
  `;

  return noStoreJson({ ok: true, users });
}

export async function POST(req: Request) {
  const owned = await requireOwner(req);
  if ("error" in owned) return owned.error;

  let body: { userId?: string; unlimitedObfuscation?: boolean };
  try { body = await req.json(); }
  catch { return noStoreJson({ ok: false, error: "invalid_json" }, 400); }

  if (!body.userId || typeof body.unlimitedObfuscation !== "boolean") {
    return noStoreJson({ ok: false, error: "missing_fields" }, 400);
  }

  const rows = await sql`
    UPDATE users
    SET unlimited_obfuscation_credits = ${body.unlimitedObfuscation}
    WHERE id = ${body.userId}
    RETURNING id, email, username, display_name, avatar_url,
              obfuscation_credits, unlimited_obfuscation_credits
  `;

  if (!rows[0]) return noStoreJson({ ok: false, error: "user_not_found" }, 404);

  return noStoreJson({ ok: true, user: rows[0] });
}
