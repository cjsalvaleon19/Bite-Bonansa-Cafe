-- ============================================================================
-- Complete Database Migration for Bite Bonansa Cafe
-- Run this in Supabase SQL Editor to create all missing tables
-- ============================================================================
-- This migration creates all tables required by the customer portal, rider portal,
-- cashier portal, and admin portal, including loyalty system and review features.
-- ============================================================================

-- 1. Ensure users table has all required columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'customer';
ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_balance DECIMAL(10,2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_id VARCHAR(50) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cashier_id VARCHAR(50) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Add role constraint
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'users_role_check' 
    AND table_name = 'users'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('admin', 'cashier', 'rider', 'customer'));
  END IF;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Comments
COMMENT ON COLUMN users.role IS 'User role: admin, cashier, rider, or customer';
COMMENT ON COLUMN users.customer_id IS 'Unique customer ID for loyalty program';
COMMENT ON COLUMN users.cashier_id IS 'Unique cashier identification number';

-- 2. Ensure menu_items table exists
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  description TEXT,
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(available);

-- 3. Ensure orders table has all required columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_mode VARCHAR(50);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number VARCHAR(100) UNIQUE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS contact_number VARCHAR(20);

COMMENT ON COLUMN orders.order_mode IS 'Order type: dine-in, take-out, pick-up, delivery';
COMMENT ON COLUMN orders.order_number IS 'Unique order number for tracking';

-- 4. Create customer_item_purchases table
CREATE TABLE IF NOT EXISTS customer_item_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  purchase_count INT NOT NULL DEFAULT 0,
  last_purchased_at TIMESTAMP DEFAULT NOW(),
  total_spent DECIMAL(10,2) DEFAULT 0,
  
  UNIQUE(customer_id, menu_item_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_purchases ON customer_item_purchases(customer_id, purchase_count DESC);

COMMENT ON TABLE customer_item_purchases IS 'Tracks customer purchase history for personalized recommendations';

-- 5. Create customer_reviews table
CREATE TABLE IF NOT EXISTS customer_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255),
  review_text TEXT NOT NULL,
  star_rating INT NOT NULL CHECK (star_rating >= 1 AND star_rating <= 5),
  image_urls TEXT[] CHECK (array_length(image_urls, 1) IS NULL OR array_length(image_urls, 1) <= 5), -- Max 5 images
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'published', 'archived'
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_customer ON customer_reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON customer_reviews(status);

COMMENT ON TABLE customer_reviews IS 'Customer reviews with optional image attachments';
COMMENT ON COLUMN customer_reviews.image_urls IS 'Array of URLs to uploaded review images (max 5 per review)';

