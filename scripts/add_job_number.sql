-- Add job_number column for activated jobs
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS job_number INTEGER;
