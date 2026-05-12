-- ============================================================================
-- Migration: 141_add_siomaisilog_style_subvariant
-- Description: Add "Siomai Style" variant type for Silog Meals with options
--              "Fried" and "Steamed" (both with no additional price).
--              Selection is enforced in UI only when Variety is Siomaisilog.
-- Created: 2026-05-12
-- ============================================================================

WITH silog_item AS (
  SELECT id
  FROM menu_items_base
  WHERE name = 'Silog Meals' AND category = 'Rice & More'
  LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Siomai Style', false, false, 2
FROM silog_item
WHERE NOT EXISTS (
  SELECT 1
  FROM menu_item_variant_types vt
  WHERE vt.menu_item_id = (SELECT id FROM silog_item)
    AND vt.variant_type_name = 'Siomai Style'
);

WITH siomai_style_type AS (
  SELECT vt.id
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Silog Meals'
    AND mb.category = 'Rice & More'
    AND vt.variant_type_name = 'Siomai Style'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
SELECT
  sst.id,
  option_data.option_name,
  0,
  true,
  option_data.display_order
FROM siomai_style_type sst
CROSS JOIN (
  VALUES
    ('Fried', 1),
    ('Steamed', 2)
) AS option_data(option_name, display_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM menu_item_variant_options vo
  WHERE vo.variant_type_id = sst.id
    AND vo.option_name = option_data.option_name
);