-- 6. Create loyalty_transactions table
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  transaction_type VARCHAR(50) NOT NULL, -- 'earned', 'spent', 'adjustment'
  amount DECIMAL(10,2) NOT NULL, -- positive for earned, negative for spent
  balance_after DECIMAL(10,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions ON loyalty_transactions(customer_id, created_at DESC);

COMMENT ON TABLE loyalty_transactions IS 'Tracks loyalty points earned and spent by customers';

-- 7. Create cash_drawer_transactions table
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
  reference_number VARCHAR(100),
  adjustment_reason VARCHAR(255),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_drawer_cashier ON cash_drawer_transactions(cashier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_drawer_date ON cash_drawer_transactions(created_at DESC);

COMMENT ON TABLE cash_drawer_transactions IS 'Tracks cash drawer transactions for reconciliation';

-- 8. Create delivery_reports table
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

-- 9. Create delivery_billing_notifications table
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

-- 10. Create deliveries table
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

-- 11. Create riders table
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

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to calculate earnings percentage
CREATE OR REPLACE FUNCTION calculate_earnings_percentage(order_subtotal DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
  -- 2% if total cost is below 500.00
  -- 5% if 500.00 and above
  IF order_subtotal < 500.00 THEN
    RETURN 2.00;
  ELSE
    RETURN 5.00;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_earnings_percentage IS 'Calculate loyalty earnings: 2% (<₱500), 5% (≥₱500)';

-- Function to update customer purchase tracking
CREATE OR REPLACE FUNCTION update_customer_purchases()
RETURNS TRIGGER AS $$
DECLARE
  item JSONB;
  menu_item_id_val UUID;
  item_price DECIMAL;
  item_quantity INT;
  item_total DECIMAL;
BEGIN
  -- Only process completed orders
  IF NEW.status = 'order_delivered' THEN
    -- Loop through each item in the order
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
    LOOP
      menu_item_id_val := (item->>'id')::UUID;
      item_price := (item->>'price')::DECIMAL;
      item_quantity := (item->>'quantity')::INT;
      item_total := item_price * item_quantity;
      
      -- Insert or update customer_item_purchases
      INSERT INTO customer_item_purchases (customer_id, menu_item_id, purchase_count, total_spent, last_purchased_at)
      VALUES (NEW.customer_id, menu_item_id_val, item_quantity, item_total, NOW())
      ON CONFLICT (customer_id, menu_item_id)
      DO UPDATE SET
        purchase_count = customer_item_purchases.purchase_count + item_quantity,
        total_spent = customer_item_purchases.total_spent + item_total,
        last_purchased_at = NOW();
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update purchase tracking
DROP TRIGGER IF EXISTS trigger_update_customer_purchases ON orders;
CREATE TRIGGER trigger_update_customer_purchases
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'order_delivered')
  EXECUTE FUNCTION update_customer_purchases();

-- Function to add loyalty points when order is delivered
CREATE OR REPLACE FUNCTION add_loyalty_points()
RETURNS TRIGGER AS $$
BEGIN
  -- Only add points when order is delivered
  IF NEW.status = 'order_delivered' AND OLD.status != 'order_delivered' THEN
    -- Update customer loyalty balance
    UPDATE users
    SET loyalty_balance = loyalty_balance + NEW.earnings_amount
    WHERE id = NEW.customer_id;
    
    -- Record transaction
    INSERT INTO loyalty_transactions (customer_id, order_id, transaction_type, amount, balance_after, description)
    SELECT NEW.customer_id, NEW.id, 'earned', NEW.earnings_amount, 
           (SELECT loyalty_balance FROM users WHERE id = NEW.customer_id),
           'Earned from order #' || NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to add loyalty points
DROP TRIGGER IF EXISTS trigger_add_loyalty_points ON orders;
CREATE TRIGGER trigger_add_loyalty_points
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'order_delivered')
  EXECUTE FUNCTION add_loyalty_points();

-- Function to update order timestamps
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

-- Delivery fee calculator functions
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

CREATE OR REPLACE FUNCTION calculate_delivery_fee_from_store(
  customer_latitude DECIMAL,
  customer_longitude DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
  -- Bite Bonansa Cafe store location in T'boli, South Cotabato, Philippines
  -- Coordinates: 6.2178483°N, 124.8221226°E
  -- Note: Update these coordinates if the store location changes
  store_lat CONSTANT DECIMAL := 6.2178483;
  store_lon CONSTANT DECIMAL := 124.8221226;
  distance INT;
BEGIN
  distance := calculate_distance_meters(store_lat, store_lon, customer_latitude, customer_longitude);
  RETURN calculate_delivery_fee(distance);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_delivery_fee_from_store IS 'Calculate delivery fee from Bite Bonansa store (6.2178483, 124.8221226) to customer location';

-- Create view for cashier dashboard stats
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

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_item_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_drawer_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_billing_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE riders ENABLE ROW LEVEL SECURITY;

-- Users table policies
DROP POLICY IF EXISTS "Users can view their own data" ON users;
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own data" ON users;
CREATE POLICY "Users can update their own data" ON users
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Staff can view all users" ON users;
CREATE POLICY "Staff can view all users" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

-- Menu items policies
DROP POLICY IF EXISTS "Anyone can view available menu items" ON menu_items;
CREATE POLICY "Anyone can view available menu items" ON menu_items
  FOR SELECT USING (available = true OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Staff can manage menu items" ON menu_items;
CREATE POLICY "Staff can manage menu items" ON menu_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

-- Orders policies
DROP POLICY IF EXISTS "Customers can view their own orders" ON orders;
CREATE POLICY "Customers can view their own orders" ON orders
  FOR SELECT USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers can create orders" ON orders;
CREATE POLICY "Customers can create orders" ON orders
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Staff can view all orders" ON orders;
CREATE POLICY "Staff can view all orders" ON orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier', 'rider')
    )
  );

DROP POLICY IF EXISTS "Staff can update orders" ON orders;
CREATE POLICY "Staff can update orders" ON orders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier', 'rider')
    )
  );

-- Customer purchases policies
DROP POLICY IF EXISTS "Customers can view their own purchases" ON customer_item_purchases;
CREATE POLICY "Customers can view their own purchases" ON customer_item_purchases
  FOR SELECT USING (auth.uid() = customer_id);

-- Reviews policies
DROP POLICY IF EXISTS "Customers can view their own reviews" ON customer_reviews;
CREATE POLICY "Customers can view their own reviews" ON customer_reviews
  FOR SELECT USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers can create reviews" ON customer_reviews;
