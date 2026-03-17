-- Quote Revisions Table
CREATE TABLE IF NOT EXISTS public.quote_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL DEFAULT 1,
  project_name TEXT NOT NULL DEFAULT '',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  quantity INTEGER,
  job_meta JSONB,
  change_summary TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(quote_id, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_quote_revisions_quote_id 
  ON public.quote_revisions (quote_id, revision_number DESC);
