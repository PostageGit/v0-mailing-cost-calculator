-- Add allowed_sides column to papers table
-- This column stores which sides options are available for each paper

ALTER TABLE papers 
ADD COLUMN IF NOT EXISTS allowed_sides text[] DEFAULT ARRAY['S/S', 'D/S', '4/4', '4/0', '1/1', '1/0'];

-- Update existing cardstock papers to have cardstock-appropriate sides
UPDATE papers 
SET allowed_sides = ARRAY['4/4', '4/0', '1/1', '1/0']
WHERE is_cardstock = true;

-- Update existing text papers to have all sides options
UPDATE papers 
SET allowed_sides = ARRAY['S/S', 'D/S', '4/4', '4/0', '1/1', '1/0']
WHERE is_cardstock = false;
