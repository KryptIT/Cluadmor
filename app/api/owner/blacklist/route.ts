import {
  BlacklistKind,
  blacklistHint,
  blacklistValueHash,
  ensureBlacklistSchema,
  normalizeBlacklistValue
} from "@/lib/blacklist";
import { sql } from "@/lib/db";
import { noStoreJson } from "@/lib/security";
import { workspaceIdentity } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ownerIdentity(req: Request) {
  await ensureBlacklistSchema();

  const identity = await workspaceIdentity(req);

  if (!identity) {
    return { error: noStoreJson({ ok: false, error: "login_required" }, 401) };
  }

  if (!identity.owner) {
    return { error: noStoreJson({ ok: false, error: "owner_required" }, 403) };
  }

  return { identity };
}

export async function GET(req: Request) {
  const owned = await ownerIdentity(req);
  if ("error" in owned) return owned.error;

  const entries = await sql`
    SELECT id, kind, value_hint, reason, created_at
    FROM owner_blacklist
    ORDER BY created_at DESC
    LIMIT 200
  `;

  const recentBlocks = await sql`
    SELECT te.reason, te.created_at, s.name AS service_name,
           te.hwid_hash, te.ip_hash
    FROM telemetry_events te
    JOIN services s ON s.id = te.service_id
    WHERE s.owner_id = ${owned.identity.userId}
      AND te.reason IN (
        'blacklisted_ip',
        'blacklisted_hwid',
        'blacklisted_roblox_user',
        'blacklisted_discord_user',
        'blacklisted_account'
      )
    ORDER BY te.created_at DESC
    LIMIT 30
  `;

  return noStoreJson({ ok: true, entries, recentBlocks });
}

export async function POST(req: Request) {
  const owned = await ownerIdentity(req);
  if ("error" in owned) return owned.error;

  let body: {
    kind?: string;
    value?: string;
    reason?: string;
  };

  try {
    body = await req.json();
  } catch {
    return noStoreJson({ ok: false, error: "invalid_json" }, 400);
  }

  let kind = String(body.kind || "").trim().toUpperCase();
  const value = String(body.value || "").trim();
  const reason = String(body.reason || "").trim().slice(0, 300);

  if (!kind || !value) {
    return noStoreJson({ ok: false, error: "missing_fields" }, 400);
  }

  let storedKind: BlacklistKind;
  let normalized = value;
  let hint = "";

  if (kind === "ACCOUNT_EMAIL") {
    const users = await sql`
      SELECT id, email
      FROM users
      WHERE lower(email) = lower(${value})
      LIMIT 1
    `;

    if (!users[0]) {
      return noStoreJson({ ok: false, error: "account_not_found" }, 404);
    }

    const user = users[0] as any;

    if (String(user.id) === owned.identity.userId) {
      return noStoreJson({ ok: false, error: "cannot_blacklist_self" }, 400);
    }

    storedKind = "ACCOUNT_USER_ID";
    normalized = String(user.id);
    hint = String(user.email || value);
  } else {
    const allowed = [
      "IP",
      "HWID",
      "ROBLOX_USER_ID",
      "DISCORD_USER_ID",
      "ACCOUNT_USER_ID"
    ];

    if (!allowed.includes(kind)) {
      return noStoreJson({ ok: false, error: "invalid_blacklist_kind" }, 400);
    }

    storedKind = kind as BlacklistKind;
    normalized = normalizeBlacklistValue(storedKind, value);

    if (
      storedKind === "ACCOUNT_USER_ID" &&
      normalized === owned.identity.userId
    ) {
      return noStoreJson({ ok: false, error: "cannot_blacklist_self" }, 400);
    }

    hint = blacklistHint(storedKind, normalized);
  }

  if (!normalized) {
    return noStoreJson({ ok: false, error: "invalid_blacklist_value" }, 400);
  }

  const rows = await sql`
    INSERT INTO owner_blacklist(
      kind,
      value_hash,
      value_hint,
      reason,
      created_by
    )
    VALUES (
      ${storedKind},
      ${blacklistValueHash(storedKind, normalized)},
      ${hint},
      ${reason || null},
      ${owned.identity.userId}
    )
    ON CONFLICT(kind, value_hash)
    DO UPDATE SET
      value_hint = EXCLUDED.value_hint,
      reason = EXCLUDED.reason,
      created_by = EXCLUDED.created_by,
      created_at = now()
    RETURNING id, kind, value_hint, reason, created_at
  `;

  return noStoreJson({ ok: true, entry: rows[0] }, 201);
}

export async function DELETE(req: Request) {
  const owned = await ownerIdentity(req);
  if ("error" in owned) return owned.error;

  let body: { id?: string };

  try {
    body = await req.json();
  } catch {
    return noStoreJson({ ok: false, error: "invalid_json" }, 400);
  }

  if (!body.id) {
    return noStoreJson({ ok: false, error: "missing_id" }, 400);
  }

  const rows = await sql`
    DELETE FROM owner_blacklist
    WHERE id = ${body.id}
    RETURNING id
  `;

  if (!rows[0]) {
    return noStoreJson({ ok: false, error: "not_found" }, 404);
  }

  return noStoreJson({ ok: true });
}
