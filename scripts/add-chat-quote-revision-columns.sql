-- Add revision tracking columns to chat_quotes table
-- This allows chat quotes to be revised manually with a linked parent

ALTER TABLE chat_quotes 
ADD COLUMN IF NOT EXISTS parent_quote_id uuid REFERENCES chat_quotes(id),
ADD COLUMN IF NOT EXISTS revision_number integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS revised_by text;

-- Create index for efficient revision lookups
CREATE INDEX IF NOT EXISTS idx_chat_quotes_parent_id ON chat_quotes(parent_quote_id);

-- Add comment for documentation
COMMENT ON COLUMN chat_quotes.parent_quote_id IS 'References the original quote if this is a revision';
COMMENT ON COLUMN chat_quotes.revision_number IS '0 for originals, 1+ for revisions';
COMMENT ON COLUMN chat_quotes.revised_by IS 'Username or identifier of who created the revision';
