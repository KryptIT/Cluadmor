import { sql } from "@/lib/db";
import { ensureWorkspaceSchema } from "@/lib/ensure-schema";
import { digest, noStoreJson, opaque } from "@/lib/security";
import { workspaceIdentity } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UI_MODES = ["DEFAULT", "CUSTOM"] as const;

export async function GET(req: Request) {
  await ensureWorkspaceSchema();
  const identity = await workspaceIdentity(req);
  if (!identity) return noStoreJson({ ok: false, error: "login_required" }, 401);

  const rows = await sql`
    SELECT id, name, enabled, key_system_enabled, key_ui_mode,
           require_hwid, require_roblox_user_id,
           require_roblox_username, require_discord_user_id, created_at
    FROM services
    WHERE owner_id = ${identity.userId}
    ORDER BY created_at DESC
  `;

  return noStoreJson({ ok: true, ownerBypass: identity.bypassRewards, services: rows });
}

export async function POST(req: Request) {
  await ensureWorkspaceSchema();
  const identity = await workspaceIdentity(req);
  if (!identity) return noStoreJson({ ok: false, error: "login_required" }, 401);

  let body: {
    name?: string;
    enabled?: boolean;
    keySystemEnabled?: boolean;
    keyUiMode?: "DEFAULT" | "CUSTOM";
    requireHwid?: boolean;
    requireRobloxUserId?: boolean;
    requireRobloxUsername?: boolean;
    requireDiscordUserId?: boolean;
  };

  try { body = await req.json(); }
  catch { return noStoreJson({ ok: false, error: "invalid_json" }, 400); }

  const name = String(body.name || "").trim();
  if (name.length < 2 || name.length > 80) return noStoreJson({ ok: false, error: "invalid_name" }, 400);

  const keyUiMode = UI_MODES.includes(body.keyUiMode as any) ? body.keyUiMode! : "DEFAULT";

  if (!identity.bypassRewards) {
    const debit = await sql`
      UPDATE users
      SET service_creation_credits = service_creation_credits - 1
      WHERE id = ${identity.userId} AND service_creation_credits > 0
      RETURNING service_creation_credits
    `;
    if (!debit[0]) return noStoreJson({ ok: false, error: "service_creation_credit_required" }, 402);
  }

  const secret = opaque("CLMS", 32);

  try {
    const rows = await sql`
      INSERT INTO services(
        owner_id, name, secret_hash, enabled, key_system_enabled, key_ui_mode,
        require_hwid, require_roblox_user_id, require_roblox_username, require_discord_user_id
      )
      VALUES (
        ${identity.userId}, ${name}, ${digest(secret)}, ${body.enabled !== false},
        ${body.keySystemEnabled !== false}, ${keyUiMode}, ${body.requireHwid !== false},
        ${!!body.requireRobloxUserId}, ${!!body.requireRobloxUsername}, ${!!body.requireDiscordUserId}
      )
      RETURNING id, name, enabled, key_system_enabled, key_ui_mode,
                require_hwid, require_roblox_user_id, require_roblox_username,
                require_discord_user_id, created_at
    `;

    return noStoreJson({ ok: true, service: rows[0], ownerBypass: identity.bypassRewards }, 201);
  } catch (error: any) {
    if (!identity.bypassRewards) {
      try {
        await sql`
          UPDATE users SET service_creation_credits = service_creation_credits + 1
          WHERE id = ${identity.userId}
        `;
      } catch {}
    }

    const message = String(error?.message || "");
    if (message.includes("CLAUDMOR_MASTER_SECRET")) {
      return noStoreJson({ ok: false, error: "server_configuration_error", detail: "Server encryption is not configured correctly." }, 503);
    }
    return noStoreJson({ ok: false, error: "service_creation_failed" }, 500);
  }
}

export async function PATCH(req: Request) {
  await ensureWorkspaceSchema();
  const identity = await workspaceIdentity(req);
  if (!identity) return noStoreJson({ ok: false, error: "login_required" }, 401);

  let body: { serviceId?: string; enabled?: boolean; keySystemEnabled?: boolean; keyUiMode?: "DEFAULT" | "CUSTOM" };
  try { body = await req.json(); }
  catch { return noStoreJson({ ok: false, error: "invalid_json" }, 400); }

  if (!body.serviceId) return noStoreJson({ ok: false, error: "missing_service_id" }, 400);
  if (body.keyUiMode !== undefined && !UI_MODES.includes(body.keyUiMode as any)) {
    return noStoreJson({ ok: false, error: "invalid_key_ui_mode" }, 400);
  }

  const rows = await sql`
    UPDATE services
    SET enabled = COALESCE(${body.enabled ?? null}, enabled),
        key_system_enabled = COALESCE(${body.keySystemEnabled ?? null}, key_system_enabled),
        key_ui_mode = COALESCE(${body.keyUiMode ?? null}, key_ui_mode)
    WHERE id = ${body.serviceId}
      AND owner_id = ${identity.userId}
    RETURNING id, name, enabled, key_system_enabled, key_ui_mode,
              require_hwid, require_roblox_user_id, require_roblox_username,
              require_discord_user_id, created_at
  `;

  if (!rows[0]) return noStoreJson({ ok: false, error: "service_not_owned" }, 404);
  return noStoreJson({ ok: true, service: rows[0] });
}
