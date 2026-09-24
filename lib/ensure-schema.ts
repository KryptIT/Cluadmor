import { sql } from "@/lib/db";

let ready: Promise<void> | null = null;

export function ensureWorkspaceSchema() {
  if (!ready) {
    ready = (async () => {
      await sql`
        ALTER TABLE users
          ADD COLUMN IF NOT EXISTS password_hash text,
          ADD COLUMN IF NOT EXISTS display_name text,
          ADD COLUMN IF NOT EXISTS avatar_url text,
          ADD COLUMN IF NOT EXISTS obfuscation_credits integer NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS service_creation_credits integer NOT NULL DEFAULT 0
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS service_scripts (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
          name text NOT NULL,
          source_ciphertext text NOT NULL,
          obfuscated_ciphertext text,
          obfuscated_at timestamptz,
          obfuscation_preset text NOT NULL DEFAULT 'executor',
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;

      await sql`
        ALTER TABLE service_scripts
          ADD COLUMN IF NOT EXISTS obfuscated_ciphertext text,
          ADD COLUMN IF NOT EXISTS obfuscated_at timestamptz,
          ADD COLUMN IF NOT EXISTS obfuscation_preset text NOT NULL DEFAULT 'executor'
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS script_routes (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
          script_id uuid NOT NULL REFERENCES service_scripts(id) ON DELETE CASCADE,
          match_type text NOT NULL CHECK (match_type IN ('PLACE','UNIVERSE','DEFAULT')),
          match_value text NOT NULL DEFAULT '',
          priority integer NOT NULL DEFAULT 0,
          enabled boolean NOT NULL DEFAULT true,
          created_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE(service_id, match_type, match_value)
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS oauth_accounts (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          provider text NOT NULL CHECK (provider IN ('google','discord')),
          provider_user_id text NOT NULL,
          email text,
          display_name text,
          avatar_url text,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE(provider, provider_user_id)
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS service_loaders (
          service_id uuid PRIMARY KEY REFERENCES services(id) ON DELETE CASCADE,
          loader_ciphertext text NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS telemetry_events (
          id bigserial PRIMARY KEY,
          service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
          key_id uuid REFERENCES license_keys(id) ON DELETE SET NULL,
          script_id uuid REFERENCES service_scripts(id) ON DELETE SET NULL,
          event_type text NOT NULL CHECK (
            event_type IN ('AUTH_SUCCESS','AUTH_REJECTED','SCRIPT_DELIVERY','ROUTE_MISS')
          ),
          hwid_hash text,
          ip_hash text,
          place_id text,
          universe_id text,
          route_type text,
          reason text,
          metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_scripts_service
        ON service_scripts(service_id)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_script_routes_service
        ON script_routes(service_id)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user
        ON oauth_accounts(user_id)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS idx_telemetry_service_created
        ON telemetry_events(service_id, created_at DESC)
      `;
    })().catch(error => {
      ready = null;
      throw error;
    });
  }

  return ready;
}
