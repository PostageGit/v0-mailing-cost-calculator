-- Add allowed_sides column to papers table
-- This column stores which sides options are available for each paper
-- e.g., ["S/S", "D/S"] for text papers, ["4/4", "4/0"] for cardstock

ALTER TABLE papers 
ADD COLUMN IF NOT EXISTS allowed_sides text[] DEFAULT ARRAY['S/S', 'D/S', '4/4', '4/0', '1/1', '1/0'];

-- Update existing cardstock papers to have cardstock-appropriate sides
UPDATE papers 
SET allowed_sides = ARRAY['4/4', '4/0', '1/1', '1/0']
WHERE is_cardstock = true AND allowed_sides = ARRAY['S/S', 'D/S', '4/4', '4/0', '1/1', '1/0'];

-- Update existing text papers to have text-appropriate sides
UPDATE papers 
SET allowed_sides = ARRAY['S/S', 'D/S', '4/4', '4/0', '1/1', '1/0']
WHERE is_cardstock = false AND allowed_sides = ARRAY['S/S', 'D/S', '4/4', '4/0', '1/1', '1/0'];

-- Add comment for documentation
COMMENT ON COLUMN papers.allowed_sides IS 'Array of allowed sides options for this paper. Common values: S/S, D/S (text), 4/4, 4/0, 1/1, 1/0 (cardstock)';
