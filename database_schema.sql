-- ============================================================================
-- Customer Portal Database Schema
-- ============================================================================

-- 1. Enhanced users table (assuming it exists, just showing required columns)
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_balance DECIMAL(10,2) DEFAULT 0;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_id VARCHAR(50) UNIQUE;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- 2. Enhanced menu_items table (assuming it exists)
-- CREATE TABLE IF NOT EXISTS menu_items (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   name VARCHAR(255) NOT NULL,
--   category VARCHAR(100),
--   price DECIMAL(10,2) NOT NULL,
--   image_url TEXT,
--   description TEXT,
--   available BOOLEAN DEFAULT true,
--   created_at TIMESTAMP DEFAULT NOW(),
--   updated_at TIMESTAMP DEFAULT NOW()
-- );

-- 3. Enhanced orders table with customer portal features
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  items JSONB NOT NULL, -- Array of {id, name, price, quantity}
  special_request TEXT,
  
  -- Delivery details
  delivery_address TEXT NOT NULL,
  delivery_latitude DECIMAL(10,8),
  delivery_longitude DECIMAL(11,8),
  delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Pricing
  subtotal DECIMAL(10,2) NOT NULL,
  vat_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  
  -- Payment
  payment_method VARCHAR(50) NOT NULL, -- 'cash', 'gcash', 'points'
  gcash_reference VARCHAR(100),
  points_used DECIMAL(10,2) DEFAULT 0,
  cash_amount DECIMAL(10,2) DEFAULT 0,
  gcash_amount DECIMAL(10,2) DEFAULT 0,
  
  -- Order status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'order_in_queue',
  -- Status values: 'order_in_queue', 'order_in_process', 'out_for_delivery', 'order_delivered', 'cancelled'
  
  -- Earnings calculation
  earnings_percentage DECIMAL(5,2) DEFAULT 0,
  earnings_amount DECIMAL(10,2) DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  accepted_at TIMESTAMP,
  out_for_delivery_at TIMESTAMP,
  delivered_at TIMESTAMP,
  
  -- Relations
  cashier_id UUID REFERENCES users(id),
  rider_id UUID REFERENCES users(id)
);

-- Index for customer orders lookup
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- 4. Order items purchased tracking (for "most purchased items" feature)
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

-- 5. Customer reviews (Share your favorite bites)
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

-- 6. Points/Earnings transaction history
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

-- 7. Function to calculate earnings percentage
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

-- 8. Function to update customer purchase tracking
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

-- 11. Trigger to add loyalty points
DROP TRIGGER IF EXISTS trigger_add_loyalty_points ON orders;
CREATE TRIGGER trigger_add_loyalty_points
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'order_delivered')
  EXECUTE FUNCTION add_loyalty_points();

-- 12. Row Level Security (RLS) policies

-- Enable RLS on tables
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_item_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- Orders policies
CREATE POLICY "Customers can view their own orders" ON orders
  FOR SELECT USING (auth.uid() = customer_id);

CREATE POLICY "Customers can create their own orders" ON orders
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Staff can view all orders" ON orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'cashier', 'rider')
    )
  );

CREATE POLICY "Staff can update orders" ON orders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'cashier', 'rider')
    )
  );

-- Customer purchases policies
CREATE POLICY "Customers can view their own purchases" ON customer_item_purchases
  FOR SELECT USING (auth.uid() = customer_id);

-- Reviews policies
CREATE POLICY "Customers can view their own reviews" ON customer_reviews
  FOR SELECT USING (auth.uid() = customer_id);

CREATE POLICY "Customers can create reviews" ON customer_reviews
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can update their own reviews" ON customer_reviews
  FOR UPDATE USING (auth.uid() = customer_id);

CREATE POLICY "Staff can view all reviews" ON customer_reviews
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'cashier')
    )
  );

CREATE POLICY "Staff can update review status" ON customer_reviews
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

-- Loyalty transactions policies
CREATE POLICY "Customers can view their own transactions" ON loyalty_transactions
  FOR SELECT USING (auth.uid() = customer_id);

CREATE POLICY "Staff can view all transactions" ON loyalty_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'cashier')
    )
  );
