-- Migration: Add Short sizes to papers that need them for booklet/perfect binding
-- Short sizes are used for book inside pages with different imposition

-- Update 20lb Offset - add Short 11x17
UPDATE papers 
SET 
  available_sizes = array_append(
    CASE WHEN NOT ('Short 11x17' = ANY(available_sizes)) THEN available_sizes ELSE available_sizes END,
    'Short 11x17'
  ),
  prices = prices || '{"Short 11x17": 0.0184}'::jsonb
WHERE name = '20lb Offset' AND NOT ('Short 11x17' = ANY(available_sizes));

-- Update 60lb Offset - add Short 12x18 and Short 12.5x19
UPDATE papers 
SET 
  available_sizes = (
    SELECT array_agg(DISTINCT s) FROM unnest(
      available_sizes || ARRAY['Short 12x18', 'Short 12.5x19']
    ) AS s
  ),
  prices = prices || '{"Short 12x18": 0.0360, "Short 12.5x19": 0.0410}'::jsonb
WHERE name = '60lb Offset';

-- Update 70lb Offset - add Short 11x17 and Short 12x18
UPDATE papers 
SET 
  available_sizes = (
    SELECT array_agg(DISTINCT s) FROM unnest(
      available_sizes || ARRAY['Short 11x17', 'Short 12x18']
    ) AS s
  ),
  prices = prices || '{"Short 11x17": 0.037, "Short 12x18": 0.042}'::jsonb
WHERE name = '70lb Offset';

-- Update 80lb Text Gloss - add Short 11x17 and Short 12x18
UPDATE papers 
SET 
  available_sizes = (
    SELECT array_agg(DISTINCT s) FROM unnest(
      available_sizes || ARRAY['Short 11x17', 'Short 12x18']
    ) AS s
  ),
  prices = prices || '{"Short 11x17": 0.0523, "Short 12x18": 0.0523}'::jsonb
WHERE name = '80lb Text Gloss';

-- Update 100lb Text Gloss - add Short 11x17 and Short 12x18
UPDATE papers 
SET 
  available_sizes = (
    SELECT array_agg(DISTINCT s) FROM unnest(
      available_sizes || ARRAY['Short 11x17', 'Short 12x18']
    ) AS s
  ),
  prices = prices || '{"Short 11x17": 0.0675, "Short 12x18": 0.0675}'::jsonb
WHERE name = '100lb Text Gloss';

-- Also update papers by similar naming patterns if they exist

-- 50lb Offset - Short 11x17 and Short 12x18
UPDATE papers 
SET 
  available_sizes = (
    SELECT array_agg(DISTINCT s) FROM unnest(
      available_sizes || ARRAY['Short 11x17', 'Short 12x18']
    ) AS s
  ),
  prices = prices || '{"Short 11x17": 0.025, "Short 12x18": 0.029}'::jsonb
WHERE name ILIKE '%50lb%Offset%' OR name ILIKE '%50 lb%Offset%';

-- 80lb Text Matte - same as 80lb Text Gloss
UPDATE papers 
SET 
  available_sizes = (
    SELECT array_agg(DISTINCT s) FROM unnest(
      available_sizes || ARRAY['Short 11x17', 'Short 12x18']
    ) AS s
  ),
  prices = prices || '{"Short 11x17": 0.0523, "Short 12x18": 0.0523}'::jsonb
WHERE name ILIKE '%80lb%Text%Matte%' OR name ILIKE '%80 lb%Text%Matte%';

-- 100lb Text Matte - same as 100lb Text Gloss
UPDATE papers 
SET 
  available_sizes = (
    SELECT array_agg(DISTINCT s) FROM unnest(
      available_sizes || ARRAY['Short 11x17', 'Short 12x18']
    ) AS s
  ),
  prices = prices || '{"Short 11x17": 0.0675, "Short 12x18": 0.0675}'::jsonb
WHERE name ILIKE '%100lb%Text%Matte%' OR name ILIKE '%100 lb%Text%Matte%';

-- Verify changes
SELECT name, available_sizes, prices 
FROM papers 
WHERE available_sizes::text ILIKE '%Short%'
ORDER BY name;
