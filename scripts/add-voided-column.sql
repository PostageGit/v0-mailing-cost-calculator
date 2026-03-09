-- Add voided columns to quotes table for soft-delete with audit trail
-- Voided quotes are preserved for data integrity (no missing job/quote data)

ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS voided boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS voided_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS voided_reason text;

-- Create index for filtering voided quotes
CREATE INDEX IF NOT EXISTS idx_quotes_voided ON quotes(voided) WHERE voided = false;

-- Comment for documentation
COMMENT ON COLUMN quotes.voided IS 'Whether the quote has been voided (soft-deleted for audit trail)';
COMMENT ON COLUMN quotes.voided_at IS 'Timestamp when the quote was voided';
COMMENT ON COLUMN quotes.voided_reason IS 'Optional reason for voiding the quote';
