-- ============================================================================
-- Migration 087: Verify and Reapply Customer Purchases Fix
-- ============================================================================
-- Purpose: Ensure migration 086 fix is properly applied to resolve ON CONFLICT error
-- This migration checks the current function and reapplies the fix if needed
-- ============================================================================

-- First, let's check the current function definition
DO $$
DECLARE
  v_function_def TEXT;
  v_has_group_by BOOLEAN;
BEGIN
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Checking track_customer_item_purchases function...';
  RAISE NOTICE '================================================================';
  
  -- Get the current function definition
  SELECT pg_get_functiondef('track_customer_item_purchases'::regproc::oid) 
  INTO v_function_def;
  
  -- Check if it has GROUP BY clause (the fix from migration 086)
  v_has_group_by := v_function_def LIKE '%GROUP BY%';
  
  IF v_has_group_by THEN
    RAISE NOTICE 'Function already has GROUP BY aggregation - Fix is applied!';
    RAISE NOTICE 'No action needed.';
  ELSE
    RAISE WARNING 'Function is missing GROUP BY aggregation!';
    RAISE WARNING 'The fix from migration 086 needs to be applied.';
  END IF;
  
  RAISE NOTICE '================================================================';
END $$;

-- Drop and recreate the function with proper aggregation (Migration 086 fix)
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

-- Verify the fix was applied
DO $$
DECLARE
  v_function_def TEXT;
  v_has_group_by BOOLEAN;
BEGIN
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Migration 087: Verify and Reapply Customer Purchases Fix';
  RAISE NOTICE '================================================================';
  
  -- Get the updated function definition
  SELECT pg_get_functiondef('track_customer_item_purchases'::regproc::oid) 
  INTO v_function_def;
  
  -- Check if it now has GROUP BY clause
  v_has_group_by := v_function_def LIKE '%GROUP BY%';
  
  IF v_has_group_by THEN
    RAISE NOTICE 'SUCCESS: Function now has GROUP BY aggregation';
    RAISE NOTICE '';
    RAISE NOTICE 'Changes applied:';
    RAISE NOTICE '  ✓ Added GROUP BY aggregation in track_customer_item_purchases()';
    RAISE NOTICE '  ✓ Prevents multiple upserts for same menu_item_id in one order';
    RAISE NOTICE '  ✓ Fixes: "ON CONFLICT DO UPDATE cannot affect row twice" error';
    RAISE NOTICE '';
    RAISE NOTICE 'Example: Order with 2x Coffee now processes as 1 aggregated row';
    RAISE NOTICE '  Before: Coffee item #1 → upsert, Coffee item #2 → ERROR!';
    RAISE NOTICE '  After:  Coffee items aggregated → single upsert (quantity=2)';
  ELSE
    RAISE WARNING 'FAILED: Function still missing GROUP BY aggregation!';
  END IF;
  
  RAISE NOTICE '================================================================';
END $$;
