-- Add is_internal flag to vendors table
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT FALSE;

-- Seed the 3 PrintOut locations as internal vendors
INSERT INTO vendors (company_name, is_internal, terms, quoting_contacts, cc_all_quoting, pickup_cost, custom_fields)
VALUES
  ('PrintOut RSH', true, 'Net 30', '[]'::jsonb, false, 0, '{}'::jsonb),
  ('PrintOut Main St', true, 'Net 30', '[]'::jsonb, false, 0, '{}'::jsonb),
  ('PrintOut Bedford', true, 'Net 30', '[]'::jsonb, false, 0, '{}'::jsonb)
ON CONFLICT (company_name) DO UPDATE SET is_internal = true;
