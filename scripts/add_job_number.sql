-- Add job_number column and sequence for activated jobs
CREATE SEQUENCE IF NOT EXISTS public.job_number_seq START WITH 5001;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS job_number INTEGER UNIQUE;

-- Backfill existing jobs that are already activated
UPDATE public.quotes
SET job_number = nextval('public.job_number_seq')
WHERE is_job = true AND job_number IS NULL;
