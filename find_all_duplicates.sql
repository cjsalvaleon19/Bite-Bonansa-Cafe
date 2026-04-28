-- ============================================================================
-- Diagnostic Script: Find All Duplicate Menu Items and Variants
-- Purpose: Identify duplicate menu items with different prices and duplicate variants
-- ============================================================================

-- ============================================================================
-- PART 1: Find Duplicate Menu Items (same name, different prices)
-- ============================================================================
SELECT 
  '=== DUPLICATE MENU ITEMS (SAME NAME, DIFFERENT PRICES) ===' as section;

SELECT 
  name,
  category,
  base_price,
  id,
  available,
  has_variants,
  created_at
FROM menu_items_base
WHERE name IN (
  SELECT name
  FROM menu_items_base
  WHERE available = true
  GROUP BY name, category
  HAVING COUNT(*) > 1
)
ORDER BY name, created_at;

-- ============================================================================
-- PART 2: Find Chicken Platter Variants (to identify duplicates)
-- ============================================================================
SELECT 
  '=== CHICKEN PLATTER VARIANT ANALYSIS ===' as section;

-- Get Chicken Platter menu item IDs
SELECT 
  mb.id,
  mb.name,
  mb.base_price,
  mb.has_variants,
  mb.created_at,
  COUNT(DISTINCT vt.id) as variant_type_count,
  COUNT(vo.id) as total_variant_options
FROM menu_items_base mb
LEFT JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
LEFT JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
WHERE mb.name LIKE '%Chicken Platter%'
GROUP BY mb.id, mb.name, mb.base_price, mb.has_variants, mb.created_at
ORDER BY mb.created_at;

-- ============================================================================
-- PART 3: Show All Chicken Platter Variant Types and Options
-- ============================================================================
SELECT 
  '=== CHICKEN PLATTER VARIANT TYPES AND OPTIONS ===' as section;

SELECT 
  mb.id as menu_item_id,
  mb.name as menu_item_name,
  mb.base_price,
  mb.created_at as item_created_at,
  vt.id as variant_type_id,
  vt.variant_type_name,
  vt.is_required,
  vt.display_order as type_display_order,
  vo.id as variant_option_id,
  vo.option_name,
  vo.price_modifier,
  vo.available,
  vo.display_order as option_display_order
FROM menu_items_base mb
JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
WHERE mb.name LIKE '%Chicken Platter%'
ORDER BY mb.created_at, vt.variant_type_name, vo.display_order;

-- ============================================================================
-- PART 4: Find Duplicate Variant Options (same option name within same variant type)
-- ============================================================================
SELECT 
  '=== DUPLICATE VARIANT OPTIONS ===' as section;

SELECT 
  mb.name as menu_item_name,
  vt.variant_type_name,
  vo.option_name,
  COUNT(*) as duplicate_count,
  STRING_AGG(vo.id::text, ', ') as option_ids,
  STRING_AGG(vo.price_modifier::text, ', ') as price_modifiers
FROM menu_item_variant_options vo
JOIN menu_item_variant_types vt ON vo.variant_type_id = vt.id
JOIN menu_items_base mb ON vt.menu_item_id = mb.id
GROUP BY mb.name, vt.variant_type_name, vo.option_name
HAVING COUNT(*) > 1
ORDER BY mb.name, vt.variant_type_name, vo.option_name;

-- ============================================================================
-- PART 5: Summary Statistics
-- ============================================================================
DO $$
DECLARE
  total_items INTEGER;
  duplicate_items INTEGER;
  chicken_platter_count INTEGER;
  total_variant_options INTEGER;
  chicken_variant_options INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_items FROM menu_items_base WHERE available = true;
  
  SELECT COUNT(*) INTO duplicate_items FROM (
    SELECT name, category
    FROM menu_items_base
    WHERE available = true
    GROUP BY name, category
    HAVING COUNT(*) > 1
  ) subquery;
  
  SELECT COUNT(*) INTO chicken_platter_count 
  FROM menu_items_base 
  WHERE name LIKE '%Chicken Platter%';
  
  SELECT COUNT(*) INTO total_variant_options FROM menu_item_variant_options;
  
  SELECT COUNT(*) INTO chicken_variant_options
  FROM menu_item_variant_options vo
  JOIN menu_item_variant_types vt ON vo.variant_type_id = vt.id
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name LIKE '%Chicken Platter%';

  RAISE NOTICE '================================================================';
  RAISE NOTICE 'DUPLICATE DATA SUMMARY';
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Total available menu items: %', total_items;
  RAISE NOTICE 'Menu items with duplicates: %', duplicate_items;
  RAISE NOTICE 'Chicken Platter entries: %', chicken_platter_count;
  RAISE NOTICE 'Total variant options: %', total_variant_options;
  RAISE NOTICE 'Chicken Platter variant options: %', chicken_variant_options;
  RAISE NOTICE '================================================================';
END $$;
