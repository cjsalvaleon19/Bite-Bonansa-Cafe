-- ============================================================================
-- Update Order Status Notifications for All Order Modes
-- Adds support for dine-in and take-out order modes in notification triggers
-- ============================================================================

-- Update the notification function to handle all order modes (dine-in, take-out, delivery, pick-up)
CREATE OR REPLACE FUNCTION notify_customer_on_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
  notification_title TEXT;
  notification_message TEXT;
  notification_type TEXT := 'order_status';
  order_display_number TEXT;
BEGIN
  -- Only create notification for specific status changes
  IF NEW.status != OLD.status THEN
    
    -- Get order display number once
    order_display_number := COALESCE(NEW.order_number, LEFT(NEW.id::TEXT, 8));
    
    -- Determine notification based on status and order_mode
    CASE NEW.status
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
          notification_title := 'Order Served';
          notification_message := 'Your order #' || order_display_number || ' has been served. Enjoy your meal!';
        ELSIF NEW.order_mode = 'take-out' OR NEW.order_mode = 'pick-up' THEN
          notification_title := 'Order Completed';
          notification_message := 'Your order #' || order_display_number || ' has been completed. Enjoy your meal!';
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
      NEW.id::UUID,  -- Explicit cast to UUID
      'order'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON FUNCTION notify_customer_on_order_status_change() IS 'Creates notifications when order status changes - Updated to support all order modes (dine-in, take-out, delivery, pick-up)';
