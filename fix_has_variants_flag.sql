-- ============================================================================
-- Fix has_variants Flag
-- This script ensures all menu items with variant types have has_variants=true
-- ============================================================================

-- Update menu items that have variant types but has_variants is not set to true
UPDATE menu_items_base
SET has_variants = true
WHERE id IN (
  SELECT DISTINCT menu_item_id
  FROM menu_item_variant_types
)
AND (has_variants = false OR has_variants IS NULL);

-- Verify the update
SELECT 
  mb.id,
  mb.name,
  mb.category,
  mb.base_price,
  mb.has_variants,
  COUNT(DISTINCT vt.id) as variant_types_count,
  COUNT(vo.id) as total_options
FROM menu_items_base mb
LEFT JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
LEFT JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
GROUP BY mb.id, mb.name, mb.category, mb.base_price, mb.has_variants
HAVING COUNT(DISTINCT vt.id) > 0
ORDER BY mb.category, mb.name;

-- ============================================================================
-- RESULT: Shows all items that now have has_variants=true with their variants
-- ============================================================================
