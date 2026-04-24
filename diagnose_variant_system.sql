-- ============================================================================
-- Variant System Diagnostic Script
-- Run this to check the current state of the variant system
-- ============================================================================

-- ============================================================================
-- 1. CHECK IF TABLES EXIST
-- ============================================================================
SELECT 
  'menu_items_base' as table_name,
  COUNT(*) as row_count
FROM menu_items_base
UNION ALL
SELECT 
  'menu_item_variant_types' as table_name,
  COUNT(*) as row_count
FROM menu_item_variant_types
UNION ALL
SELECT 
  'menu_item_variant_options' as table_name,
  COUNT(*) as row_count
FROM menu_item_variant_options;

-- ============================================================================
-- 2. LIST ALL ITEMS IN menu_items_base
-- ============================================================================
SELECT 
  id,
  name,
  category,
  base_price,
  has_variants,
  available,
  description
FROM menu_items_base
ORDER BY category, name;

-- ============================================================================
-- 3. ITEMS WITH MISMATCH: has_variants=false BUT have variant types
-- ============================================================================
SELECT 
  mb.id,
  mb.name,
  mb.category,
  mb.has_variants,
  COUNT(DISTINCT vt.id) as variant_types_count,
  COUNT(vo.id) as variant_options_count
FROM menu_items_base mb
LEFT JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
LEFT JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
WHERE (mb.has_variants = false OR mb.has_variants IS NULL)
GROUP BY mb.id, mb.name, mb.category, mb.has_variants
HAVING COUNT(DISTINCT vt.id) > 0
ORDER BY mb.category, mb.name;

-- ============================================================================
-- 4. COMPLETE VARIANT STRUCTURE VIEW
-- ============================================================================
SELECT 
  mb.name as item_name,
  mb.category,
  mb.base_price,
  mb.has_variants,
  vt.variant_type_name,
  vt.is_required,
  vt.allow_multiple,
  vo.option_name,
  vo.price_modifier,
  vo.available as option_available
FROM menu_items_base mb
LEFT JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
LEFT JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
ORDER BY mb.category, mb.name, vt.display_order, vo.display_order;

-- ============================================================================
-- 5. SUMMARY BY CATEGORY
-- ============================================================================
SELECT 
  mb.category,
  COUNT(DISTINCT mb.id) as total_items,
  COUNT(DISTINCT CASE WHEN mb.has_variants THEN mb.id END) as items_with_variants,
  COUNT(DISTINCT vt.id) as total_variant_types,
  COUNT(vo.id) as total_variant_options
FROM menu_items_base mb
LEFT JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
LEFT JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
GROUP BY mb.category
ORDER BY mb.category;

-- ============================================================================
-- 6. CHECK OLD menu_items TABLE
-- ============================================================================
-- This shows if you're still using the old structure
SELECT 
  'Old menu_items table' as note,
  COUNT(*) as row_count
FROM menu_items
WHERE available = true;

-- List items in old table
SELECT 
  id,
  name,
  category,
  price,
  available
FROM menu_items
WHERE available = true
ORDER BY category, name
LIMIT 20;

-- ============================================================================
-- 7. SPECIFIC ITEMS FROM SCREENSHOT
-- ============================================================================
-- Check for the specific items visible in the screenshot
SELECT 
  mb.name,
  mb.category,
  mb.base_price,
  mb.has_variants,
  mb.description,
  COUNT(DISTINCT vt.id) as variant_types,
  STRING_AGG(DISTINCT vt.variant_type_name, ', ') as variant_type_names
FROM menu_items_base mb
LEFT JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
WHERE mb.name IN ('Chicken Burger', 'Chicken Meals', 'Chicken Platter')
GROUP BY mb.id, mb.name, mb.category, mb.base_price, mb.has_variants, mb.description;

-- ============================================================================
-- 8. RECOMMENDATIONS
-- ============================================================================
DO $$
DECLARE
  base_count INTEGER;
  variant_types_count INTEGER;
  mismatch_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO base_count FROM menu_items_base WHERE available = true;
  SELECT COUNT(DISTINCT menu_item_id) INTO variant_types_count FROM menu_item_variant_types;
  
  SELECT COUNT(DISTINCT mb.id) INTO mismatch_count
  FROM menu_items_base mb
  JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
  WHERE (mb.has_variants = false OR mb.has_variants IS NULL);
  
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'VARIANT SYSTEM DIAGNOSTIC SUMMARY';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Available items in menu_items_base: %', base_count;
  RAISE NOTICE 'Items with variant types defined: %', variant_types_count;
  RAISE NOTICE 'Items with MISMATCH (has_variants=false but variants exist): %', mismatch_count;
  RAISE NOTICE '';
  
  IF base_count = 0 THEN
    RAISE NOTICE 'ACTION REQUIRED: menu_items_base table is empty!';
    RAISE NOTICE '  → Run complete_menu_variants_migration.sql';
  ELSIF mismatch_count > 0 THEN
    RAISE NOTICE 'ACTION REQUIRED: % items have variants but has_variants flag is false', mismatch_count;
    RAISE NOTICE '  → Run fix_has_variants_flag.sql';
  ELSE
    RAISE NOTICE 'SUCCESS: All items with variants have has_variants=true';
    RAISE NOTICE '  → Variant system should be working correctly';
  END IF;
  RAISE NOTICE '============================================================';
END $$;
