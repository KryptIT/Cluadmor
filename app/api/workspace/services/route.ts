import { sql } from "@/lib/db";
import { digest, noStoreJson, opaque } from "@/lib/security";
import { workspaceIdentity } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const identity = await workspaceIdentity(req);
  if (!identity) return noStoreJson({ ok: false, error: "login_required" }, 401);

  const rows = await sql`
    SELECT id, name, enabled, require_hwid, require_roblox_user_id,
           require_roblox_username, require_discord_user_id, created_at
    FROM services
    WHERE owner_id = ${identity.userId}
    ORDER BY created_at DESC
  `;

  return noStoreJson({
    ok: true,
    ownerBypass: identity.bypassRewards,
    services: rows
  });
}

export async function POST(req: Request) {
  const identity = await workspaceIdentity(req);
  if (!identity) return noStoreJson({ ok: false, error: "login_required" }, 401);

  let body: {
    name?: string;
    requireHwid?: boolean;
    requireRobloxUserId?: boolean;
    requireRobloxUsername?: boolean;
    requireDiscordUserId?: boolean;
  };

  try { body = await req.json(); }
  catch { return noStoreJson({ ok: false, error: "invalid_json" }, 400); }

  const name = String(body.name || "").trim();
  if (name.length < 2 || name.length > 80) {
    return noStoreJson({ ok: false, error: "invalid_name" }, 400);
  }

  if (!identity.bypassRewards) {
    const debit = await sql`
      UPDATE users
      SET service_creation_credits = service_creation_credits - 1
      WHERE id = ${identity.userId} AND service_creation_credits > 0
      RETURNING service_creation_credits
    `;
    if (!debit[0]) {
      return noStoreJson({ ok: false, error: "service_creation_credit_required" }, 402);
    }
  }

  const secret = opaque("CLMS", 32);

  try {
    const rows = await sql`
      INSERT INTO services(
        owner_id, name, secret_hash, require_hwid, require_roblox_user_id,
        require_roblox_username, require_discord_user_id
      )
      VALUES (
        ${identity.userId}, ${name}, ${digest(secret)}, ${body.requireHwid !== false},
        ${!!body.requireRobloxUserId}, ${!!body.requireRobloxUsername},
        ${!!body.requireDiscordUserId}
      )
      RETURNING id, name, enabled, require_hwid, require_roblox_user_id,
                require_roblox_username, require_discord_user_id, created_at
    `;

    return noStoreJson({
      ok: true,
      service: rows[0],
      serviceSecret: secret,
      ownerBypass: identity.bypassRewards
    }, 201);
  } catch {
    if (!identity.bypassRewards) {
      await sql`
        UPDATE users
        SET service_creation_credits = service_creation_credits + 1
        WHERE id = ${identity.userId}
      `;
    }
    return noStoreJson({ ok: false, error: "service_creation_failed" }, 500);
  }
}
