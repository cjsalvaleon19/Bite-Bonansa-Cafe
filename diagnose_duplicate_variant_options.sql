-- ============================================================================
-- Diagnostic Query: Find Duplicate Variant Options
-- Description: Identify all duplicate variant options before running migration 030
-- ============================================================================

-- This query finds all variant options that have duplicates
-- (same option_name for the same variant_type_id)

SELECT 
  vt.menu_item_id,
  mb.name as menu_item_name,
  vt.variant_type_name,
  vo.option_name,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(vo.id ORDER BY vo.id DESC) as option_ids,
  ARRAY_AGG(vo.price_modifier) as price_modifiers,
  ARRAY_AGG(vo.display_order) as display_orders
FROM menu_item_variant_options vo
JOIN menu_item_variant_types vt ON vo.variant_type_id = vt.id
JOIN menu_items_base mb ON vt.menu_item_id = mb.id
GROUP BY vt.menu_item_id, mb.name, vt.variant_type_name, vo.option_name
HAVING COUNT(*) > 1
ORDER BY mb.name, vt.variant_type_name, vo.option_name;

-- ============================================================================
-- Summary Count
-- ============================================================================

-- Count total duplicate variant option groups
SELECT 
  COUNT(*) as total_duplicate_groups,
  SUM(option_count - 1) as total_duplicates_to_delete
FROM (
  SELECT 
    variant_type_id,
    option_name,
    COUNT(*) as option_count
  FROM menu_item_variant_options
  GROUP BY variant_type_id, option_name
  HAVING COUNT(*) > 1
) duplicates;

-- ============================================================================
-- Breakdown by Menu Item
-- ============================================================================

-- Count duplicates per menu item
SELECT 
  mb.name as menu_item_name,
  COUNT(DISTINCT vo.option_name) as duplicate_option_count,
  SUM(option_count - 1) as total_duplicates
FROM (
  SELECT 
    variant_type_id,
    option_name,
    COUNT(*) as option_count
  FROM menu_item_variant_options
  GROUP BY variant_type_id, option_name
  HAVING COUNT(*) > 1
) duplicates
JOIN menu_item_variant_types vt ON duplicates.variant_type_id = vt.id
JOIN menu_items_base mb ON vt.menu_item_id = mb.id
GROUP BY mb.name
ORDER BY total_duplicates DESC, mb.name;
