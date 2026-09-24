import { accountCookie, issueAccountToken, verifyPassword } from "@/lib/account";
import { sql } from "@/lib/db";
import { noStoreJson } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { username?: string; password?: string };
  try { body = await req.json(); }
  catch { return noStoreJson({ ok: false, error: "invalid_json" }, 400); }

  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");

  const rows = await sql`
    SELECT id, username, password_hash, obfuscation_credits, service_creation_credits
    FROM users
    WHERE username = ${username}
    LIMIT 1
  `;
  const user = rows[0] as any;

  if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
    return noStoreJson({ ok: false, error: "invalid_credentials" }, 401);
  }

  const response = noStoreJson({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      obfuscation_credits: user.obfuscation_credits,
      service_creation_credits: user.service_creation_credits
    }
  });
  response.headers.append("Set-Cookie", accountCookie(issueAccountToken(String(user.id))));
  return response;
}