CREATE POLICY "Customers can create reviews" ON customer_reviews
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers can update their own reviews" ON customer_reviews;
CREATE POLICY "Customers can update their own reviews" ON customer_reviews
  FOR UPDATE USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Staff can view all reviews" ON customer_reviews;
CREATE POLICY "Staff can view all reviews" ON customer_reviews
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

DROP POLICY IF EXISTS "Staff can update review status" ON customer_reviews;
CREATE POLICY "Staff can update review status" ON customer_reviews
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

-- Loyalty transactions policies
DROP POLICY IF EXISTS "Customers can view their own transactions" ON loyalty_transactions;
CREATE POLICY "Customers can view their own transactions" ON loyalty_transactions
  FOR SELECT USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Staff can view all transactions" ON loyalty_transactions;
CREATE POLICY "Staff can view all transactions" ON loyalty_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

-- Cash drawer transactions policies
DROP POLICY IF EXISTS "Cashiers can view their own transactions" ON cash_drawer_transactions;
CREATE POLICY "Cashiers can view their own transactions" ON cash_drawer_transactions
  FOR SELECT USING (auth.uid() = cashier_id);

DROP POLICY IF EXISTS "Cashiers can create transactions" ON cash_drawer_transactions;
CREATE POLICY "Cashiers can create transactions" ON cash_drawer_transactions
  FOR INSERT WITH CHECK (auth.uid() = cashier_id);

DROP POLICY IF EXISTS "Admin can view all cash transactions" ON cash_drawer_transactions;
CREATE POLICY "Admin can view all cash transactions" ON cash_drawer_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- Delivery reports policies
DROP POLICY IF EXISTS "Riders can view their own reports" ON delivery_reports;
CREATE POLICY "Riders can view their own reports" ON delivery_reports
  FOR SELECT USING (auth.uid() = rider_id);

DROP POLICY IF EXISTS "Riders can create their own reports" ON delivery_reports;
CREATE POLICY "Riders can create their own reports" ON delivery_reports
  FOR INSERT WITH CHECK (auth.uid() = rider_id);

DROP POLICY IF EXISTS "Staff can view all delivery reports" ON delivery_reports;
CREATE POLICY "Staff can view all delivery reports" ON delivery_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

-- Delivery billing notifications policies
DROP POLICY IF EXISTS "Riders can view their own billing notifications" ON delivery_billing_notifications;
CREATE POLICY "Riders can view their own billing notifications" ON delivery_billing_notifications
  FOR SELECT USING (auth.uid() = rider_id);

DROP POLICY IF EXISTS "Cashiers can view billing notifications" ON delivery_billing_notifications;
CREATE POLICY "Cashiers can view billing notifications" ON delivery_billing_notifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('cashier', 'admin')
    )
  );

DROP POLICY IF EXISTS "Riders can create billing notifications" ON delivery_billing_notifications;
CREATE POLICY "Riders can create billing notifications" ON delivery_billing_notifications
  FOR INSERT WITH CHECK (auth.uid() = rider_id);

-- Deliveries policies
DROP POLICY IF EXISTS "Riders can view their assigned deliveries" ON deliveries;
CREATE POLICY "Riders can view their assigned deliveries" ON deliveries
  FOR SELECT USING (auth.uid() = rider_id);

DROP POLICY IF EXISTS "Staff can view all deliveries" ON deliveries;
CREATE POLICY "Staff can view all deliveries" ON deliveries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

DROP POLICY IF EXISTS "Staff can create deliveries" ON deliveries;
CREATE POLICY "Staff can create deliveries" ON deliveries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

DROP POLICY IF EXISTS "Riders can update their deliveries" ON deliveries;
CREATE POLICY "Riders can update their deliveries" ON deliveries
  FOR UPDATE USING (auth.uid() = rider_id);

-- Riders policies
DROP POLICY IF EXISTS "Riders can view their own profile" ON riders;
CREATE POLICY "Riders can view their own profile" ON riders
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Riders can update their own profile" ON riders;
CREATE POLICY "Riders can update their own profile" ON riders
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Staff can view all rider profiles" ON riders;
CREATE POLICY "Staff can view all rider profiles" ON riders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Database migration completed successfully!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Create "reviews" storage bucket in Supabase Dashboard > Storage';
  RAISE NOTICE '2. Set bucket to public access for review images';
  RAISE NOTICE '3. Configure bucket policies to allow authenticated uploads';
  RAISE NOTICE '4. Verify user roles are assigned correctly';
  RAISE NOTICE '5. Test the application features';
  RAISE NOTICE '========================================';
END $$;
