-- Create app_config table for global application settings
-- This stores system-wide settings like "Simple Mode" for Postage Plus users

CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default settings
INSERT INTO app_config (key, value, description) VALUES
  ('simple_printing_mode', 'false', 'When enabled, in-process printing becomes manual entry like OHP (for Postage Plus users)'),
  ('company_mode', '"postage_plus"', 'Company mode: postage_plus or printout - affects UI and features')
ON CONFLICT (key) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_app_config_key ON app_config(key);
