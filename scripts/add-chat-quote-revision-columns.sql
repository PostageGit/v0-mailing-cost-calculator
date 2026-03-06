-- Add revision tracking columns to chat_quotes table
ALTER TABLE chat_quotes ADD COLUMN IF NOT EXISTS parent_quote_id uuid REFERENCES chat_quotes(id);
ALTER TABLE chat_quotes ADD COLUMN IF NOT EXISTS revision_number integer DEFAULT 0;
ALTER TABLE chat_quotes ADD COLUMN IF NOT EXISTS revised_by text;
