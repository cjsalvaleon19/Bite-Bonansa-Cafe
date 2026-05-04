-- ============================================================================
-- Migration 088: Add Exception Handling to track_customer_item_purchases
-- ============================================================================
-- Purpose: Ensure the trigger NEVER blocks order status updates
-- Problem: Even with GROUP BY fix (migration 086/087), edge cases in the items
--          JSON (e.g., corrupted data, unusual UUID formats) can still cause
--          "ON CONFLICT DO UPDATE command cannot affect row a second time" error,
--          which propagates out of the trigger and rolls back the entire order
--          status update transaction (HTTP 500 on POST /orders).
-- Solution: Wrap the upsert logic in an inner BEGIN/EXCEPTION block so that
--          any error in purchase tracking is caught and logged as a WARNING,
--          allowing the order status update to complete successfully.
-- ============================================================================

-- Drop and recreate the function with exception handling
DROP TRIGGER IF EXISTS trg_track_customer_purchases ON orders;
DROP FUNCTION IF EXISTS track_customer_item_purchases();

CREATE OR REPLACE FUNCTION track_customer_item_purchases()
RETURNS TRIGGER AS $$
DECLARE
  v_aggregated_item RECORD;
BEGIN
  -- Only process when order status changes to completed/delivered
  IF NEW.status IN ('order_delivered', 'completed') AND
     (OLD.status IS NULL OR OLD.status NOT IN ('order_delivered', 'completed')) THEN

    -- Skip if no customer or no items
    IF NEW.customer_id IS NULL THEN
      RETURN NEW;
    END IF;

    IF NEW.items IS NULL OR jsonb_array_length(NEW.items) = 0 THEN
      RETURN NEW;
    END IF;

    -- Inner block with EXCEPTION handler so purchase tracking errors
    -- never block the order status update
    BEGIN
      FOR v_aggregated_item IN
        SELECT
          (item->>'id')::UUID AS menu_item_id,
          SUM(COALESCE((item->>'quantity')::INT, 1)) AS total_quantity,
          SUM(COALESCE((item->>'price')::DECIMAL(10,2), 0)) AS total_price
        FROM jsonb_array_elements(NEW.items) AS item
        WHERE (item->>'id') IS NOT NULL
          AND (item->>'id') != ''
        GROUP BY (item->>'id')::UUID  -- Aggregation: group by menu_item_id
      LOOP
        INSERT INTO customer_item_purchases (
          customer_id,
          menu_item_id,
          purchase_count,
          total_spent,
          last_purchased_at
        ) VALUES (
          NEW.customer_id,
          v_aggregated_item.menu_item_id,
          v_aggregated_item.total_quantity,
          v_aggregated_item.total_price,
          NEW.created_at
        )
        ON CONFLICT (customer_id, menu_item_id)
        DO UPDATE SET
          purchase_count = customer_item_purchases.purchase_count + EXCLUDED.purchase_count,
          total_spent = customer_item_purchases.total_spent + EXCLUDED.total_spent,
          last_purchased_at = EXCLUDED.last_purchased_at;
      END LOOP;

    EXCEPTION
      WHEN OTHERS THEN
        -- Log the error as a WARNING so it appears in Supabase logs,
        -- but DO NOT re-raise. This allows the order status update to
        -- succeed even if purchase tracking fails.
        RAISE WARNING '[track_customer_item_purchases] Purchase tracking failed for order %: %',
          NEW.id, SQLERRM;
    END;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER trg_track_customer_purchases
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION track_customer_item_purchases();

COMMENT ON FUNCTION track_customer_item_purchases IS
  'Tracks customer purchase history when orders complete. Uses GROUP BY aggregation and exception handling so purchase tracking errors never block order completion.';

COMMENT ON TRIGGER trg_track_customer_purchases ON orders IS
  'Updates customer_item_purchases when order status changes to completed/delivered. Safe: exceptions are caught and logged as warnings.';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Migration 088: Add Exception Handling to track_customer_item_purchases';
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Changes applied:';
  RAISE NOTICE '  ✓ Wrapped upsert loop in inner BEGIN/EXCEPTION block';
  RAISE NOTICE '  ✓ Any error in purchase tracking is now caught as WARNING';
  RAISE NOTICE '  ✓ Order status updates will ALWAYS succeed regardless of tracking errors';
  RAISE NOTICE '  ✓ Empty string id filter added (AND item->>''id'' != '''')';
  RAISE NOTICE '  ✓ NULL items check added before processing';
  RAISE NOTICE '';
  RAISE NOTICE 'Root cause addressed:';
  RAISE NOTICE '  The "ON CONFLICT DO UPDATE cannot affect row a second time" error';
  RAISE NOTICE '  propagated out of the trigger, rolling back the order status update.';
  RAISE NOTICE '  The exception handler prevents this rollback from happening.';
  RAISE NOTICE '================================================================';
END $$;
