ALTER TABLE quotes ADD COLUMN IF NOT EXISTS voided boolean DEFAULT false;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS voided_at timestamp with time zone;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS voided_reason text;
