-- ============================================================================
-- Migration 082: Fix Loyalty Duplicate Key Error in Orders Queue
-- ============================================================================
-- Purpose: Ensure duplicate loyalty transaction errors are prevented
-- Problem: 409 error "duplicate key value violates unique constraint unique_loyalty_per_order"
--          when marking items as served in orders queue
-- Solution: Verify constraint exists and trigger handles conflicts properly
-- ============================================================================

-- Step 1: Ensure unique constraint exists on loyalty_transactions
-- This prevents duplicate loyalty awards for the same order
DO $$
BEGIN
  -- Check if constraint exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_loyalty_per_order'
  ) THEN
    -- Add constraint if it doesn't exist
    ALTER TABLE loyalty_transactions 
    ADD CONSTRAINT unique_loyalty_per_order UNIQUE (order_id, transaction_type);
    RAISE NOTICE 'Added unique_loyalty_per_order constraint';
  ELSE
    RAISE NOTICE 'Constraint unique_loyalty_per_order already exists';
  END IF;
END $$;

-- Step 2: Recreate the trigger function with proper ON CONFLICT handling
DROP TRIGGER IF EXISTS trg_award_loyalty_points_on_order_completion ON orders;
DROP FUNCTION IF EXISTS award_loyalty_points_on_order_completion();

CREATE OR REPLACE FUNCTION award_loyalty_points_on_order_completion()
RETURNS TRIGGER AS $$
DECLARE
  points_earned DECIMAL(10,2);
  current_balance DECIMAL(10,2);
  subtotal_amount DECIMAL(10,2);
BEGIN
  -- Only process when order status changes to completed/delivered
  IF (NEW.status IN ('order_delivered', 'delivered', 'completed') AND 
      (OLD.status IS NULL OR OLD.status NOT IN ('order_delivered', 'delivered', 'completed'))) THEN
    
    -- Only award points if customer_id exists
    IF NEW.customer_id IS NOT NULL THEN
      -- Use subtotal if available, otherwise calculate from total minus delivery fee
      IF NEW.subtotal IS NOT NULL AND NEW.subtotal > 0 THEN
        subtotal_amount := NEW.subtotal;
      ELSIF NEW.total_amount IS NOT NULL THEN
        -- Subtract delivery fee from total to get subtotal
        subtotal_amount := NEW.total_amount - COALESCE(NEW.delivery_fee, 0);
      ELSE
        subtotal_amount := 0;
      END IF;

      -- Calculate points based on tiered system
      IF subtotal_amount > 0 THEN
        IF subtotal_amount <= 500 THEN
          -- 0.2% for ₱1-500
          points_earned := subtotal_amount * 0.002;
        ELSE
          -- 0.35% for ₱501 and above
          points_earned := subtotal_amount * 0.0035;
        END IF;

        -- Round to 2 decimal places
        points_earned := ROUND(points_earned, 2);

        -- Get current balance
        SELECT COALESCE(SUM(amount), 0) INTO current_balance
        FROM loyalty_transactions
        WHERE customer_id = NEW.customer_id;

        -- Calculate new balance
        current_balance := current_balance + points_earned;

        -- Insert loyalty transaction with ON CONFLICT DO NOTHING
        -- This silently ignores duplicate inserts if loyalty was already awarded
        INSERT INTO loyalty_transactions (
          customer_id,
          order_id,
          transaction_type,
          amount,
          balance_after,
          description,
          created_at
        ) VALUES (
          NEW.customer_id,
          NEW.id,
          'earned',
          points_earned,
          current_balance,
          'Points earned from order #' || COALESCE(NEW.order_number, SUBSTRING(NEW.id::TEXT, 1, 8)),
          NOW()
        )
        ON CONFLICT (order_id, transaction_type) DO NOTHING;

        RAISE NOTICE 'Awarded % loyalty points to customer % for order % (or already awarded)', 
          points_earned, NEW.customer_id, NEW.id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create the trigger
CREATE TRIGGER trg_award_loyalty_points_on_order_completion
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION award_loyalty_points_on_order_completion();

-- Step 4: Add comments
COMMENT ON FUNCTION award_loyalty_points_on_order_completion IS 
  'Awards loyalty points when orders complete. 0.2% for ≤₱500, 0.35% for >₱500. Uses ON CONFLICT to prevent duplicate awards.';

COMMENT ON TRIGGER trg_award_loyalty_points_on_order_completion ON orders IS 
  'Triggers loyalty points when order status changes to completed/delivered. Protected against duplicates.';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Migration 082: Fix Loyalty Duplicate Error - COMPLETE';
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Changes applied:';
  RAISE NOTICE '  ✓ Verified UNIQUE constraint on (order_id, transaction_type)';
  RAISE NOTICE '  ✓ Recreated trigger function with ON CONFLICT DO NOTHING';
  RAISE NOTICE '  ✓ Prevents 409 duplicate key errors in orders queue';
  RAISE NOTICE '================================================================';
END $$;
