-- ============================================================================
-- Migration 018: Create Notifications System
-- Purpose: Set up customer notifications for order status updates
-- ============================================================================

-- 1. Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Notification details
  type VARCHAR(50) NOT NULL, 
  -- Types: 'order_status', 'order_ready_pickup', 'anniversary', 'announcement', 'new_menu_item'
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  
  -- Related entities
  related_id UUID, -- ID of related entity (order_id, menu_item_id, etc.)
  related_type VARCHAR(50), -- 'order', 'menu_item', 'announcement', etc.
  
  -- Status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- 3. Enable RLS on notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 4. Notifications RLS policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can create notifications" ON notifications;
CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Staff can view all notifications" ON notifications;
CREATE POLICY "Staff can view all notifications" ON notifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

-- 5. Function to create notification when order status changes
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
    
    -- Insert notification
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
      NEW.id,
      'order'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger for order status changes
DROP TRIGGER IF EXISTS trigger_notify_customer_on_order_status ON orders;
CREATE TRIGGER trigger_notify_customer_on_order_status
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_customer_on_order_status_change();

-- 7. Comments
COMMENT ON TABLE notifications IS 'Customer notifications for order status, announcements, and more';
COMMENT ON FUNCTION notify_customer_on_order_status_change() IS 'Creates notifications when order status changes';
