-- ============================================================================
-- Migration: 026_enable_has_variants_flag
-- Description: Ensures all menu items with variant types have has_variants=true
-- Created: 2026-04-28
-- 
-- This migration:
-- 1. Updates has_variants flag for items that have variant types defined
-- 2. Creates a view for Menu Item Variant Type Summary
-- ============================================================================

-- Update menu items that have variant types but has_variants is not set to true
UPDATE menu_items_base
SET has_variants = true
WHERE id IN (
  SELECT DISTINCT menu_item_id
  FROM menu_item_variant_types
)
AND (has_variants = false OR has_variants IS NULL);

-- Create or replace a view for Menu Item Variant Type Summary
-- This view shows all menu items with their variant types and options
CREATE OR REPLACE VIEW menu_item_variant_summary AS
SELECT 
  mb.id as menu_item_id,
  mb.name as item_name,
  mb.category,
  mb.base_price,
  mb.has_variants,
  mb.available,
  mb.is_sold_out,
  vt.id as variant_type_id,
  vt.variant_type_name,
  vt.is_required,
  vt.allow_multiple,
  vt.display_order as variant_type_order,
  vo.id as variant_option_id,
  vo.option_name,
  vo.price_modifier,
  vo.available as option_available,
  vo.display_order as option_order
FROM menu_items_base mb
LEFT JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
LEFT JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
ORDER BY mb.category, mb.name, vt.display_order, vo.display_order;

-- Grant access to the view
GRANT SELECT ON menu_item_variant_summary TO anon, authenticated;

-- Add comment to document the view
COMMENT ON VIEW menu_item_variant_summary IS 'Complete view of menu items with their variant types and options. Use this for displaying variant information in the UI.';

-- Verify the update with a notice
DO $$
DECLARE
  items_with_variants INTEGER;
  items_updated INTEGER;
BEGIN
  SELECT COUNT(DISTINCT mb.id) INTO items_with_variants
  FROM menu_items_base mb
  JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
  WHERE mb.has_variants = true;
  
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'has_variants Flag Update Complete';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Items with variants properly flagged: %', items_with_variants;
  RAISE NOTICE 'View menu_item_variant_summary created successfully';
  RAISE NOTICE '============================================================';
END $$;
