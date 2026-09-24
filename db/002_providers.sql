CREATE TABLE IF NOT EXISTS service_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('lootlabs','linkvertise','boostellar')),
  enabled boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  api_key_ciphertext text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(service_id, provider)
);

CREATE TABLE IF NOT EXISTS service_key_settings (
  service_id uuid PRIMARY KEY REFERENCES services(id) ON DELETE CASCADE,
  key_duration_minutes integer NOT NULL DEFAULT 1440 CHECK (key_duration_minutes >= 1),
  max_resets integer NOT NULL DEFAULT 2 CHECK (max_resets >= 0),
  require_hwid boolean NOT NULL DEFAULT true,
  require_roblox_user_id boolean NOT NULL DEFAULT false,
  require_roblox_username boolean NOT NULL DEFAULT false,
  require_discord_user_id boolean NOT NULL DEFAULT false,
  provider_mode text NOT NULL DEFAULT 'ANY' CHECK (provider_mode IN ('ANY','SEQUENTIAL','RANDOM')),
  provider_completions_required integer NOT NULL DEFAULT 1 CHECK (provider_completions_required >= 1),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_providers_service
ON service_providers(service_id);
