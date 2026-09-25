ALTER TABLE services
  ADD COLUMN IF NOT EXISTS key_system_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS key_ui_mode text NOT NULL DEFAULT 'DEFAULT';

ALTER TABLE license_keys
  ADD COLUMN IF NOT EXISTS system_managed boolean NOT NULL DEFAULT false;
