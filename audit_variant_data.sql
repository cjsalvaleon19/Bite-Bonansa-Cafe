-- ============================================================================
-- Variant Data Audit and Cleanup Script
-- Purpose: Identify and clean up invalid variant options (subvariants)
-- ============================================================================

-- ============================================================================
-- PART 1: DIAGNOSTIC QUERIES
-- ============================================================================

-- Show all menu items with their variant types and options count
SELECT 
  mb.id,
  mb.name,
  mb.category,
  mb.has_variants,
  COUNT(DISTINCT vt.id) as variant_types_count,
  COUNT(vo.id) as total_options_count,
  COUNT(CASE WHEN vo.available = true THEN 1 END) as available_options_count,
  COUNT(CASE WHEN vo.available = false THEN 1 END) as unavailable_options_count
FROM menu_items_base mb
LEFT JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
LEFT JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
GROUP BY mb.id, mb.name, mb.category, mb.has_variants
ORDER BY mb.category, mb.name;

-- ============================================================================
-- Show variant types with no options (orphaned variant types)
-- ============================================================================
SELECT 
  mb.name as menu_item,
  mb.category,
  vt.id as variant_type_id,
  vt.variant_type_name,
  COUNT(vo.id) as option_count
FROM menu_item_variant_types vt
JOIN menu_items_base mb ON vt.menu_item_id = mb.id
LEFT JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
GROUP BY mb.name, mb.category, vt.id, vt.variant_type_name
HAVING COUNT(vo.id) = 0
ORDER BY mb.name;

-- ============================================================================
-- Show variant options that reference non-existent variant types
-- (Should not happen due to FK constraint, but checking anyway)
-- ============================================================================
SELECT 
  vo.id as option_id,
  vo.variant_type_id,
  vo.option_name,
  vo.price_modifier,
  vo.available
FROM menu_item_variant_options vo
WHERE NOT EXISTS (
  SELECT 1 FROM menu_item_variant_types vt 
  WHERE vt.id = vo.variant_type_id
);

-- ============================================================================
-- Show all variant options with their complete hierarchy
-- ============================================================================
SELECT 
  mb.name as menu_item,
  mb.category,
  mb.base_price,
  mb.has_variants,
  mb.available as item_available,
  vt.variant_type_name,
  vt.is_required,
  vo.option_name,
  vo.price_modifier,
  vo.available as option_available,
  vo.display_order
FROM menu_items_base mb
JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
ORDER BY mb.category, mb.name, vt.display_order, vo.display_order;

-- ============================================================================
-- PART 2: IDENTIFY PROBLEMATIC DATA
-- ============================================================================

-- Find variant types where ALL options are unavailable
-- (These variant types should probably be removed or have at least one available option)
SELECT 
  mb.name as menu_item,
  vt.variant_type_name,
  vt.is_required,
  COUNT(vo.id) as total_options,
  COUNT(CASE WHEN vo.available = true THEN 1 END) as available_options
FROM menu_item_variant_types vt
JOIN menu_items_base mb ON vt.menu_item_id = mb.id
JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
GROUP BY mb.name, vt.id, vt.variant_type_name, vt.is_required
HAVING COUNT(CASE WHEN vo.available = true THEN 1 END) = 0
ORDER BY mb.name;

-- Find items with has_variants=true but no variant types
SELECT 
  id,
  name,
  category,
  has_variants
FROM menu_items_base
WHERE has_variants = true
  AND NOT EXISTS (
    SELECT 1 FROM menu_item_variant_types vt 
    WHERE vt.menu_item_id = menu_items_base.id
  );

-- Find items with has_variants=false but have variant types
SELECT 
  mb.id,
  mb.name,
  mb.category,
  mb.has_variants,
  COUNT(vt.id) as variant_types_count
FROM menu_items_base mb
JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
WHERE mb.has_variants = false OR mb.has_variants IS NULL
GROUP BY mb.id, mb.name, mb.category, mb.has_variants;

-- ============================================================================
-- Summary Statistics
-- ============================================================================
DO $$
DECLARE
  total_items INTEGER;
  items_with_variants INTEGER;
  total_variant_types INTEGER;
  total_variant_options INTEGER;
  available_variant_options INTEGER;
  orphaned_variant_types INTEGER;
  variant_types_all_unavailable INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_items FROM menu_items_base WHERE available = true;
  SELECT COUNT(DISTINCT id) INTO items_with_variants FROM menu_items_base WHERE has_variants = true AND available = true;
  SELECT COUNT(*) INTO total_variant_types FROM menu_item_variant_types;
  SELECT COUNT(*) INTO total_variant_options FROM menu_item_variant_options;
  SELECT COUNT(*) INTO available_variant_options FROM menu_item_variant_options WHERE available = true;
  
  -- Count orphaned variant types (no options)
  SELECT COUNT(DISTINCT vt.id) INTO orphaned_variant_types
  FROM menu_item_variant_types vt
  LEFT JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
  WHERE vo.id IS NULL;
  
  -- Count variant types where all options are unavailable
  SELECT COUNT(*) INTO variant_types_all_unavailable
  FROM (
    SELECT vt.id
    FROM menu_item_variant_types vt
    JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
    GROUP BY vt.id
    HAVING COUNT(CASE WHEN vo.available = true THEN 1 END) = 0
  ) subquery;

  RAISE NOTICE '================================================================';
  RAISE NOTICE 'VARIANT SYSTEM AUDIT SUMMARY';
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Total menu items (available): %', total_items;
  RAISE NOTICE 'Items with variants: %', items_with_variants;
  RAISE NOTICE 'Total variant types: %', total_variant_types;
  RAISE NOTICE 'Total variant options: %', total_variant_options;
  RAISE NOTICE 'Available variant options: %', available_variant_options;
  RAISE NOTICE 'Unavailable variant options: %', total_variant_options - available_variant_options;
  RAISE NOTICE '';
  RAISE NOTICE 'PROBLEMS DETECTED:';
  RAISE NOTICE 'Orphaned variant types (no options): %', orphaned_variant_types;
  RAISE NOTICE 'Variant types with all options unavailable: %', variant_types_all_unavailable;
  RAISE NOTICE '================================================================';
  
  IF orphaned_variant_types > 0 THEN
    RAISE NOTICE 'ACTION REQUIRED: Delete orphaned variant types';
  END IF;
  
  IF variant_types_all_unavailable > 0 THEN
    RAISE NOTICE 'WARNING: Some variant types have no available options';
    RAISE NOTICE '  This may cause issues if these are required variant types';
  END IF;
END $$;
