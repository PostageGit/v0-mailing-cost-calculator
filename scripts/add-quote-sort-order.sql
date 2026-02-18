-- Add sort_order column to quotes for card ordering within columns
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;
