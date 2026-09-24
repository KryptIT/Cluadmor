import { accountFromRequest, clearAccountCookie } from "@/lib/account";
import { ensureWorkspaceSchema } from "@/lib/ensure-schema";
import { sql } from "@/lib/db";
import { noStoreJson } from "@/lib/security";
import { ownerFromRequest } from "@/lib/owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureWorkspaceSchema();
  const account = accountFromRequest(req);
  const owner = ownerFromRequest(req);

  if (!account) return noStoreJson({ ok: true, authenticated: false, ownerBypass: owner });

  const rows = await sql`
    SELECT
      id,
      username,
      display_name,
      avatar_url,
      email,
      obfuscation_credits,
      service_creation_credits
    FROM users
    WHERE id = ${account.userId}
    LIMIT 1
  `;

  if (!rows[0]) return noStoreJson({ ok: true, authenticated: false, ownerBypass: owner });

  return noStoreJson({
    ok: true,
    authenticated: true,
    ownerBypass: owner,
    user: rows[0]
  });
}

export async function DELETE() {
  await ensureWorkspaceSchema();
  const response = noStoreJson({ ok: true });
  response.headers.append("Set-Cookie", clearAccountCookie());
  return response;
}
