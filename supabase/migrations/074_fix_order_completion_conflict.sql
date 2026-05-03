-- ============================================================================
-- Migration 074: Fix Order Completion Conflict Error
-- ============================================================================
-- Purpose: Fix "ON CONFLICT DO UPDATE command cannot affect row a second time" error
-- Problem: Loyalty trigger can be called multiple times for same order
-- Solution: Add unique constraint and ON CONFLICT DO NOTHING to loyalty insert
-- ============================================================================

-- Step 1: Add unique constraint to prevent duplicate loyalty awards for same order
-- This ensures one order can only award points once
ALTER TABLE loyalty_transactions 
ADD CONSTRAINT unique_loyalty_per_order UNIQUE (order_id, transaction_type);

-- Step 2: Update the loyalty points trigger to handle conflicts gracefully
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

        RAISE NOTICE 'Awarded % loyalty points to customer % for order %', 
          points_earned, NEW.customer_id, NEW.id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION award_loyalty_points_on_order_completion IS 'Awards loyalty points to customers when orders are completed. 0.2% for ₱1-500 subtotal, 0.35% for ₱501+ subtotal. Uses ON CONFLICT to prevent duplicates.';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Migration 074: Fix Order Completion Conflict - COMPLETE';
  RAISE NOTICE '================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes:';
  RAISE NOTICE '  + Added UNIQUE constraint on (order_id, transaction_type)';
  RAISE NOTICE '  + Updated loyalty trigger with ON CONFLICT DO NOTHING';
  RAISE NOTICE '  + Prevents duplicate loyalty awards for same order';
  RAISE NOTICE '';
  RAISE NOTICE 'This fixes: "ON CONFLICT DO UPDATE cannot affect row twice" error';
  RAISE NOTICE '================================================================';
END $$;
