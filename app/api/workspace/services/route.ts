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
  await ensureWorkspaceSchema();
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
      ownerBypass: identity.bypassRewards
    }, 201);
  } catch (error: any) {
    if (!identity.bypassRewards) {
      try {
        await sql`
          UPDATE users
          SET service_creation_credits = service_creation_credits + 1
          WHERE id = ${identity.userId}
        `;
      } catch {}
    }

    const code = String(error?.code || "");
    const message = String(error?.message || "");

    if (code === "42703" || code === "42P01") {
      return noStoreJson({
        ok: false,
        error: "database_migration_required",
        detail: "Run db/004_accounts_routes.sql and db/003_owner_scripts.sql against your Neon database."
      }, 503);
    }

    if (message.includes("CLAUDMOR_MASTER_SECRET")) {
      return noStoreJson({
        ok: false,
        error: "server_configuration_error",
        detail: "CLAUDMOR_MASTER_SECRET must be configured and at least 32 characters."
      }, 503);
    }

    return noStoreJson({ ok: false, error: "service_creation_failed" }, 500);
  }
}
