-- ============================================================================
-- Migration 143: Harden notification and loyalty triggers for order completion
-- ============================================================================
-- Problem:
--   Clicking "Order Complete" for Pick-up orders can fail with an HTTP 500 /
--   database error when either of these triggers raises an unhandled exception:
--     • notify_customer_on_order_status_change()  – no EXCEPTION block
--     • award_loyalty_points_on_order_completion() – no EXCEPTION block
--   When either trigger raises any error (e.g. a foreign-key violation on
--   notifications.user_id, a loyalty-balance edge case, or any transient DB
--   issue) the whole UPDATE on orders is rolled back and the cashier sees a
--   "Failed to update order status" alert.
--
-- Additional fix:
--   The notification trigger only matched order_mode = 'pick-up' (with hyphen).
--   Orders placed with order_mode = 'pickup' (no hyphen) fell to the ELSE
--   branch and received an incorrect "Order Out for Delivery" / "Order
--   Delivered" message instead of the proper pick-up wording.
--
-- Solution:
--   1. Wrap the entire body of notify_customer_on_order_status_change() in a
--      BEGIN … EXCEPTION WHEN OTHERS … END block so that any failure is logged
--      as a WARNING and the order UPDATE is never rolled back.
--   2. Extend all 'pick-up' comparisons to also match 'pickup' (no hyphen).
--   3. Wrap award_loyalty_points_on_order_completion() the same way.
-- ============================================================================

-- ── 1. Harden notification trigger ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_customer_on_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  notification_title   TEXT;
  notification_message TEXT;
  notification_type    TEXT := 'order_status';
  order_display_number TEXT;
BEGIN
  -- Best-effort only: never block the order status update
  BEGIN
    -- Skip if there is no customer linked to this order
    IF NEW.customer_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Only create notification for actual status changes
    IF NEW.status = OLD.status THEN
      RETURN NEW;
    END IF;

    -- Get order display number once
    order_display_number := COALESCE(NEW.order_number, LEFT(NEW.id::TEXT, 8));

    -- Determine notification based on status and order_mode
    CASE NEW.status
      WHEN 'proceed_to_cashier' THEN
        IF NEW.order_mode = 'dine-in' THEN
          notification_title   := 'Proceed to the Cashier';
          notification_message := 'Your order #' || order_display_number
                                  || ' is ready. Please proceed to the cashier for payment.';
          notification_type    := 'proceed_to_cashier';
        ELSIF NEW.order_mode IN ('take-out', 'takeout') THEN
          notification_title   := 'Proceed to the Cashier';
          notification_message := 'Your order #' || order_display_number
                                  || ' is ready. Please proceed to the cashier for payment and pick-up.';
          notification_type    := 'proceed_to_cashier';
        ELSE
          notification_title   := 'Order Accepted';
          notification_message := 'Your order #' || order_display_number || ' has been accepted.';
        END IF;

      WHEN 'order_in_process' THEN
        notification_title   := 'Order Being Prepared';
        notification_message := 'Your order #' || order_display_number || ' is now being prepared.';

      WHEN 'out_for_delivery' THEN
        IF NEW.order_mode IN ('pick-up', 'pickup') THEN
          notification_title   := 'Order Ready for Pick-up';
          notification_message := 'Your order #' || order_display_number || ' is ready for pick-up!';
          notification_type    := 'order_ready_pickup';
        ELSIF NEW.order_mode = 'dine-in' THEN
          notification_title   := 'Order Ready';
          notification_message := 'Your order #' || order_display_number
                                  || ' is ready and will be served to you shortly.';
          notification_type    := 'order_ready';
        ELSIF NEW.order_mode IN ('take-out', 'takeout') THEN
          notification_title   := 'Order Ready for Take-out';
          notification_message := 'Your order #' || order_display_number || ' is ready for take-out!';
          notification_type    := 'order_ready_takeout';
        ELSE
          notification_title   := 'Order Out for Delivery';
          notification_message := 'Your order #' || order_display_number || ' is out for delivery.';
        END IF;

      WHEN 'order_delivered' THEN
        IF NEW.order_mode = 'dine-in' THEN
          notification_title   := 'Order Complete';
          notification_message := 'Your order #' || order_display_number
                                  || ' is complete. Enjoy your meal!';
        ELSIF NEW.order_mode IN ('take-out', 'takeout', 'pick-up', 'pickup') THEN
          notification_title   := 'Order Complete';
          notification_message := 'Your order #' || order_display_number
                                  || ' is complete. Enjoy your meal!';
        ELSE
          notification_title   := 'Order Delivered';
          notification_message := 'Your order #' || order_display_number
                                  || ' has been delivered. Enjoy your meal!';
        END IF;

      WHEN 'cancelled' THEN
        notification_title   := 'Order Cancelled';
        notification_message := 'Your order #' || order_display_number || ' has been cancelled.';

      ELSE
        -- No notification for other status values
        RETURN NEW;
    END CASE;

    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      related_id,
      related_type
    ) VALUES (
      NEW.customer_id,
      notification_type,
      notification_title,
      notification_message,
      NEW.id::UUID,
      'order'
    );

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_customer_on_order_status_change] Notification skipped for order %: % (%)',
      NEW.id, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION notify_customer_on_order_status_change IS
  'Creates customer notifications on order status changes. '
  'Handles pick-up and pickup (both spellings). '
  'Failures are non-fatal: logged as WARNING, order update is never rolled back.';

