-- ============================================================================
-- Bite Bonansa Cafe - Complete Database Schema
-- Includes all missing tables and updated delivery fee calculation
-- ============================================================================

-- 1. Create loyalty_transactions table for customer points tracking
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

COMMENT ON TABLE loyalty_transactions IS 'Tracks customer loyalty points earnings and spending';

-- 2. Create customer_item_purchases table for purchase history tracking
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

COMMENT ON TABLE customer_item_purchases IS 'Tracks most purchased items by customers';

-- 3. Create customer_reviews table for customer feedback
CREATE TABLE IF NOT EXISTS customer_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255),
  review_text TEXT NOT NULL,
  star_rating INT NOT NULL CHECK (star_rating >= 1 AND star_rating <= 5),
  image_urls TEXT[], -- Array of image URLs
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'published', 'archived'
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_customer ON customer_reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON customer_reviews(status);

COMMENT ON TABLE customer_reviews IS 'Customer reviews and ratings';

-- 4. Enable RLS on new tables
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_item_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_reviews ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for loyalty_transactions
DROP POLICY IF EXISTS "Customers can view their own loyalty transactions" ON loyalty_transactions;
CREATE POLICY "Customers can view their own loyalty transactions" ON loyalty_transactions
  FOR SELECT USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Staff can view all loyalty transactions" ON loyalty_transactions;
CREATE POLICY "Staff can view all loyalty transactions" ON loyalty_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

DROP POLICY IF EXISTS "System can insert loyalty transactions" ON loyalty_transactions;
CREATE POLICY "System can insert loyalty transactions" ON loyalty_transactions
  FOR INSERT WITH CHECK (true);

-- 6. RLS Policies for customer_item_purchases
DROP POLICY IF EXISTS "Customers can view their own purchases" ON customer_item_purchases;
CREATE POLICY "Customers can view their own purchases" ON customer_item_purchases
  FOR SELECT USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Staff can view all purchases" ON customer_item_purchases;
CREATE POLICY "Staff can view all purchases" ON customer_item_purchases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

DROP POLICY IF EXISTS "System can manage purchase tracking" ON customer_item_purchases;
CREATE POLICY "System can manage purchase tracking" ON customer_item_purchases
  FOR ALL USING (true);

-- 7. RLS Policies for customer_reviews
DROP POLICY IF EXISTS "Customers can view their own reviews" ON customer_reviews;
CREATE POLICY "Customers can view their own reviews" ON customer_reviews
  FOR SELECT USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers can create reviews" ON customer_reviews;
CREATE POLICY "Customers can create reviews" ON customer_reviews
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers can update their own reviews" ON customer_reviews;
CREATE POLICY "Customers can update their own reviews" ON customer_reviews
  FOR UPDATE USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers can delete their own reviews" ON customer_reviews;
CREATE POLICY "Customers can delete their own reviews" ON customer_reviews
  FOR DELETE USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Staff can view all reviews" ON customer_reviews;
CREATE POLICY "Staff can view all reviews" ON customer_reviews
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

DROP POLICY IF EXISTS "Staff can manage reviews" ON customer_reviews;
CREATE POLICY "Staff can manage reviews" ON customer_reviews
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

-- 8. Function to update customer purchases when order is delivered
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
  IF NEW.status = 'order_delivered' AND OLD.status != 'order_delivered' THEN
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

-- 9. Trigger to update purchase tracking
DROP TRIGGER IF EXISTS trigger_update_customer_purchases ON orders;
CREATE TRIGGER trigger_update_customer_purchases
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'order_delivered')
  EXECUTE FUNCTION update_customer_purchases();

-- 10. Function to add loyalty points when order is delivered
CREATE OR REPLACE FUNCTION add_loyalty_points()
RETURNS TRIGGER AS $$
DECLARE
  current_balance DECIMAL;
