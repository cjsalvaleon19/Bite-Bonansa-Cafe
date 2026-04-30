-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 050: Create Rider Portal Tables
-- ═══════════════════════════════════════════════════════════════════════════
-- This migration creates the tables and triggers needed for the Rider Portal:
-- - riders: Rider profile information
-- - deliveries: Delivery assignments and tracking
-- - delivery_reports: Billing reports for rider payments
-- Plus triggers for automatic notifications and earnings updates
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Create riders table
CREATE TABLE IF NOT EXISTS riders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  
  -- Driver identification
  driver_id VARCHAR(50) UNIQUE NOT NULL, -- Unique driver ID number
  
  -- Vehicle information
  vehicle_type VARCHAR(50), -- 'motorcycle', 'scooter', 'bicycle', 'car'
  vehicle_plate VARCHAR(20), -- Plate number
  
  -- Contact information
  cellphone_number VARCHAR(20),
  emergency_contact VARCHAR(255),
  emergency_phone VARCHAR(20),
  
  -- Status and tracking
  is_available BOOLEAN DEFAULT true,
  total_earnings DECIMAL(10,2) DEFAULT 0,
  deliveries_completed INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_riders_user_id ON riders(user_id);
CREATE INDEX IF NOT EXISTS idx_riders_driver_id ON riders(driver_id);
CREATE INDEX IF NOT EXISTS idx_riders_available ON riders(is_available);

-- 2. Create deliveries table
CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  rider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Customer information (denormalized for quick access)
  customer_name VARCHAR(255),
  customer_phone VARCHAR(20),
  customer_address TEXT NOT NULL,
  customer_latitude DECIMAL(10,8),
  customer_longitude DECIMAL(11,8),
  
  -- Delivery details
  delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 50,
  distance_meters INT, -- Distance in meters from store to customer
  
  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- Status values: 'pending', 'accepted', 'in_progress', 'completed', 'cancelled'
  
  -- Report tracking
  report_submitted BOOLEAN DEFAULT false,
  report_submitted_at TIMESTAMP,
  report_paid BOOLEAN DEFAULT false,
  report_paid_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  accepted_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Additional details
  special_instructions TEXT,
  delivery_notes TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_order_id ON deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_rider_id ON deliveries(rider_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON deliveries(created_at DESC);

-- 3. Create delivery_reports table
CREATE TABLE IF NOT EXISTS delivery_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Report details
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_deliveries INT NOT NULL DEFAULT 0,
  delivery_ids UUID[], -- Array of delivery IDs included in this report
  
  -- Financial details
  total_delivery_fees DECIMAL(10,2) NOT NULL DEFAULT 0, -- Total delivery fees collected
  rider_earnings DECIMAL(10,2) NOT NULL DEFAULT 0, -- 60% commission for rider
  business_revenue DECIMAL(10,2) NOT NULL DEFAULT 0, -- 40% revenue for business
  
  -- Status and payment
  status VARCHAR(50) NOT NULL DEFAULT 'submitted', -- 'submitted', 'paid', 'cancelled'
  submitted_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP,
  paid_by UUID REFERENCES users(id), -- Cashier who processed payment
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraint: One report per rider per day
  UNIQUE(rider_id, report_date)
);

CREATE INDEX IF NOT EXISTS idx_delivery_reports_rider_id ON delivery_reports(rider_id);
CREATE INDEX IF NOT EXISTS idx_delivery_reports_status ON delivery_reports(status);
CREATE INDEX IF NOT EXISTS idx_delivery_reports_date ON delivery_reports(report_date DESC);

-- 4. Function to update rider earnings when report is paid
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
      'Your delivery report for ' || NEW.report_date::TEXT || ' has been paid. Amount: ₱' || to_char(NEW.rider_earnings, 'FM999999999.00'),
      NEW.id::TEXT,
      'delivery_report'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger to update rider earnings
DROP TRIGGER IF EXISTS trigger_update_rider_earnings ON delivery_reports;
CREATE TRIGGER trigger_update_rider_earnings
  AFTER UPDATE OF status ON delivery_reports
  FOR EACH ROW
  WHEN (NEW.status = 'paid')
  EXECUTE FUNCTION update_rider_earnings();

-- 6. Function to update delivery count when delivery is completed
CREATE OR REPLACE FUNCTION update_delivery_count()
RETURNS TRIGGER AS $$
BEGIN
  -- When a delivery is marked as completed, increment rider's delivery count
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE riders
    SET deliveries_completed = deliveries_completed + 1,
        updated_at = NOW()
    WHERE user_id = NEW.rider_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Trigger to update delivery count
