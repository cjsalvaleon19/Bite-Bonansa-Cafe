-- ============================================================================
-- Migration 084: Fix add_loyalty_points() Duplicate Key Error
-- ============================================================================
-- Purpose: Add ON CONFLICT handling to add_loyalty_points() function
-- Problem: duplicate key value violates unique constraint "unique_loyalty_per_order"
--          when the add_loyalty_points() function tries to insert loyalty transactions
-- Solution: Update add_loyalty_points() to use ON CONFLICT DO NOTHING
-- ============================================================================

-- Drop the old trigger to avoid conflicts with award_loyalty_points_on_order_completion
DROP TRIGGER IF EXISTS trigger_add_loyalty_points ON orders;

-- Update the add_loyalty_points() function with ON CONFLICT handling
CREATE OR REPLACE FUNCTION add_loyalty_points()
RETURNS TRIGGER AS $$
DECLARE
  current_balance DECIMAL;
BEGIN
  -- Only add points when order is delivered
  IF NEW.status = 'order_delivered' AND (OLD.status IS NULL OR OLD.status != 'order_delivered') THEN
    -- Get current balance
    SELECT COALESCE(balance_after, 0) 
    INTO current_balance
    FROM loyalty_transactions
    WHERE customer_id = NEW.customer_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- If no previous transactions, start with 0
    IF current_balance IS NULL THEN
      current_balance := 0;
    END IF;
    
    -- Record transaction with ON CONFLICT DO NOTHING to prevent duplicates
    INSERT INTO loyalty_transactions (customer_id, order_id, transaction_type, amount, balance_after, description)
    VALUES (
      NEW.customer_id, 
      NEW.id, 
      'earned', 
      NEW.earnings_amount,
      current_balance + NEW.earnings_amount,
      'Earned from order #' || NEW.id
    )
    ON CONFLICT (order_id, transaction_type) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION add_loyalty_points IS 
  'Legacy loyalty points function. Updated with ON CONFLICT to prevent duplicates. Prefer using award_loyalty_points_on_order_completion().';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Migration 084: Fix add_loyalty_points Duplicate - COMPLETE';
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Changes applied:';
  RAISE NOTICE '  ✓ Dropped trigger_add_loyalty_points trigger to avoid conflicts';
  RAISE NOTICE '  ✓ Updated add_loyalty_points() with ON CONFLICT DO NOTHING';
  RAISE NOTICE '  ✓ Prevents duplicate key errors in loyalty_transactions';
  RAISE NOTICE '  ✓ award_loyalty_points_on_order_completion() is the active trigger';
  RAISE NOTICE '================================================================';
END $$;
