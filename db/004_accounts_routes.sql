ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS service_creation_credits integer NOT NULL DEFAULT 0;

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
);

CREATE INDEX IF NOT EXISTS idx_script_routes_service ON script_routes(service_id);
