-- Add sort_order column to quotes for card ordering within columns
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- Initialize sort_order based on created_at for existing quotes
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY column_id ORDER BY created_at) as rn
  FROM quotes
)
UPDATE quotes SET sort_order = ordered.rn
FROM ordered WHERE quotes.id = ordered.id;
