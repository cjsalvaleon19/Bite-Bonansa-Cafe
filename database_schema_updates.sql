-- ============================================================================
-- Database Schema Updates for Portal Access Control & Features
-- ============================================================================

-- 1. Update orders table with additional fields for cashier portal
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_mode VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number VARCHAR(100) UNIQUE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS contact_number VARCHAR(20);

COMMENT ON COLUMN orders.order_mode IS 'Order type: dine-in, take-out, pick-up, delivery';
COMMENT ON COLUMN orders.order_number IS 'Unique order number for tracking (e.g., ORD-1234567890-ABCD)';

-- 2. Create cash_drawer_transactions table for cashier cash management
CREATE TABLE IF NOT EXISTS cash_drawer_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL, -- 'cash-in', 'cash-out', 'adjustment'
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  
  -- For cash-out (expenses/bills)
  payee_name VARCHAR(255),
  purpose TEXT,
  category VARCHAR(100), -- 'payroll', 'utilities', 'supplies', 'maintenance', 'other'
  
  -- For adjustments
  reference_number VARCHAR(100), -- Order or receipt number
  adjustment_reason VARCHAR(255), -- 'canceled_order', 'double_posting', 'payment_correction', 'other'
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_drawer_cashier ON cash_drawer_transactions(cashier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_drawer_date ON cash_drawer_transactions(created_at DESC);

COMMENT ON TABLE cash_drawer_transactions IS 'Tracks cash drawer transactions for reconciliation';

-- 3. Create delivery_billing_notifications table for rider billing
CREATE TABLE IF NOT EXISTS delivery_billing_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cashier_id UUID REFERENCES users(id),
  report_id UUID REFERENCES delivery_reports(id),
  
  total_deliveries INT NOT NULL DEFAULT 0,
  total_delivery_fees DECIMAL(10,2) NOT NULL DEFAULT 0,
  billable_amount DECIMAL(10,2) NOT NULL DEFAULT 0, -- 60% of total delivery fees
  
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'paid'
  submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_notifications_rider ON delivery_billing_notifications(rider_id, status);
CREATE INDEX IF NOT EXISTS idx_billing_notifications_cashier ON delivery_billing_notifications(cashier_id);
CREATE INDEX IF NOT EXISTS idx_billing_notifications_status ON delivery_billing_notifications(status, submitted_at DESC);

COMMENT ON TABLE delivery_billing_notifications IS 'Notifications for cashier to pay rider delivery fees';

-- 4. Add cashier_id field to users table (for cashier identification)
ALTER TABLE users ADD COLUMN IF NOT EXISTS cashier_id VARCHAR(50) UNIQUE;

COMMENT ON COLUMN users.cashier_id IS 'Unique cashier identification number';

-- 5. Create delivery_reports table if not exists (for rider billing)
CREATE TABLE IF NOT EXISTS delivery_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  
  total_deliveries INT NOT NULL DEFAULT 0,
  total_delivery_fees DECIMAL(10,2) NOT NULL DEFAULT 0,
  business_revenue DECIMAL(10,2) NOT NULL DEFAULT 0, -- 40% of total
  rider_earnings DECIMAL(10,2) NOT NULL DEFAULT 0, -- 60% of total
  
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'submitted', 'paid'
  submitted_at TIMESTAMP,
  paid_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(rider_id, report_date)
);

CREATE INDEX IF NOT EXISTS idx_delivery_reports_rider ON delivery_reports(rider_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_reports_status ON delivery_reports(status);

COMMENT ON TABLE delivery_reports IS 'Daily delivery fee reports submitted by riders for billing';

-- 6. Create deliveries table if not exists (for rider order management)
CREATE TABLE IF NOT EXISTS deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  rider_id UUID REFERENCES users(id),
  cashier_id UUID REFERENCES users(id),
  
  delivery_address TEXT NOT NULL,
  delivery_latitude DECIMAL(10,8),
  delivery_longitude DECIMAL(11,8),
  delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'in_progress', 'completed', 'cancelled'
  
  assigned_at TIMESTAMP,
  accepted_at TIMESTAMP,
  picked_up_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  report_submitted BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deliveries_rider ON deliveries(rider_id, status);
CREATE INDEX IF NOT EXISTS idx_deliveries_order ON deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);

