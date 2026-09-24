CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE,
  username text UNIQUE,
  obfuscation_credits integer NOT NULL DEFAULT 0 CHECK (obfuscation_credits >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  secret_hash text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  require_hwid boolean NOT NULL DEFAULT true,
  require_roblox_user_id boolean NOT NULL DEFAULT false,
  require_roblox_username boolean NOT NULL DEFAULT false,
  require_discord_user_id boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS license_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  key_hash text NOT NULL UNIQUE,
  hwid_hash text,
  roblox_user_id text,
  roblox_username text,
  discord_user_id text,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bootstrap_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  key_id uuid NOT NULL REFERENCES license_keys(id) ON DELETE CASCADE,
  ticket_hash text NOT NULL UNIQUE,
  hwid_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reward_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_type text NOT NULL CHECK (reward_type IN ('SERVICE_CREATION','OBFUSCATION')),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','COMPLETED','EXPIRED')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lootlabs_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_session_id uuid NOT NULL REFERENCES reward_sessions(id) ON DELETE CASCADE,
  unique_id text NOT NULL UNIQUE,
  click_id text NOT NULL,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id bigserial PRIMARY KEY,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  key_id uuid REFERENCES license_keys(id) ON DELETE SET NULL,
  kind text NOT NULL,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_keys_service ON license_keys(service_id);
CREATE INDEX IF NOT EXISTS idx_tickets_expiry ON bootstrap_tickets(expires_at);
CREATE INDEX IF NOT EXISTS idx_rewards_user ON reward_sessions(user_id);
