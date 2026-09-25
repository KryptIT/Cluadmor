import { sql } from "@/lib/db";
import { digest } from "@/lib/security";

export async function ensurePublicAccessKey(serviceId: string) {
  const keyHash = digest("public-access:" + serviceId);

  const rows = await sql`
    INSERT INTO license_keys(service_id, key_hash, system_managed)
    VALUES (${serviceId}, ${keyHash}, true)
    ON CONFLICT (key_hash)
    DO UPDATE SET
      revoked_at = NULL,
      expires_at = NULL,
      system_managed = true
    RETURNING id, service_id, hwid_hash, roblox_user_id, roblox_username,
              discord_user_id, expires_at, revoked_at, system_managed
  `;

  return rows[0] as any;
}