COMMENT ON TABLE deliveries IS 'Tracks delivery orders assigned to riders';

-- 7. Create riders table if not exists (for rider profile information)
CREATE TABLE IF NOT EXISTS riders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  
  driver_id VARCHAR(50) UNIQUE NOT NULL,
  vehicle_type VARCHAR(100),
  vehicle_plate VARCHAR(50),
  cellphone_number VARCHAR(20),
  emergency_contact VARCHAR(255),
  emergency_phone VARCHAR(20),
  
  is_available BOOLEAN DEFAULT TRUE,
  deliveries_completed INT DEFAULT 0,
  total_earnings DECIMAL(10,2) DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_riders_user ON riders(user_id);
CREATE INDEX IF NOT EXISTS idx_riders_available ON riders(is_available);

COMMENT ON TABLE riders IS 'Rider profile information and statistics';

-- 8. Add RLS policies for new tables
ALTER TABLE cash_drawer_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_billing_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE riders ENABLE ROW LEVEL SECURITY;

-- Cash drawer transactions policies
CREATE POLICY "Cashiers can view their own transactions" ON cash_drawer_transactions
  FOR SELECT USING (auth.uid() = cashier_id);

CREATE POLICY "Cashiers can create transactions" ON cash_drawer_transactions
  FOR INSERT WITH CHECK (auth.uid() = cashier_id);

CREATE POLICY "Admin can view all cash transactions" ON cash_drawer_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Delivery billing notifications policies
CREATE POLICY "Riders can view their own billing notifications" ON delivery_billing_notifications
  FOR SELECT USING (auth.uid() = rider_id);

CREATE POLICY "Cashiers can view billing notifications" ON delivery_billing_notifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('cashier', 'admin')
    )
  );

CREATE POLICY "Riders can create billing notifications" ON delivery_billing_notifications
  FOR INSERT WITH CHECK (auth.uid() = rider_id);

-- Delivery reports policies
CREATE POLICY "Riders can view their own reports" ON delivery_reports
  FOR SELECT USING (auth.uid() = rider_id);

CREATE POLICY "Riders can create their own reports" ON delivery_reports
  FOR INSERT WITH CHECK (auth.uid() = rider_id);

CREATE POLICY "Staff can view all delivery reports" ON delivery_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

-- Deliveries policies
CREATE POLICY "Riders can view their assigned deliveries" ON deliveries
  FOR SELECT USING (auth.uid() = rider_id);

CREATE POLICY "Staff can view all deliveries" ON deliveries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

CREATE POLICY "Staff can create deliveries" ON deliveries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

CREATE POLICY "Riders can update their deliveries" ON deliveries
  FOR UPDATE USING (auth.uid() = rider_id);

-- Riders policies
CREATE POLICY "Riders can view their own profile" ON riders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Riders can update their own profile" ON riders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all rider profiles" ON riders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

-- 9. Create function to update order status
CREATE OR REPLACE FUNCTION update_order_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  
  -- Set delivered_at when status changes to 'order_delivered'
  IF NEW.status = 'order_delivered' AND OLD.status != 'order_delivered' THEN
    NEW.delivered_at = NOW();
  END IF;
  
  -- Set accepted_at when status changes from 'order_in_queue'
  IF NEW.status = 'order_in_process' AND OLD.status = 'order_in_queue' THEN
    NEW.accepted_at = NOW();
  END IF;
  
  -- Set out_for_delivery_at when status changes to 'out_for_delivery'
  IF NEW.status = 'out_for_delivery' AND OLD.status != 'out_for_delivery' THEN
    NEW.out_for_delivery_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_order_timestamps ON orders;
CREATE TRIGGER trigger_update_order_timestamps
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_order_timestamps();

COMMENT ON FUNCTION update_order_timestamps() IS 'Automatically updates order timestamps based on status changes';

