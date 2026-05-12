-- ============================================================================
-- Migration 144: Fix JSON field extraction operators in track_customer_item_purchases
-- ============================================================================
-- Problem:
--   The live database contains a version of track_customer_item_purchases() that
--   uses the single-arrow operator  ->  (returns jsonb) for every JSON field
--   access, e.g.:
--
--       item->'id'        → jsonb  (e.g. "\"some-uuid\"" with surrounding quotes)
--       item->'quantity'  → jsonb
--       item->'price'     → jsonb
--
--   The function then passes those jsonb values to COALESCE(..., '') where the
--   second argument is text.  PostgreSQL raises at runtime:
--
--       ERROR: COALESCE types jsonb and text cannot be matched
--
--   This error is caught by the EXCEPTION WHEN OTHERS block so it does NOT
--   block the order status update, but it means purchase tracking silently
--   records NOTHING for every completed order.
--
--   Additionally, LOWER(valid_items.menu_item_id_text)::UUID fails because the
--   jsonb value includes surrounding double-quotes (e.g. "\"abc-...\""::UUID).
--
-- Root cause:
--   Migration 142 should have written ->> (double-arrow, returns text) but the
--   version stored in the database has -> (single-arrow, returns jsonb).  The
--   migration file on disk is correct; the discrepancy means 142 was either not
--   applied or was applied with corrupted characters.
--
-- Fix:
--   Drop and recreate track_customer_item_purchases() using ->> throughout,
--   which correctly extracts text values from each JSON item element.
-- ============================================================================

-- Remove old trigger first to avoid "function still referenced by trigger" error
DROP TRIGGER IF EXISTS trg_track_customer_purchases ON orders;
DROP FUNCTION IF EXISTS track_customer_item_purchases();

CREATE OR REPLACE FUNCTION track_customer_item_purchases()
RETURNS TRIGGER AS $$
DECLARE
  v_uuid_pattern    CONSTANT TEXT := '^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$';
  v_int_pattern     CONSTANT TEXT := '^-?\d+$';
  v_decimal_pattern CONSTANT TEXT := '^\d+(\.\d+)?$';
BEGIN
  -- Only process the first transition into a completed state
  IF NEW.status IN ('order_delivered', 'completed')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('order_delivered', 'completed')) THEN

    -- Skip when customer or items payload is not usable
    IF NEW.customer_id IS NULL
       OR NEW.items IS NULL
       OR jsonb_typeof(NEW.items) <> 'array'
       OR jsonb_array_length(NEW.items) = 0 THEN
      RETURN NEW;
    END IF;

    -- Best-effort only: never block the order status update
    BEGIN
      INSERT INTO customer_item_purchases (
        customer_id,
        menu_item_id,
        purchase_count,
        total_spent,
        last_purchased_at
      )
      SELECT
        NEW.customer_id,
        grouped.menu_item_id,
        grouped.total_quantity,
        grouped.total_price,
        COALESCE(NEW.completed_at, NEW.created_at)
      FROM (
        SELECT
          -- ->> (text extraction) so LOWER()::UUID and regex work correctly
          LOWER(valid_items.menu_item_id_text)::UUID AS menu_item_id,
          SUM(valid_items.quantity)                   AS total_quantity,
          SUM(valid_items.price)                      AS total_price
        FROM (
          SELECT
            item->>'id'       AS menu_item_id_text,          -- text, not jsonb
            CASE
              WHEN COALESCE(item->>'quantity', '') ~ v_int_pattern
                THEN (item->>'quantity')::INT
              ELSE 1
            END               AS quantity,
            CASE
              WHEN COALESCE(item->>'price', '') ~ v_decimal_pattern
                THEN (item->>'price')::NUMERIC
              ELSE 0
            END               AS price
          FROM jsonb_array_elements(NEW.items) AS item
          WHERE COALESCE(item->>'id', '') ~ v_uuid_pattern   -- text comparison
        ) AS valid_items
        GROUP BY valid_items.menu_item_id_text
      ) AS grouped
      ON CONFLICT (customer_id, menu_item_id)
      DO UPDATE SET
        purchase_count    = customer_item_purchases.purchase_count    + EXCLUDED.purchase_count,
        total_spent       = customer_item_purchases.total_spent       + EXCLUDED.total_spent,
        last_purchased_at = GREATEST(customer_item_purchases.last_purchased_at,
                                     EXCLUDED.last_purchased_at);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '[track_customer_item_purchases] Purchase tracking failed for order %: %',
          NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_track_customer_purchases
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION track_customer_item_purchases();

COMMENT ON FUNCTION track_customer_item_purchases IS
  'Tracks customer item purchases on order completion using ->> (text) JSON operators. '
  'Failures are non-fatal: logged as WARNING, order completion never blocked.';

COMMENT ON TRIGGER trg_track_customer_purchases ON orders IS
  'Updates customer_item_purchases when order transitions to completed/delivered.';

DO $$ BEGIN
  RAISE NOTICE 'Migration 144: track_customer_item_purchases() recreated with ->> (text) '
               'operators instead of -> (jsonb). Purchase tracking will now record data correctly.';
END $$;
