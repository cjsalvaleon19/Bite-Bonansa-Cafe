-- ============================================================================
-- Migration: Delete Barbeque Flavor for Fries
-- Description: Removes the Barbeque flavor variant option from Fries menu item
-- ============================================================================

DO $$
DECLARE
  fries_id UUID;
  flavor_type_id UUID;
  barbeque_option_id UUID;
BEGIN
  -- Get Fries menu item ID
  SELECT id INTO fries_id
  FROM menu_items_base
  WHERE name = 'Fries' AND category = 'Snacks & Bites'
  LIMIT 1;

  IF fries_id IS NOT NULL THEN
    -- Get Flavor variant type ID for Fries
    SELECT id INTO flavor_type_id
    FROM menu_item_variant_types
    WHERE menu_item_id = fries_id
      AND variant_type_name = 'Flavor'
    LIMIT 1;

    IF flavor_type_id IS NOT NULL THEN
      -- Get Barbeque flavor option ID
      SELECT id INTO barbeque_option_id
      FROM menu_item_variant_options
      WHERE variant_type_id = flavor_type_id
        AND option_name = 'Barbeque'
      LIMIT 1;

      IF barbeque_option_id IS NOT NULL THEN
        -- Delete the Barbeque flavor option
        DELETE FROM menu_item_variant_options
        WHERE id = barbeque_option_id;

        RAISE NOTICE 'Successfully deleted Barbeque flavor for Fries (ID: %)', barbeque_option_id;
      ELSE
        RAISE NOTICE 'Barbeque flavor not found for Fries';
      END IF;
    ELSE
      RAISE NOTICE 'Flavor variant type not found for Fries';
    END IF;
  ELSE
    RAISE NOTICE 'Fries menu item not found';
  END IF;
END $$;

-- ============================================================================
-- Verification: Ensure Barbeque flavor is deleted
-- ============================================================================

DO $$
DECLARE
  remaining_barbeque_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_barbeque_count
  FROM menu_item_variant_options vo
  JOIN menu_item_variant_types vt ON vo.variant_type_id = vt.id
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Fries'
    AND vt.variant_type_name = 'Flavor'
    AND vo.option_name = 'Barbeque';

  IF remaining_barbeque_count = 0 THEN
    RAISE NOTICE 'Verification passed: Barbeque flavor successfully deleted from Fries';
  ELSE
    RAISE WARNING 'Verification failed: % Barbeque flavor(s) still exist for Fries', remaining_barbeque_count;
  END IF;
END $$;
