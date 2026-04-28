-- ============================================================================
-- Migration 037: Fix notifications.related_id Column Type
-- Purpose: Ensure related_id is properly defined as UUID type
-- Issue: Column "related_id" is of type uuid but expression is of type text error
-- ============================================================================

-- Check current column type and alter if necessary
DO $$
BEGIN
    -- Check if related_id column exists and its type
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'notifications' 
        AND column_name = 'related_id'
    ) THEN
        -- Get current data type
        RAISE NOTICE 'Current related_id column type: %', (
            SELECT data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'notifications' 
            AND column_name = 'related_id'
        );
        
        -- Ensure column is UUID type
        -- This is safe because NULL values and valid UUIDs will cast correctly
        ALTER TABLE notifications 
        ALTER COLUMN related_id TYPE UUID USING related_id::UUID;
        
        RAISE NOTICE 'Successfully ensured related_id is UUID type';
    ELSE
        RAISE EXCEPTION 'Column notifications.related_id does not exist';
    END IF;
END $$;

-- Verify the trigger function uses proper types
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
        ELSE
          notification_title := 'Order Out for Delivery';
          notification_message := 'Your order #' || order_display_number || ' is out for delivery.';
        END IF;
      
      WHEN 'order_delivered' THEN
        notification_title := 'Order Delivered';
        notification_message := 'Your order #' || order_display_number || ' has been delivered. Enjoy your meal!';
      
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

-- Recreate the trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS trigger_notify_customer_on_order_status ON orders;
CREATE TRIGGER trigger_notify_customer_on_order_status
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_customer_on_order_status_change();

-- Comments
COMMENT ON FUNCTION notify_customer_on_order_status_change() IS 'Creates notifications when order status changes - Updated to ensure UUID type casting';