BEGIN
  -- Only add points when order is delivered
  IF NEW.status = 'order_delivered' AND (OLD.status IS NULL OR OLD.status != 'order_delivered') THEN
    -- Get current balance
    SELECT COALESCE(balance_after, 0) 
    INTO current_balance
    FROM loyalty_transactions
    WHERE customer_id = NEW.customer_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- If no previous transactions, start with 0
    IF current_balance IS NULL THEN
      current_balance := 0;
    END IF;
    
    -- Record transaction
    INSERT INTO loyalty_transactions (customer_id, order_id, transaction_type, amount, balance_after, description)
    VALUES (
      NEW.customer_id, 
      NEW.id, 
      'earned', 
      NEW.earnings_amount,
      current_balance + NEW.earnings_amount,
      'Earned from order #' || NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. Trigger to add loyalty points
DROP TRIGGER IF EXISTS trigger_add_loyalty_points ON orders;
CREATE TRIGGER trigger_add_loyalty_points
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'order_delivered')
  EXECUTE FUNCTION add_loyalty_points();

-- 12. Function to calculate distance between two coordinates using Haversine formula
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

COMMENT ON FUNCTION calculate_distance_meters(DECIMAL, DECIMAL, DECIMAL, DECIMAL) IS 'Calculate distance in meters between two GPS coordinates using Haversine formula';

-- 13. Function to calculate delivery fee based on distance
-- New pricing scheme: ₱30 base fare + tiered additional fees (capped at ₱98 for 10km)
CREATE OR REPLACE FUNCTION calculate_delivery_fee(distance_meters INT)
RETURNS DECIMAL AS $$
DECLARE
  base_fee CONSTANT DECIMAL := 30.00;
  additional_fee DECIMAL := 0.00;
BEGIN
  -- Base fee for distances up to 1000 meters
  IF distance_meters <= 1000 THEN
    RETURN base_fee;
  -- Distance ranges with fixed additional fees
  ELSIF distance_meters <= 1500 THEN
    additional_fee := 5.00;
  ELSIF distance_meters <= 2000 THEN
    additional_fee := 10.00;
  ELSIF distance_meters <= 2500 THEN
    additional_fee := 15.00;
  ELSIF distance_meters <= 3000 THEN
    additional_fee := 20.00;
  ELSIF distance_meters <= 3500 THEN
    additional_fee := 24.00;
  ELSIF distance_meters <= 4000 THEN
    additional_fee := 28.00;
  ELSIF distance_meters <= 4500 THEN
    additional_fee := 32.00;
  ELSIF distance_meters <= 5000 THEN
    additional_fee := 36.00;
  ELSIF distance_meters <= 5500 THEN
    additional_fee := 40.00;
  ELSIF distance_meters <= 6000 THEN
    additional_fee := 44.00;
  ELSIF distance_meters <= 6500 THEN
    additional_fee := 47.00;
  ELSIF distance_meters <= 7000 THEN
    additional_fee := 50.00;
  ELSIF distance_meters <= 7500 THEN
    additional_fee := 53.00;
  ELSIF distance_meters <= 8000 THEN
    additional_fee := 56.00;
  ELSIF distance_meters <= 8500 THEN
    additional_fee := 59.00;
  ELSIF distance_meters <= 9000 THEN
    additional_fee := 62.00;
  ELSIF distance_meters <= 9500 THEN
    additional_fee := 65.00;
  ELSE
    -- Cap at 10000m (₱30 + ₱68 = ₱98)
    additional_fee := 68.00;
  END IF;
  
  RETURN base_fee + additional_fee;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_delivery_fee(INT) IS 'Calculate delivery fee: ₱30 base + tiered additional fees (capped at ₱98 for 10km)';

-- 14. Function to calculate delivery fee from store to customer location
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

COMMENT ON FUNCTION calculate_delivery_fee_from_store(DECIMAL, DECIMAL) IS 'Calculate delivery fee from Bite Bonansa store to customer location';

-- ============================================================================
-- Storage Bucket Configuration (Run via Supabase Dashboard)
-- ============================================================================
-- Note: Storage buckets must be created via the Supabase Dashboard or API
-- 
-- Bucket Name: reviews
-- Public: true
-- File Size Limit: 5MB
-- Allowed MIME Types: image/jpeg, image/png, image/webp, image/gif
--
-- To create the bucket:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Click "New Bucket"
-- 3. Name: "reviews"
-- 4. Check "Public bucket"
-- 5. Set file size limit to 5MB
-- 6. Configure allowed MIME types
--
-- Bucket policies (apply after creating the bucket):
-- Policy 1: Allow authenticated users to upload
-- Policy 2: Allow public read access
-- Policy 3: Allow users to update/delete their own files
-- ============================================================================