-- 10. Create view for cashier dashboard stats
CREATE OR REPLACE VIEW cashier_daily_stats AS
SELECT
  DATE(created_at) as report_date,
  COUNT(*) as total_orders,
  SUM(CASE WHEN payment_method = 'cash' THEN cash_amount ELSE 0 END) as cash_sales,
  SUM(CASE WHEN payment_method = 'gcash' THEN gcash_amount ELSE 0 END) as gcash_sales,
  SUM(points_used) as points_redeemed,
  SUM(total_amount) as total_sales,
  COUNT(CASE WHEN order_mode = 'dine-in' THEN 1 END) as dine_in_count,
  COUNT(CASE WHEN order_mode = 'take-out' THEN 1 END) as take_out_count,
  COUNT(CASE WHEN order_mode = 'pick-up' THEN 1 END) as pick_up_count,
  COUNT(CASE WHEN order_mode = 'delivery' THEN 1 END) as delivery_count
FROM orders
GROUP BY DATE(created_at);

COMMENT ON VIEW cashier_daily_stats IS 'Daily sales statistics for cashier dashboard';

-- 11. Create delivery fee calculator functions
-- Store location constant (Bite Bonansa Cafe, T'boli, South Cotabato)
-- Latitude: 6.2178483, Longitude: 124.8221226

-- Function to calculate distance between two coordinates using Haversine formula
CREATE OR REPLACE FUNCTION calculate_distance_meters(
  lat1 DECIMAL,
  lon1 DECIMAL,
  lat2 DECIMAL,
  lon2 DECIMAL
)
RETURNS INT AS $$
DECLARE
  R CONSTANT DECIMAL := 6371.0; -- Earth's radius in kilometers
  dLat DECIMAL;
  dLon DECIMAL;
  a DECIMAL;
  c DECIMAL;
  distance_km DECIMAL;
BEGIN
  -- Convert degrees to radians
  dLat := RADIANS(lat2 - lat1);
  dLon := RADIANS(lon2 - lon1);
  
  -- Haversine formula
  a := SIN(dLat / 2) * SIN(dLat / 2) + 
       COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * 
       SIN(dLon / 2) * SIN(dLon / 2);
  c := 2 * ATAN2(SQRT(a), SQRT(1 - a));
  distance_km := R * c;
  
  -- Convert to meters and round
  RETURN ROUND(distance_km * 1000)::INT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_distance_meters IS 'Calculate distance in meters between two GPS coordinates using Haversine formula';

-- Function to calculate delivery fee based on distance
CREATE OR REPLACE FUNCTION calculate_delivery_fee(distance_meters INT)
RETURNS DECIMAL AS $$
DECLARE
  base_fee CONSTANT DECIMAL := 35.00;
  base_distance CONSTANT INT := 1000; -- 1 km in meters
  additional_distance INT;
  additional_fee DECIMAL;
BEGIN
  -- Base fee for distances up to 1000 meters
  IF distance_meters <= base_distance THEN
    RETURN base_fee;
  END IF;
  
  -- Calculate additional fee: ₱10 per 200 meters after 1km
  additional_distance := distance_meters - base_distance;
  additional_fee := CEIL(additional_distance::DECIMAL / 200) * 10;
  
  RETURN base_fee + additional_fee;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_delivery_fee IS 'Calculate delivery fee: ₱35 base (0-1000m), then +₱10 per 200m';

-- Function to calculate delivery fee from store to customer location
CREATE OR REPLACE FUNCTION calculate_delivery_fee_from_store(
  customer_latitude DECIMAL,
  customer_longitude DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
  store_lat CONSTANT DECIMAL := 6.2178483;
  store_lon CONSTANT DECIMAL := 124.8221226;
  distance INT;
BEGIN
  distance := calculate_distance_meters(store_lat, store_lon, customer_latitude, customer_longitude);
  RETURN calculate_delivery_fee(distance);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_delivery_fee_from_store IS 'Calculate delivery fee from Bite Bonansa store to customer location';
