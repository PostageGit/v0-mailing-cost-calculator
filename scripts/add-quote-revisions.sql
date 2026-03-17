-- Quote Revisions Table
-- Stores full history of quote changes for comparison and audit trail

-- 1. Add current_revision column to quotes table
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS current_revision INTEGER NOT NULL DEFAULT 1;

-- 2. Create quote_revisions table to store all versions
CREATE TABLE IF NOT EXISTS public.quote_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL DEFAULT 1,
  
  -- Snapshot of quote data at this revision
  project_name TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  quantity INTEGER,
  
  -- Mailing state snapshot
  job_meta JSONB,
  
  -- Change tracking
  change_summary TEXT, -- Brief description of what changed
  created_by TEXT, -- Who made this revision
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Unique constraint: one revision number per quote
  UNIQUE(quote_id, revision_number)
);

-- Index for fast lookup of revisions by quote
CREATE INDEX IF NOT EXISTS idx_quote_revisions_quote_id 
  ON public.quote_revisions (quote_id, revision_number DESC);

-- 3. Log revision events in activity log
ALTER TABLE public.quote_activity_log 
  DROP CONSTRAINT IF EXISTS quote_activity_log_event_check;

ALTER TABLE public.quote_activity_log 
  ADD CONSTRAINT quote_activity_log_event_check 
  CHECK (event IN ('created', 'sent', 'approved', 'completed', 'copied', 'status_changed', 'revised'));
