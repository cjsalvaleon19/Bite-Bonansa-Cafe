-- ============================================================================
-- Migration 079: Ensure Loyalty Transaction Conflict Handling
-- ============================================================================
-- Purpose: Guarantee that duplicate loyalty awards are prevented
-- Problem: unique_loyalty_per_order constraint violation when completing orders
-- Solution: Ensure constraint exists and trigger uses ON CONFLICT properly
-- ============================================================================

-- Step 1: Ensure unique constraint exists
-- Drop constraint if it exists (using separate DDL statement outside DO block)
ALTER TABLE loyalty_transactions DROP CONSTRAINT IF EXISTS unique_loyalty_per_order;

-- Add the constraint
ALTER TABLE loyalty_transactions 
ADD CONSTRAINT unique_loyalty_per_order UNIQUE (order_id, transaction_type);

-- Step 2: Ensure the trigger function has ON CONFLICT handling
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
        -- This prevents duplicate awards if trigger fires multiple times
        -- or if order is updated multiple times rapidly
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

COMMENT ON FUNCTION award_loyalty_points_on_order_completion IS 'Awards loyalty points when orders complete. 0.2% for ₱1-500 subtotal, 0.35% for ₱501+. Uses ON CONFLICT to prevent duplicates.';

-- Step 3: Ensure trigger exists
DROP TRIGGER IF EXISTS trg_award_loyalty_points_on_order_completion ON orders;

CREATE TRIGGER trg_award_loyalty_points_on_order_completion
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION award_loyalty_points_on_order_completion();

COMMENT ON TRIGGER trg_award_loyalty_points_on_order_completion ON orders IS 'Triggers loyalty points when order status changes to completed/delivered. Protected against duplicates via ON CONFLICT.';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Migration 079: Ensure Loyalty Conflict Handling - COMPLETE';
  RAISE NOTICE '================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes:';
  RAISE NOTICE '  ✓ Ensured UNIQUE constraint on (order_id, transaction_type)';
  RAISE NOTICE '  ✓ Updated loyalty trigger with ON CONFLICT DO NOTHING';
  RAISE NOTICE '  ✓ Prevents duplicate loyalty awards for same order';
  RAISE NOTICE '  ✓ Handles rapid order updates gracefully';
  RAISE NOTICE '';
  RAISE NOTICE 'This fixes: "unique_loyalty_per_order" constraint violations';
  RAISE NOTICE '================================================================';
END $$;