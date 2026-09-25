import { sql } from "@/lib/db";
import { digest, normalizeHwid } from "@/lib/security";

export type BlacklistKind =
  | "IP"
  | "HWID"
  | "ROBLOX_USER_ID"
  | "DISCORD_USER_ID"
  | "ACCOUNT_USER_ID";

let ready: Promise<void> | null = null;

export function ensureBlacklistSchema() {
  if (!ready) {
    ready = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS owner_blacklist (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          kind text NOT NULL,
          value_hash text NOT NULL,
          value_hint text NOT NULL,
          reason text,
          created_by uuid REFERENCES users(id) ON DELETE SET NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE(kind, value_hash)
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_owner_blacklist_kind_hash
        ON owner_blacklist(kind, value_hash)
      `;
    })().catch(error => {
      ready = null;
      throw error;
    });
  }

  return ready;
}

export function normalizeBlacklistValue(kind: BlacklistKind, value: string) {
  const raw = String(value || "").trim();
  if (kind === "HWID") return normalizeHwid(raw);
  if (kind === "IP") return raw.toLowerCase();
  return raw;
}

export function blacklistValueHash(kind: BlacklistKind, value: string) {
  const normalized = normalizeBlacklistValue(kind, value);
  return normalized ? digest(`blacklist:${kind}:${normalized}`) : "";
}

export function blacklistHint(kind: BlacklistKind, value: string) {
  const normalized = normalizeBlacklistValue(kind, value);
  if (!normalized) return "empty";

  if (kind === "IP") {
    if (normalized.includes(":")) {
      return normalized.length > 18 ? normalized.slice(0, 18) + "..." : normalized;
    }
    const parts = normalized.split(".");
    return parts.length === 4
      ? `${parts[0]}.${parts[1]}.${parts[2]}.*`
      : normalized.slice(0, 18);
  }

  if (kind === "HWID") {
    return normalized.length > 12
      ? normalized.slice(0, 6) + "..." + normalized.slice(-4)
      : normalized;
  }

  return normalized.length > 12 ? "..." + normalized.slice(-10) : normalized;
}

export function blacklistError(kind: string) {
  switch (kind) {
    case "IP": return "blacklisted_ip";
    case "HWID": return "blacklisted_hwid";
    case "ROBLOX_USER_ID": return "blacklisted_roblox_user";
    case "DISCORD_USER_ID": return "blacklisted_discord_user";
    case "ACCOUNT_USER_ID": return "blacklisted_account";
    default: return "blacklisted";
  }
}

export async function findRuntimeBlacklist(input: {
  ip?: string;
  hwid?: string;
  robloxUserId?: string;
  discordUserId?: string;
}) {
  await ensureBlacklistSchema();

  const ipHash = blacklistValueHash("IP", input.ip || "");
  const hwidHash = blacklistValueHash("HWID", input.hwid || "");
  const robloxHash = blacklistValueHash("ROBLOX_USER_ID", input.robloxUserId || "");
  const discordHash = blacklistValueHash("DISCORD_USER_ID", input.discordUserId || "");

  const rows = await sql`
    SELECT id, kind, reason, value_hint, created_at
    FROM owner_blacklist
    WHERE
      (kind = 'IP' AND value_hash = ${ipHash})
      OR (kind = 'HWID' AND value_hash = ${hwidHash})
      OR (kind = 'ROBLOX_USER_ID' AND value_hash = ${robloxHash})
      OR (kind = 'DISCORD_USER_ID' AND value_hash = ${discordHash})
    ORDER BY
      CASE kind
        WHEN 'IP' THEN 0
        WHEN 'HWID' THEN 1
        WHEN 'ROBLOX_USER_ID' THEN 2
        WHEN 'DISCORD_USER_ID' THEN 3
        ELSE 4
      END
    LIMIT 1
  `;

  return (rows[0] as any) || null;
}

export async function isAccountBlacklisted(userId: string) {
  await ensureBlacklistSchema();
  const valueHash = blacklistValueHash("ACCOUNT_USER_ID", userId);

  const rows = await sql`
    SELECT id
    FROM owner_blacklist
    WHERE kind = 'ACCOUNT_USER_ID'
      AND value_hash = ${valueHash}
    LIMIT 1
  `;

  return !!rows[0];
}
