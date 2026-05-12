-- ============================================================================
-- Migration 142: Harden customer purchase tracking trigger
-- ============================================================================
-- Purpose:
-- - Prevent order completion from failing due to purchase-tracking conflicts
-- - Remove legacy trigger/function pair that may still run in older environments
-- - Keep purchase tracking best-effort and non-blocking
-- ============================================================================

-- Remove both legacy and current trigger/function names to avoid duplicate execution
DROP TRIGGER IF EXISTS trigger_update_customer_purchases ON orders;
DROP FUNCTION IF EXISTS update_customer_purchases();

DROP TRIGGER IF EXISTS trg_track_customer_purchases ON orders;
DROP FUNCTION IF EXISTS track_customer_item_purchases();

CREATE OR REPLACE FUNCTION track_customer_item_purchases()
RETURNS TRIGGER AS $$
DECLARE
  v_uuid_pattern CONSTANT TEXT := '^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$';
  v_int_pattern CONSTANT TEXT := '^-?\d+$';
  v_decimal_pattern CONSTANT TEXT := '^\d+(\.\d+)?$';
BEGIN
  -- Only process first transition into a completed state
  IF NEW.status IN ('order_delivered', 'completed')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('order_delivered', 'completed')) THEN

    -- Skip when customer or items payload is not usable
    IF NEW.customer_id IS NULL
       OR NEW.items IS NULL
       OR jsonb_typeof(NEW.items) <> 'array'
       OR jsonb_array_length(NEW.items) = 0 THEN
      RETURN NEW;
    END IF;

    -- Best effort only: never block the order status update
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
          LOWER(valid_items.menu_item_id_text)::UUID AS menu_item_id,
          SUM(valid_items.quantity) AS total_quantity,
          SUM(valid_items.price) AS total_price
        FROM (
          SELECT
            item->>'id' AS menu_item_id_text,
            CASE
              WHEN COALESCE(item->>'quantity', '') ~ v_int_pattern
                THEN (item->>'quantity')::INT
              ELSE 1
            END
            AS quantity,
            CASE
              WHEN COALESCE(item->>'price', '') ~ v_decimal_pattern
                THEN (item->>'price')::NUMERIC
              ELSE 0
            END
            AS price
          FROM jsonb_array_elements(NEW.items) AS item
          WHERE COALESCE(item->>'id', '') ~ v_uuid_pattern
        ) AS valid_items
        GROUP BY valid_items.menu_item_id_text
      ) AS grouped
      ON CONFLICT (customer_id, menu_item_id)
      DO UPDATE SET
        purchase_count = customer_item_purchases.purchase_count + EXCLUDED.purchase_count,
        total_spent = customer_item_purchases.total_spent + EXCLUDED.total_spent,
        last_purchased_at = GREATEST(customer_item_purchases.last_purchased_at, EXCLUDED.last_purchased_at);
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
  'Tracks customer purchases when orders complete. Drops legacy duplicate trigger path and catches all exceptions so order completion never fails.';

COMMENT ON TRIGGER trg_track_customer_purchases ON orders IS
  'Updates customer_item_purchases when order status changes to completed/delivered. Safe: failures are logged as warnings and do not block order completion.';
