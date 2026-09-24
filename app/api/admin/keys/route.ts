import { isAdmin } from "@/lib/admin";
import { sql } from "@/lib/db";
import { digest, noStoreJson, opaque } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isAdmin(req.headers)) return noStoreJson({ ok: false, error: "unauthorized" }, 401);

  let body: {
    serviceId?: string;
    expiresAt?: string | null;
    robloxUserId?: string | null;
    robloxUsername?: string | null;
    discordUserId?: string | null;
  };
  try { body = await req.json(); } catch { return noStoreJson({ ok: false, error: "invalid_json" }, 400); }
  if (!body.serviceId) return noStoreJson({ ok: false, error: "missing_service_id" }, 400);

  const key = opaque("CLM", 24);
  const rows = await sql`
    INSERT INTO license_keys(
      service_id, key_hash, roblox_user_id, roblox_username, discord_user_id, expires_at
    ) VALUES (
      ${body.serviceId},
      ${digest(key)},
      ${body.robloxUserId || null},
      ${body.robloxUsername || null},
      ${body.discordUserId || null},
      ${body.expiresAt || null}
    )
    RETURNING id, service_id, expires_at, created_at
  `;

  return noStoreJson({ ok: true, license: rows[0], key }, 201);
}
