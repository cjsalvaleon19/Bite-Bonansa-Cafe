-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 072: Add Bill Number to Delivery Reports
-- ═══════════════════════════════════════════════════════════════════════════
-- This migration adds:
-- 1. bill_number column to delivery_reports table
-- 2. Function to generate unique bill numbers in YYMMDD-#### format
-- 3. Trigger to auto-generate bill numbers on insert
-- 4. bill_report_id column to cash_drawer_transactions for linking payments
-- 5. Updated trigger to notify rider when report is paid via cash drawer
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Add bill_number column to delivery_reports
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'delivery_reports' 
    AND column_name = 'bill_number'
  ) THEN
    ALTER TABLE delivery_reports ADD COLUMN bill_number VARCHAR(20) UNIQUE;
    RAISE NOTICE '✓ Added bill_number column to delivery_reports';
  ELSE
    RAISE NOTICE '  bill_number column already exists';
  END IF;
END $$;

-- Create index on bill_number for faster searches
CREATE INDEX IF NOT EXISTS idx_delivery_reports_bill_number ON delivery_reports(bill_number);

-- 2. Create function to generate unique bill number in YYMMDD-#### format
CREATE OR REPLACE FUNCTION generate_bill_number()
RETURNS TEXT AS $$
DECLARE
  date_prefix TEXT;
  sequence_num INT;
  bill_num TEXT;
  max_attempts INT := 100;
  attempt INT := 0;
BEGIN
  -- Get current date in YYMMDD format
  date_prefix := TO_CHAR(CURRENT_DATE, 'YYMMDD');
  
  -- Loop to find next available sequence number
  LOOP
    attempt := attempt + 1;
    
    IF attempt > max_attempts THEN
      RAISE EXCEPTION 'Could not generate unique bill number after % attempts', max_attempts;
    END IF;
    
    -- Get the highest sequence number for today across ALL tables that might have bill numbers
    -- This ensures bill numbers are sequential regardless of source
    SELECT COALESCE(
      MAX(
        CASE 
          WHEN bill_number ~ ('^' || date_prefix || '-[0-9]{4}$')
          THEN CAST(SUBSTRING(bill_number FROM 8 FOR 4) AS INT)
          ELSE 0
        END
      ),
      0
    ) + 1
    INTO sequence_num
    FROM delivery_reports
    WHERE bill_number LIKE date_prefix || '-%';
    
    -- Format: YYMMDD-#### (e.g., 260503-0001)
    bill_num := date_prefix || '-' || LPAD(sequence_num::TEXT, 4, '0');
    
    -- Check if this bill number already exists
    IF NOT EXISTS (SELECT 1 FROM delivery_reports WHERE bill_number = bill_num) THEN
      RETURN bill_num;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3. Create trigger function to auto-generate bill number on insert
CREATE OR REPLACE FUNCTION auto_generate_bill_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Only generate if bill_number is NULL
  IF NEW.bill_number IS NULL THEN
    NEW.bill_number := generate_bill_number();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger to auto-generate bill number
DROP TRIGGER IF EXISTS trigger_auto_generate_bill_number ON delivery_reports;
CREATE TRIGGER trigger_auto_generate_bill_number
  BEFORE INSERT ON delivery_reports
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_bill_number();

-- 5. Add bill_report_id to cash_drawer_transactions to link payments to reports
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'cash_drawer_transactions' 
    AND column_name = 'bill_report_id'
  ) THEN
    ALTER TABLE cash_drawer_transactions ADD COLUMN bill_report_id UUID REFERENCES delivery_reports(id);
    RAISE NOTICE '✓ Added bill_report_id column to cash_drawer_transactions';
  ELSE
    RAISE NOTICE '  bill_report_id column already exists';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cash_drawer_bill_report ON cash_drawer_transactions(bill_report_id);

-- 6. Update the existing update_rider_earnings function to work with both old and new payment methods
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
    INSERT INTO notifications (user_id, type, title, message, related_id, related_type)
    VALUES (
      NEW.rider_id,
      'report_paid',
      '💰 Payment Received',
      'Your delivery report ' || COALESCE(NEW.bill_number, 'for ' || NEW.report_date::TEXT) || ' has been paid. Amount: ₱' || to_char(NEW.rider_earnings, 'FM999999999.00'),
      NEW.id,
      'delivery_report'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger (it uses the updated function)
DROP TRIGGER IF EXISTS trigger_update_rider_earnings ON delivery_reports;
CREATE TRIGGER trigger_update_rider_earnings
  AFTER UPDATE OF status ON delivery_reports
  FOR EACH ROW
  WHEN (NEW.status = 'paid')
  EXECUTE FUNCTION update_rider_earnings();

-- 7. Backfill bill numbers for existing reports (if any)
DO $$
DECLARE
  report_record RECORD;
  new_bill_num TEXT;
BEGIN
  -- Generate bill numbers for existing reports that don't have one
  FOR report_record IN 
    SELECT id FROM delivery_reports WHERE bill_number IS NULL ORDER BY submitted_at
  LOOP
    new_bill_num := generate_bill_number();
    UPDATE delivery_reports SET bill_number = new_bill_num WHERE id = report_record.id;
    RAISE NOTICE 'Generated bill number % for report %', new_bill_num, report_record.id;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- COMPLETION NOTICE
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Migration 072 completed successfully!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes:';
  RAISE NOTICE '  - Added bill_number column to delivery_reports';
  RAISE NOTICE '  - Created generate_bill_number() function (YYMMDD-####)';
  RAISE NOTICE '  - Added auto-generate trigger for bill numbers';
  RAISE NOTICE '  - Added bill_report_id to cash_drawer_transactions';
  RAISE NOTICE '  - Updated rider notification with bill number';
  RAISE NOTICE '';
  RAISE NOTICE 'Bill Number Format: YYMMDD-#### (e.g., 260503-0001)';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
