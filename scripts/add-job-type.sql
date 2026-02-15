-- Add job_type column to quotes table
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS job_type text NOT NULL DEFAULT 'mailing';
