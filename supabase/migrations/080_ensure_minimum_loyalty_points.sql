-- ============================================================================
-- Ensure Minimum Loyalty Points
-- Update loyalty points calculation to guarantee at least 1 point earned
-- for any order with a customer_id, regardless of order amount.
-- ============================================================================

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trg_award_loyalty_points_on_order_completion ON orders;
DROP FUNCTION IF EXISTS award_loyalty_points_on_order_completion();

-- Create function to calculate and award loyalty points when order is completed
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
        
        -- Ensure minimum of 1 point earned when customer_id exists
        -- This guarantees every order earns at least ₱1.00 in loyalty points
        IF points_earned < 1.00 THEN
          points_earned := 1.00;
        END IF;

        -- Get current balance
        SELECT COALESCE(SUM(amount), 0) INTO current_balance
        FROM loyalty_transactions
        WHERE customer_id = NEW.customer_id;

        -- Calculate new balance
        current_balance := current_balance + points_earned;

        -- Insert loyalty transaction using ON CONFLICT to prevent duplicates
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

-- Create trigger to automatically award points when order is completed
CREATE TRIGGER trg_award_loyalty_points_on_order_completion
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION award_loyalty_points_on_order_completion();

COMMENT ON FUNCTION award_loyalty_points_on_order_completion IS 'Awards loyalty points to customers when orders are completed. Minimum 1 point guaranteed. 0.2% for ₱1-500 subtotal, 0.35% for ₱501+ subtotal';
COMMENT ON TRIGGER trg_award_loyalty_points_on_order_completion ON orders IS 'Triggers loyalty points calculation when order status changes to completed/delivered';
