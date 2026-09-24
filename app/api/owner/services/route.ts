import { sql } from "@/lib/db";
import { ownerFromRequest } from "@/lib/owner";
import { digest, noStoreJson, opaque } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ownerUserId() {
  const rows = await sql`
    INSERT INTO users(username)
    VALUES ('__claudmor_owner__')
    ON CONFLICT (username) DO UPDATE SET username = EXCLUDED.username
    RETURNING id
  `;
  return String((rows[0] as any).id);
}

export async function GET(req: Request) {
  if (!ownerFromRequest(req)) return noStoreJson({ ok: false, error: "owner_required" }, 401);
  const ownerId = await ownerUserId();
  const rows = await sql`
    SELECT id, name, enabled, require_hwid, require_roblox_user_id,
           require_roblox_username, require_discord_user_id, created_at
    FROM services
    WHERE owner_id = ${ownerId}
    ORDER BY created_at DESC
  `;
  return noStoreJson({ ok: true, services: rows });
}

export async function POST(req: Request) {
  if (!ownerFromRequest(req)) return noStoreJson({ ok: false, error: "owner_required" }, 401);

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

  const ownerId = await ownerUserId();
  const secret = opaque("CLMS", 32);

  const rows = await sql`
    INSERT INTO services(
      owner_id, name, secret_hash, require_hwid, require_roblox_user_id,
      require_roblox_username, require_discord_user_id
    )
    VALUES (
      ${ownerId}, ${name}, ${digest(secret)}, ${body.requireHwid !== false},
      ${!!body.requireRobloxUserId}, ${!!body.requireRobloxUsername},
      ${!!body.requireDiscordUserId}
    )
    RETURNING id, name, enabled, require_hwid, require_roblox_user_id,
              require_roblox_username, require_discord_user_id, created_at
  `;

  return noStoreJson({ ok: true, service: rows[0], serviceSecret: secret }, 201);
}
