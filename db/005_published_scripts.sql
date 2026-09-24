ALTER TABLE service_scripts
  ADD COLUMN IF NOT EXISTS published_ciphertext text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;