-- ── 2. Harden loyalty points trigger ────────────────────────────────────────

CREATE OR REPLACE FUNCTION award_loyalty_points_on_order_completion()
RETURNS TRIGGER AS $$
DECLARE
  points_earned     DECIMAL(10,2);
  current_balance   DECIMAL(10,2);
  subtotal_amount   DECIMAL(10,2);
BEGIN
  -- Best-effort only: never block the order status update
  BEGIN
    -- Only process when order transitions to a completed state
    IF NEW.status NOT IN ('order_delivered', 'delivered', 'completed') THEN
      RETURN NEW;
    END IF;

    IF OLD.status IS NOT NULL AND OLD.status IN ('order_delivered', 'delivered', 'completed') THEN
      RETURN NEW;
    END IF;

    -- Only award points when a customer account is linked
    IF NEW.customer_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Determine order subtotal
    IF NEW.subtotal IS NOT NULL AND NEW.subtotal > 0 THEN
      subtotal_amount := NEW.subtotal;
    ELSIF NEW.total_amount IS NOT NULL THEN
      subtotal_amount := NEW.total_amount - COALESCE(NEW.delivery_fee, 0);
    ELSE
      subtotal_amount := 0;
    END IF;

    IF subtotal_amount > 0 THEN
      -- Tiered percentage: 0.2 % for ≤ ₱500, 0.35 % for > ₱500
      IF subtotal_amount <= 500 THEN
        points_earned := ROUND(subtotal_amount * 0.002, 2);
      ELSE
        points_earned := ROUND(subtotal_amount * 0.0035, 2);
      END IF;

      -- Running balance from existing transactions
      SELECT COALESCE(SUM(amount), 0)
        INTO current_balance
        FROM loyalty_transactions
       WHERE customer_id = NEW.customer_id;

      current_balance := current_balance + points_earned;

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
    END IF;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[award_loyalty_points_on_order_completion] Loyalty award skipped for order %: % (%)',
      NEW.id, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION award_loyalty_points_on_order_completion IS
  'Awards loyalty points when an order completes. '
  'Failures are non-fatal: logged as WARNING, order update is never rolled back.';

-- Re-create trigger (idempotent)
DROP TRIGGER IF EXISTS trg_award_loyalty_points_on_order_completion ON orders;
CREATE TRIGGER trg_award_loyalty_points_on_order_completion
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION award_loyalty_points_on_order_completion();

COMMENT ON TRIGGER trg_award_loyalty_points_on_order_completion ON orders IS
  'Awards loyalty points on order completion. Non-blocking.';

DO $$ BEGIN
  RAISE NOTICE 'Migration 143: notification and loyalty triggers hardened. '
               'Both now catch all exceptions and log WARNING instead of rolling back.';
  RAISE NOTICE 'Notification trigger also handles pickup (no hyphen) order mode.';
END $$;
