import { sql } from "@/lib/db";
import { noStoreJson } from "@/lib/security";
import { workspaceIdentity } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const identity = await workspaceIdentity(req);
  if (!identity) return noStoreJson({ ok: false, error: "login_required" }, 401);

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return noStoreJson({ ok: false, error: "missing_id" }, 400);

  const rows = await sql`
    SELECT id, reward_type, status, expires_at
    FROM reward_sessions
    WHERE id = ${id} AND user_id = ${identity.userId}
    LIMIT 1
  `;

  if (!rows[0]) return noStoreJson({ ok: false, error: "not_found" }, 404);
  return noStoreJson({ ok: true, reward: rows[0] });
}
