-- ============================================================================
-- Migration: 135_add_mild_addon_to_americano
-- Description: Add "Mild" as an optional Add Ons subvariant for Americano
--              with no additional price (price_modifier = 0)
-- Created: 2026-05-11
-- ============================================================================

WITH addon_type AS (
  SELECT vt.id FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Americano' AND mb.category = 'Hot/Iced Drinks'
    AND vt.variant_type_name = 'Add Ons'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT id, 'Mild', 0, true, 2 FROM addon_type
WHERE NOT EXISTS (
  SELECT 1 FROM menu_item_variant_options vo
  WHERE vo.variant_type_id = (SELECT id FROM addon_type)
    AND vo.option_name = 'Mild'
);
