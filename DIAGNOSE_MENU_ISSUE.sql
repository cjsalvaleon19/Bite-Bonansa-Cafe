-- ============================================================================
-- DIAGNOSE MENU ISSUE - Run this in Supabase SQL Editor
-- ============================================================================
-- This script will help diagnose why menu items aren't showing in the customer order page
-- Copy and paste sections one at a time to check different aspects

-- ============================================================================
-- STEP 1: Check if menu_items_base table has data
-- ============================================================================
SELECT 
    COUNT(*) as total_items,
    COUNT(CASE WHEN available = true THEN 1 END) as available_items,
    COUNT(CASE WHEN available = true AND COALESCE(is_sold_out, false) = false THEN 1 END) as available_not_sold_out
FROM menu_items_base;

-- Expected: At least 85 total items, 85 available, 85 available_not_sold_out
-- If you get 0, the database hasn't been seeded with menu items

-- ============================================================================
-- STEP 2: Check if menu_items VIEW exists
-- ============================================================================
SELECT EXISTS (
    SELECT 1 
    FROM information_schema.views 
    WHERE table_schema = 'public' 
    AND table_name = 'menu_items'
) as view_exists;

-- Expected: true
-- If false, the menu_items view hasn't been created

-- ============================================================================
-- STEP 3: Try querying the menu_items view
-- ============================================================================
SELECT 
    COUNT(*) as total_items_from_view
FROM menu_items
WHERE available = true 
AND COALESCE(is_sold_out, false) = false;

-- Expected: Around 85 items
-- If you get an error "relation menu_items does not exist", the view wasn't created
-- If you get 0, there's a mismatch between the view and the base table

-- ============================================================================
-- STEP 4: Check menu items by category
-- ============================================================================
SELECT 
    category,
    COUNT(*) as item_count,
    COUNT(CASE WHEN has_variants = true THEN 1 END) as items_with_variants
FROM menu_items_base
WHERE available = true
AND COALESCE(is_sold_out, false) = false
GROUP BY category
ORDER BY category;

-- Expected categories:
-- - Snacks & Bites: 4 items
-- - Noodles: 9 items
-- - Chicken: 3 items
-- - Rice & More: 7 items
-- - Milktea Series: 15 items
-- - Hot/Iced Drinks: 19 items
-- - Frappe Series: 14 items
-- - Fruit Soda & Lemonade: 13 items

-- ============================================================================
-- STEP 5: Sample menu items to verify data
-- ============================================================================
SELECT 
    name,
    category,
    base_price,
    available,
    has_variants,
    COALESCE(is_sold_out, false) as is_sold_out
FROM menu_items_base
WHERE available = true
ORDER BY category, name
LIMIT 20;

-- Expected: You should see items like Nachos, Fries, Chicken Meals, etc.

-- ============================================================================
-- STEP 6: Check for variant data
-- ============================================================================
SELECT 
    mb.name as menu_item,
    mb.has_variants,
    COUNT(DISTINCT mvt.id) as variant_types,
    COUNT(DISTINCT mvo.id) as variant_options
FROM menu_items_base mb
LEFT JOIN menu_item_variant_types mvt ON mvt.menu_item_id = mb.id
LEFT JOIN menu_item_variant_options mvo ON mvo.variant_type_id = mvt.id
WHERE mb.available = true
AND mb.has_variants = true
GROUP BY mb.id, mb.name, mb.has_variants
ORDER BY mb.name
LIMIT 10;

-- Expected: Items with has_variants=true should have variant_types >= 1 and variant_options >= 1

-- ============================================================================
-- STEP 7: Check categories table
-- ============================================================================
SELECT 
    id,
    name,
    sort_order
FROM categories
ORDER BY sort_order;

-- Expected: Should return categories in sorted order
-- If empty or error, categories haven't been set up

-- ============================================================================
-- DIAGNOSIS SUMMARY
-- ============================================================================
-- Based on the results above:
--
-- If STEP 1 shows 0 items:
--   → Run migrations 012, 013, 014, 015, 016 to seed menu items
--   → See MENU_TROUBLESHOOTING.md for detailed instructions
--
-- If STEP 2 shows false (view doesn't exist):
--   → Run migration 023 to create the menu_items view
--
-- If STEP 1 shows items but STEP 3 shows 0:
--   → There's an issue with the menu_items view definition
--   → Re-run migration 023 or create view manually
--
-- If STEP 4 shows wrong category counts:
--   → Some items may be missing or duplicated
--   → Run migration 028 to clean up duplicates
--
-- If STEP 6 shows items with has_variants=true but 0 variant types:
--   → Variant data is missing
--   → Re-run migration 012 and subsequent variant migrations
--
-- If STEP 7 shows empty or error:
--   → Run migration 024 to create categories table
--   → Categories are optional; items can work without them
-- ============================================================================