DROP TRIGGER IF EXISTS trigger_update_delivery_count ON deliveries;
CREATE TRIGGER trigger_update_delivery_count
  AFTER UPDATE OF status ON deliveries
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION update_delivery_count();

-- 8. Function to notify cashiers when report is submitted
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
      INSERT INTO notifications (user_id, type, title, message, related_id, related_type)
      VALUES (
        cashier_record.id,
        'delivery_report',
        '💵 New Delivery Report',
        COALESCE(rider_name, 'Rider') || ' has submitted a delivery report for ₱' || 
        to_char(NEW.rider_earnings, 'FM999999999.00') || ' (60% of ₱' || to_char(NEW.total_delivery_fees, 'FM999999999.00') || ')',
        NEW.id::TEXT,
        'delivery_report'
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. Trigger to notify cashiers
DROP TRIGGER IF EXISTS trigger_notify_cashiers ON delivery_reports;
CREATE TRIGGER trigger_notify_cashiers
  AFTER INSERT ON delivery_reports
  FOR EACH ROW
  EXECUTE FUNCTION notify_cashiers_on_report();

-- 10. Row Level Security (RLS) policies

-- Enable RLS on rider tables
ALTER TABLE riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_reports ENABLE ROW LEVEL SECURITY;

-- Riders table policies
DROP POLICY IF EXISTS "Riders can view their own profile" ON riders;
CREATE POLICY "Riders can view their own profile" ON riders
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Riders can update their own profile" ON riders;
CREATE POLICY "Riders can update their own profile" ON riders
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Riders can insert their own profile" ON riders;
CREATE POLICY "Riders can insert their own profile" ON riders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Staff can view all rider profiles" ON riders;
CREATE POLICY "Staff can view all rider profiles" ON riders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'cashier')
    )
  );

-- Deliveries table policies
DROP POLICY IF EXISTS "Riders can view their own deliveries" ON deliveries;
CREATE POLICY "Riders can view their own deliveries" ON deliveries
  FOR SELECT USING (auth.uid() = rider_id);

DROP POLICY IF EXISTS "Riders can update their own deliveries" ON deliveries;
CREATE POLICY "Riders can update their own deliveries" ON deliveries
  FOR UPDATE USING (
    auth.uid() = rider_id 
    AND report_paid = false -- Cannot update after payment
  );

DROP POLICY IF EXISTS "Staff can view all deliveries" ON deliveries;
CREATE POLICY "Staff can view all deliveries" ON deliveries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'cashier')
    )
  );

DROP POLICY IF EXISTS "Staff can manage all deliveries" ON deliveries;
CREATE POLICY "Staff can manage all deliveries" ON deliveries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'cashier')
    )
  );

-- Delivery reports table policies
DROP POLICY IF EXISTS "Riders can view their own reports" ON delivery_reports;
CREATE POLICY "Riders can view their own reports" ON delivery_reports
  FOR SELECT USING (auth.uid() = rider_id);

DROP POLICY IF EXISTS "Riders can insert their own reports" ON delivery_reports;
CREATE POLICY "Riders can insert their own reports" ON delivery_reports
  FOR INSERT WITH CHECK (auth.uid() = rider_id);

DROP POLICY IF EXISTS "Riders cannot update paid reports" ON delivery_reports;
CREATE POLICY "Riders cannot update paid reports" ON delivery_reports
  FOR UPDATE USING (
    auth.uid() = rider_id 
    AND status != 'paid' -- Cannot update paid reports
  );

DROP POLICY IF EXISTS "Staff can view all reports" ON delivery_reports;
CREATE POLICY "Staff can view all reports" ON delivery_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'cashier')
    )
  );

DROP POLICY IF EXISTS "Staff can update all reports" ON delivery_reports;
CREATE POLICY "Staff can update all reports" ON delivery_reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'cashier')
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- COMPLETION NOTICE
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Migration 050 completed successfully!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Created tables:';
  RAISE NOTICE '  - riders: Rider profile information';
  RAISE NOTICE '  - deliveries: Delivery assignments and tracking';
  RAISE NOTICE '  - delivery_reports: Billing reports';
  RAISE NOTICE '';
  RAISE NOTICE 'Created triggers:';
  RAISE NOTICE '  - update_rider_earnings: Updates total earnings when paid';
  RAISE NOTICE '  - update_delivery_count: Increments delivery count';
  RAISE NOTICE '  - notify_cashiers_on_report: Notifies cashiers of new reports';
  RAISE NOTICE '';
  RAISE NOTICE 'Enabled Row Level Security with appropriate policies';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
