-- ============================================================================
-- Migration 086: Fix Customer Item Purchases ON CONFLICT Error
-- ============================================================================
-- Purpose: Fix "ON CONFLICT DO UPDATE command cannot affect row a second time" error
-- Problem: When an order has multiple items of the same menu_item_id (e.g., 2 coffees),
--          the trigger tries to upsert the same row twice, causing PostgreSQL error
-- Solution: Aggregate items by menu_item_id before upserting to process each item only once
-- ============================================================================

-- Drop and recreate the function with proper aggregation
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
    
    -- Check if customer_id exists
    IF NEW.customer_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Aggregate items by menu_item_id to prevent duplicate upserts
    -- This fixes: "ON CONFLICT DO UPDATE command cannot affect row a second time"
    -- When an order has 2x Coffee, we aggregate them into one row (quantity=2) before upserting
    FOR v_aggregated_item IN 
      SELECT 
        (item->>'id')::UUID as menu_item_id,
        SUM(COALESCE((item->>'quantity')::INT, 1)) as total_quantity,
        SUM(COALESCE((item->>'price')::DECIMAL(10,2), 0)) as total_price
      FROM jsonb_array_elements(NEW.items) AS item
      WHERE (item->>'id') IS NOT NULL
      GROUP BY (item->>'id')::UUID  -- Key aggregation: group by menu_item_id
    LOOP
      -- Upsert into customer_item_purchases - now each menu_item_id appears only once
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
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger on orders table
CREATE TRIGGER trg_track_customer_purchases
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION track_customer_item_purchases();

-- Update comments
COMMENT ON FUNCTION track_customer_item_purchases IS 
  'Automatically tracks customer purchase history when orders are completed. Aggregates items by menu_item_id to prevent ON CONFLICT errors.';

COMMENT ON TRIGGER trg_track_customer_purchases ON orders IS 
  'Updates customer_item_purchases table when order status changes to completed/delivered';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Migration 086: Fix Customer Purchases Conflict - COMPLETE';
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Changes applied:';
  RAISE NOTICE '  ✓ Added GROUP BY aggregation in track_customer_item_purchases()';
  RAISE NOTICE '  ✓ Prevents multiple upserts for same menu_item_id in one order';
  RAISE NOTICE '  ✓ Fixes: "ON CONFLICT DO UPDATE cannot affect row twice" error';
  RAISE NOTICE '';
  RAISE NOTICE 'Example: Order with 2x Coffee now processes as 1 aggregated row';
  RAISE NOTICE '  Before: Coffee item #1 → upsert, Coffee item #2 → ERROR!';
  RAISE NOTICE '  After:  Coffee items aggregated → single upsert (quantity=2)';
  RAISE NOTICE '================================================================';
END $$;
