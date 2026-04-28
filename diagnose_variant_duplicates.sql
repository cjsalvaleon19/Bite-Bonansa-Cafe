-- ============================================================================
-- Diagnostic Script: Check for Duplicate Variant Types
-- ============================================================================

-- Check Chicken Platter specifically
SELECT 
  '=== CHICKEN PLATTER VARIANT TYPES ===' as section;

SELECT 
  mb.id as menu_id,
  mb.name,
  mb.base_price,
  vt.id as variant_type_id,
  vt.variant_type_name,
  vt.is_required,
  vt.display_order,
  COUNT(vo.id) as option_count
FROM menu_items_base mb
LEFT JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
LEFT JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
WHERE mb.name = 'Chicken Platter'
GROUP BY mb.id, mb.name, mb.base_price, vt.id, vt.variant_type_name, vt.is_required, vt.display_order
ORDER BY vt.display_order;

-- Show all Chicken Platter flavor options
SELECT 
  '=== CHICKEN PLATTER FLAVOR OPTIONS ===' as section;

SELECT 
  vt.id as variant_type_id,
  vt.variant_type_name,
  vo.id as option_id,
  vo.option_name,
  vo.price_modifier,
  vo.display_order
FROM menu_items_base mb
JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
WHERE mb.name = 'Chicken Platter'
  AND vt.variant_type_name = 'Flavor'
ORDER BY vt.id, vo.display_order;

-- Check all Chicken items
SELECT 
  '=== ALL CHICKEN MENU ITEMS ===' as section;

SELECT 
  mb.id,
  mb.name,
  mb.base_price,
  mb.category,
  mb.available,
  COUNT(DISTINCT vt.id) as variant_type_count
FROM menu_items_base mb
LEFT JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
WHERE mb.category = 'Chicken'
GROUP BY mb.id, mb.name, mb.base_price, mb.category, mb.available
ORDER BY mb.name;

-- Check Chicken Burger
SELECT 
  '=== CHICKEN BURGER DETAILS ===' as section;

SELECT 
  mb.name,
  vt.variant_type_name,
  COUNT(vo.id) as option_count,
  STRING_AGG(vo.option_name, ', ' ORDER BY vo.display_order) as options
FROM menu_items_base mb
LEFT JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
LEFT JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
WHERE mb.name = 'Chicken Burger'
GROUP BY mb.name, vt.variant_type_name;

-- Check Fruit Soda & Lemonade
SELECT 
  '=== FRUIT SODA & LEMONADE ITEMS ===' as section;

SELECT 
  mb.id,
  mb.name,
  mb.base_price,
  mb.has_variants,
  COUNT(DISTINCT vt.id) as variant_type_count
FROM menu_items_base mb
LEFT JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
WHERE mb.category = 'Fruit Soda & Lemonade'
GROUP BY mb.id, mb.name, mb.base_price, mb.has_variants
ORDER BY mb.name;
