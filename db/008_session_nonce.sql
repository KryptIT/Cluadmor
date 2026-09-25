ALTER TABLE bootstrap_tickets
  ADD COLUMN IF NOT EXISTS session_jti text,
  ADD COLUMN IF NOT EXISTS client_nonce_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_session_jti ON bootstrap_tickets(session_jti);

CREATE INDEX IF NOT EXISTS idx_telemetry_ip_created ON telemetry_events(ip_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS runtime_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  key_id uuid NOT NULL REFERENCES license_keys(id) ON DELETE CASCADE,
  hwid_hash text NOT NULL,
  client_nonce_hash text,
  token_hash text NOT NULL UNIQUE,
  watermark text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoke_reason text,
  last_beat_at timestamptz,
  beat_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runtime_sessions_key ON runtime_sessions(key_id);
CREATE INDEX IF NOT EXISTS idx_runtime_sessions_expiry ON runtime_sessions(expires_at);
