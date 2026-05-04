-- ============================================================================
-- Migration 093: Fix notification trigger NULL customer_id crash
-- Problem: notify_customer_on_order_status_change() inserts into notifications
--          with user_id = NEW.customer_id. When the order has no customer_id
--          (walk-in / anonymous orders), this violates the NOT NULL constraint
--          on notifications.user_id and causes a 400 error on every
--          "mark item as served" action in the orders queue.
-- Fix: Return early (RETURN NEW) when customer_id IS NULL, so no notification
--      row is attempted for orders without a linked customer account.
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_customer_on_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  notification_title TEXT;
  notification_message TEXT;
  notification_type TEXT := 'order_status';
  order_display_number TEXT;
BEGIN
  -- Skip notification if there is no customer linked to this order
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only create notification for specific status changes
  IF NEW.status != OLD.status THEN
    
    -- Get order display number once
    order_display_number := COALESCE(NEW.order_number, LEFT(NEW.id::TEXT, 8));
    
    -- Determine notification based on status and order_mode
    CASE NEW.status
      WHEN 'proceed_to_cashier' THEN
        -- Dine-in and Take-out specific status
        IF NEW.order_mode = 'dine-in' THEN
          notification_title := 'Proceed to the Cashier';
          notification_message := 'Your order #' || order_display_number || ' is ready. Please proceed to the cashier for payment.';
          notification_type := 'proceed_to_cashier';
        ELSIF NEW.order_mode = 'take-out' THEN
          notification_title := 'Proceed to the Cashier';
          notification_message := 'Your order #' || order_display_number || ' is ready. Please proceed to the cashier for payment and pick-up.';
          notification_type := 'proceed_to_cashier';
        ELSE
          -- Fallback for other order modes
          notification_title := 'Order Accepted';
          notification_message := 'Your order #' || order_display_number || ' has been accepted.';
        END IF;
      
      WHEN 'order_in_process' THEN
        notification_title := 'Order Being Prepared';
        notification_message := 'Your order #' || order_display_number || ' is now being prepared.';
      
      WHEN 'out_for_delivery' THEN
        IF NEW.order_mode = 'pick-up' THEN
          notification_title := 'Order Ready for Pick-up';
          notification_message := 'Your order #' || order_display_number || ' is ready for pick-up!';
          notification_type := 'order_ready_pickup';
        ELSIF NEW.order_mode = 'dine-in' THEN
          notification_title := 'Order Ready';
          notification_message := 'Your order #' || order_display_number || ' is ready and will be served to you shortly.';
          notification_type := 'order_ready';
        ELSIF NEW.order_mode = 'take-out' THEN
          notification_title := 'Order Ready for Take-out';
          notification_message := 'Your order #' || order_display_number || ' is ready for take-out!';
          notification_type := 'order_ready_takeout';
        ELSE
          notification_title := 'Order Out for Delivery';
          notification_message := 'Your order #' || order_display_number || ' is out for delivery.';
        END IF;
      
      WHEN 'order_delivered' THEN
        IF NEW.order_mode = 'dine-in' THEN
          notification_title := 'Order Complete';
          notification_message := 'Your order #' || order_display_number || ' is complete. Enjoy your meal!';
        ELSIF NEW.order_mode = 'take-out' OR NEW.order_mode = 'pick-up' THEN
          notification_title := 'Order Complete';
          notification_message := 'Your order #' || order_display_number || ' is complete. Enjoy your meal!';
        ELSE
          notification_title := 'Order Delivered';
          notification_message := 'Your order #' || order_display_number || ' has been delivered. Enjoy your meal!';
        END IF;
      
      WHEN 'cancelled' THEN
        notification_title := 'Order Cancelled';
        notification_message := 'Your order #' || order_display_number || ' has been cancelled.';
      
      ELSE
        -- Don't create notification for other status changes
        RETURN NEW;
    END CASE;
    
    -- Insert notification with explicit UUID cast to ensure type safety
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
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION notify_customer_on_order_status_change() IS 'Creates notifications when order status changes - skips when customer_id is NULL (walk-in/anonymous orders) to prevent not-null constraint violation';
