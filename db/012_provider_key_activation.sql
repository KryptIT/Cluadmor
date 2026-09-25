ALTER TABLE provider_key_sessions
  ADD COLUMN IF NOT EXISTS activation_hash text UNIQUE,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz;
