-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 071: Fix UUID Type Mismatch in Delivery Report Notifications
-- ═══════════════════════════════════════════════════════════════════════════
-- Purpose: Fix "column "related_id" is of type uuid but expression is of type text" 
--          error when submitting delivery reports
-- Issue: Migration 050 trigger functions cast UUID to TEXT when inserting 
--        into notifications.related_id column
-- Fix: Update trigger functions to use proper UUID casting
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Fix update_rider_earnings() function
-- This function is called when a delivery report is marked as paid
CREATE OR REPLACE FUNCTION update_rider_earnings()
RETURNS TRIGGER AS $$
BEGIN
  -- When a report is marked as paid, update rider's total earnings
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status != 'paid') THEN
    UPDATE riders
    SET total_earnings = total_earnings + NEW.rider_earnings,
        updated_at = NOW()
    WHERE user_id = NEW.rider_id;
    
    -- Mark the deliveries as paid (if delivery_ids array exists)
    IF NEW.delivery_ids IS NOT NULL THEN
      UPDATE deliveries
      SET report_paid = true,
          report_paid_at = NOW(),
          updated_at = NOW()
      WHERE id = ANY(NEW.delivery_ids);
    END IF;
    
    -- Create notification for rider
    -- FIX: Use NEW.id directly (UUID type) instead of NEW.id::TEXT
    INSERT INTO notifications (user_id, type, title, message, related_id, related_type)
    VALUES (
      NEW.rider_id,
      'report_paid',
      '💰 Payment Received',
      'Your delivery report for ' || NEW.report_date::TEXT || ' has been paid. Amount: ₱' || to_char(NEW.rider_earnings, 'FM999999999.00'),
      NEW.id,  -- Changed from NEW.id::TEXT to NEW.id (proper UUID)
      'delivery_report'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Fix notify_cashiers_on_report() function
-- This function is called when a new delivery report is submitted
CREATE OR REPLACE FUNCTION notify_cashiers_on_report()
RETURNS TRIGGER AS $$
DECLARE
  cashier_record RECORD;
  rider_name TEXT;
BEGIN
  -- Only create notifications for new reports
  IF TG_OP = 'INSERT' THEN
    -- Get rider name
    SELECT full_name INTO rider_name
    FROM users
    WHERE id = NEW.rider_id;
    
    -- Create notification for each cashier
    FOR cashier_record IN 
      SELECT id FROM users WHERE role = 'cashier'
    LOOP
      -- FIX: Use NEW.id directly (UUID type) instead of NEW.id::TEXT
      INSERT INTO notifications (user_id, type, title, message, related_id, related_type)
      VALUES (
        cashier_record.id,
        'delivery_report',
        '💵 New Delivery Report',
        COALESCE(rider_name, 'Rider') || ' has submitted a delivery report for ₱' || 
        to_char(NEW.rider_earnings, 'FM999999999.00') || ' (60% of ₱' || to_char(NEW.total_delivery_fees, 'FM999999999.00') || ')',
        NEW.id,  -- Changed from NEW.id::TEXT to NEW.id (proper UUID)
        'delivery_report'
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════
-- COMPLETION NOTICE
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Migration 071 completed successfully!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Fixed trigger functions:';
  RAISE NOTICE '  ✓ update_rider_earnings() - Fixed UUID casting';
  RAISE NOTICE '  ✓ notify_cashiers_on_report() - Fixed UUID casting';
  RAISE NOTICE '';
  RAISE NOTICE 'Riders can now submit delivery reports without type errors';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
