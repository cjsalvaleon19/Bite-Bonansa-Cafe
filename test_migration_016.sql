-- ============================================================================
-- Test Script for Migration 016
-- Validates the menu update migration structure
-- ============================================================================

-- Test 1: Verify all Add-ons variant types now allow multiple selection
SELECT 
  'Test 1: Add-ons allow_multiple' AS test_name,
  COUNT(*) AS count,
  CASE 
    WHEN COUNT(*) = 0 THEN 'PASS - No Add-ons with allow_multiple=false found'
    ELSE 'FAIL - Found Add-ons with allow_multiple=false'
  END AS result
FROM menu_item_variant_types
WHERE variant_type_name = 'Add Ons' AND allow_multiple = false;

-- Test 2: Verify "No Add Ons" option has been removed
SELECT 
  'Test 2: No Add Ons removed' AS test_name,
  COUNT(*) AS count,
  CASE 
    WHEN COUNT(*) = 0 THEN 'PASS - No "No Add Ons" options found'
    ELSE 'FAIL - Found "No Add Ons" options'
  END AS result
FROM menu_item_variant_options
WHERE option_name = 'No Add Ons';

-- Test 3: Verify Extra Rice add-on exists for Silog Meals
SELECT 
  'Test 3: Extra Rice for Silog Meals' AS test_name,
  COUNT(*) AS count,
  CASE 
    WHEN COUNT(*) > 0 THEN 'PASS - Extra Rice add-on found for Silog Meals'
    ELSE 'FAIL - Extra Rice add-on not found for Silog Meals'
  END AS result
FROM menu_item_variant_options vo
JOIN menu_item_variant_types vt ON vo.variant_type_id = vt.id
JOIN menu_items_base mb ON vt.menu_item_id = mb.id
WHERE mb.name = 'Silog Meals' 
  AND mb.category = 'Rice & More'
  AND vt.variant_type_name = 'Add-ons'
  AND vo.option_name = 'Extra Rice';

-- Test 4: Verify Nachos has no Add-ons variant type
SELECT 
  'Test 4: Nachos no Add-ons' AS test_name,
  COUNT(*) AS count,
  CASE 
    WHEN COUNT(*) = 0 THEN 'PASS - Nachos has no Add-ons variant type'
    ELSE 'FAIL - Nachos still has Add-ons variant type'
  END AS result
FROM menu_item_variant_types vt
JOIN menu_items_base mb ON vt.menu_item_id = mb.id
WHERE mb.name = 'Nachos' 
  AND vt.variant_type_name IN ('Add-ons', 'Add Ons');

-- Test 5: Verify new Frappe Series items count (should be 7)
SELECT 
  'Test 5: Frappe Series count' AS test_name,
  COUNT(*) AS count,
  CASE 
    WHEN COUNT(*) >= 7 THEN 'PASS - Found expected Frappe Series items'
    ELSE 'FAIL - Not all Frappe Series items found'
  END AS result
FROM menu_items_base
WHERE category = 'Frappe Series'
  AND name IN (
    'Red Velvet Frappe',
    'Ube Taro Frappe',
    'Dark Chocolate Frappe',
    'Mocha Frappe',
    'Mocha Latte Frappe',
    'Lotus Biscoff Frappe',
    'Mango Graham Frappe'
  );

-- Test 6: Verify Frappe Series items have Add Ons variant type with allow_multiple=true
SELECT 
  'Test 6: Frappe Add-ons multiple' AS test_name,
  COUNT(*) AS count,
  CASE 
    WHEN COUNT(*) >= 7 THEN 'PASS - Frappe items have Add Ons with allow_multiple'
    ELSE 'FAIL - Not all Frappe items have proper Add Ons setup'
  END AS result
FROM menu_item_variant_types vt
JOIN menu_items_base mb ON vt.menu_item_id = mb.id
WHERE mb.category = 'Frappe Series'
  AND vt.variant_type_name = 'Add Ons'
  AND vt.allow_multiple = true;

-- Test 7: Verify new Fruit Soda & Lemonade items count (should be 11)
SELECT 
  'Test 7: Fruit Soda count' AS test_name,
  COUNT(*) AS count,
  CASE 
    WHEN COUNT(*) >= 11 THEN 'PASS - Found expected Fruit Soda items'
    ELSE 'FAIL - Not all Fruit Soda items found'
  END AS result
FROM menu_items_base
WHERE category = 'Fruit Soda & Lemonade'
  AND name IN (
    'Strawberry Soda',
    'Green Apple Soda',
    'Blue Lemonade Soda',
    'Lychee Soda',
    'Blueberry Soda',
    'Passion Fruit Soda',
    'Lemonade Juice',
    'Lemon Strawberry Juice',
    'Lemon Blueberry Juice',
    'Lemon Passion Fruit Juice',
    'Lemon Yogurt Slush'
  );

-- Test 8: Verify Fruit Soda items have NO Add-ons variant type
SELECT 
  'Test 8: Fruit Soda no Add-ons' AS test_name,
  COUNT(*) AS count,
  CASE 
    WHEN COUNT(*) = 0 THEN 'PASS - Fruit Soda items have no Add-ons'
    ELSE 'FAIL - Some Fruit Soda items have Add-ons'
  END AS result
FROM menu_item_variant_types vt
JOIN menu_items_base mb ON vt.menu_item_id = mb.id
WHERE mb.category = 'Fruit Soda & Lemonade'
  AND vt.variant_type_name IN ('Add-ons', 'Add Ons');

-- Test 9: List all Frappe Series items with their variants
SELECT 
  mb.name,
  mb.base_price,
  vt.variant_type_name,
  vt.is_required,
  vt.allow_multiple,
  COUNT(vo.id) AS option_count
FROM menu_items_base mb
LEFT JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
LEFT JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
WHERE mb.category = 'Frappe Series'
GROUP BY mb.id, mb.name, mb.base_price, vt.id, vt.variant_type_name, vt.is_required, vt.allow_multiple
ORDER BY mb.name, vt.display_order;

-- Test 10: List all Fruit Soda items with their variants
SELECT 
  mb.name,
  mb.base_price,
  vt.variant_type_name,
  vt.is_required,
  vt.allow_multiple,
  COUNT(vo.id) AS option_count
FROM menu_items_base mb
LEFT JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
LEFT JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
WHERE mb.category = 'Fruit Soda & Lemonade'
GROUP BY mb.id, mb.name, mb.base_price, vt.id, vt.variant_type_name, vt.is_required, vt.allow_multiple
ORDER BY mb.name, vt.display_order;

-- Test 11: Summary - Count menu items per category
SELECT 
  category,
  COUNT(*) AS item_count
FROM menu_items_base
GROUP BY category
ORDER BY category;
