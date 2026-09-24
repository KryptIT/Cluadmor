ALTER TABLE users
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

ALTER TABLE service_scripts
  ADD COLUMN IF NOT EXISTS obfuscated_ciphertext text,
  ADD COLUMN IF NOT EXISTS obfuscated_at timestamptz,
  ADD COLUMN IF NOT EXISTS obfuscation_preset text NOT NULL DEFAULT 'executor';

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
);

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user
  ON oauth_accounts(user_id);

CREATE TABLE IF NOT EXISTS service_loaders (
  service_id uuid PRIMARY KEY REFERENCES services(id) ON DELETE CASCADE,
  loader_ciphertext text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
