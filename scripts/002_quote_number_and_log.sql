-- Add sequential quote number to quotes table (starting at 1001)
-- Create quote_activity_log table for key milestone tracking

-- 1. Create a sequence starting at 1001
CREATE SEQUENCE IF NOT EXISTS public.quote_number_seq START WITH 1001;

-- 2. Add quote_number column with default from sequence
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS quote_number INTEGER UNIQUE DEFAULT nextval('public.quote_number_seq');

-- 3. Backfill existing rows that have NULL quote_number
UPDATE public.quotes
  SET quote_number = nextval('public.quote_number_seq')
  WHERE quote_number IS NULL;

-- 4. Make it NOT NULL after backfill
ALTER TABLE public.quotes
  ALTER COLUMN quote_number SET NOT NULL;

-- 5. Create activity log table
CREATE TABLE IF NOT EXISTS public.quote_activity_log (
  id SERIAL PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  event TEXT NOT NULL CHECK (event IN ('created', 'sent', 'approved', 'completed', 'copied', 'status_changed')),
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quote_activity_log_quote_id
  ON public.quote_activity_log (quote_id, created_at DESC);

-- 6. Trigger: auto-log 'created' when a new quote is inserted
CREATE OR REPLACE FUNCTION public.log_quote_created()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.quote_activity_log (quote_id, event, detail)
  VALUES (NEW.id, 'created', 'Quote Q-' || NEW.quote_number || ' created');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_quote_created_log ON public.quotes;

CREATE TRIGGER trigger_quote_created_log
  AFTER INSERT ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.log_quote_created();
