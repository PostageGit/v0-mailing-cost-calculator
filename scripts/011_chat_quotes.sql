-- Add source column to quotes to distinguish chat-created quotes from manual ones
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

-- Add chat_specs column to store the raw specs from the chat calculator
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS chat_specs JSONB;

-- Index for filtering chat quotes
CREATE INDEX IF NOT EXISTS idx_quotes_source ON public.quotes (source);
