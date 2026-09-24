import { accountCookie, hashPassword, issueAccountToken } from "@/lib/account";
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

  if (!/^[a-z0-9_]{3,32}$/.test(username)) {
    return noStoreJson({ ok: false, error: "invalid_username" }, 400);
  }
  if (password.length < 8 || password.length > 200) {
    return noStoreJson({ ok: false, error: "invalid_password" }, 400);
  }

  try {
    const rows = await sql`
      INSERT INTO users(username, password_hash)
      VALUES (${username}, ${hashPassword(password)})
      RETURNING id, username, obfuscation_credits, service_creation_credits
    `;
    const user = rows[0] as any;
    const response = noStoreJson({ ok: true, user });
    response.headers.append("Set-Cookie", accountCookie(issueAccountToken(String(user.id))));
    return response;
  } catch {
    return noStoreJson({ ok: false, error: "username_taken" }, 409);
  }
}
