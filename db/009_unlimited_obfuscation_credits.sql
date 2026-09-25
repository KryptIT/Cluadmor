ALTER TABLE users
  ADD COLUMN IF NOT EXISTS unlimited_obfuscation_credits boolean NOT NULL DEFAULT false;
