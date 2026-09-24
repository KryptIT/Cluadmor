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
);

CREATE INDEX IF NOT EXISTS idx_telemetry_service_created
  ON telemetry_events(service_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_service_type_created
  ON telemetry_events(service_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_service_hwid
  ON telemetry_events(service_id, hwid_hash)
  WHERE hwid_hash IS NOT NULL;
