-- ============================================================================
-- Check Variant System Status
-- This script checks the current state to identify what needs to be fixed
-- ============================================================================

-- 1. Check which tables have data
\echo '========================================='
\echo '1. TABLE ROW COUNTS'
\echo '========================================='
SELECT 'menu_items' as table_name, COUNT(*) as row_count FROM menu_items
UNION ALL
SELECT 'menu_items_base' as table_name, COUNT(*) as row_count FROM menu_items_base
UNION ALL
SELECT 'menu_item_variant_types' as table_name, COUNT(*) as row_count FROM menu_item_variant_types
UNION ALL  
SELECT 'menu_item_variant_options' as table_name, COUNT(*) as row_count FROM menu_item_variant_options;

-- 2. Check if items are in old table
\echo ''
\echo '========================================='
\echo '2. ITEMS IN OLD menu_items TABLE'
\echo '========================================='
SELECT id, name, category, price, available 
FROM menu_items 
WHERE available = true
ORDER BY category, name;

-- 3. Check items in new base table
\echo ''
\echo '========================================='
\echo '3. ITEMS IN NEW menu_items_base TABLE'
\echo '========================================='
SELECT id, name, category, base_price, has_variants, available
FROM menu_items_base
WHERE available = true
ORDER BY category, name;

-- 4. Check for items with variants but has_variants=false
\echo ''
\echo '========================================='
\echo '4. ITEMS WITH VARIANT MISMATCH'
\echo '========================================='
SELECT 
  mb.id,
  mb.name,
  mb.category,
  mb.has_variants,
  COUNT(DISTINCT vt.id) as variant_types_count,
  COUNT(vo.id) as total_options
FROM menu_items_base mb
LEFT JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
LEFT JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
WHERE (mb.has_variants = false OR mb.has_variants IS NULL)
GROUP BY mb.id, mb.name, mb.category, mb.has_variants
HAVING COUNT(DISTINCT vt.id) > 0
ORDER BY mb.category, mb.name;

-- 5. Show complete variant structure for drinks (to verify Size + Add-ons)
\echo ''
\echo '========================================='
\echo '5. BEVERAGE ITEMS WITH VARIANTS'
\echo '========================================='
SELECT 
  mb.name as item_name,
  mb.base_price,
  mb.has_variants,
  vt.variant_type_name,
  vt.is_required,
  vt.allow_multiple,
  vo.option_name,
  vo.price_modifier
FROM menu_items_base mb
LEFT JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
LEFT JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
WHERE mb.category = 'Beverages' AND mb.available = true
ORDER BY mb.name, vt.display_order, vo.display_order;
