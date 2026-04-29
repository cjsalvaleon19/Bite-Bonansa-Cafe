-- ============================================================================
-- Create Missing Loyalty and Purchase Tracking Tables
-- Fixes:
-- 1. "[CustomerDashboard] Error fetching purchase history: Could not find a 
--     relationship between 'customer_item_purchases' and 'menu_items'"
-- 2. "[OrdersQueue] Failed to complete pickup order: column 'balance_after' 
--     does not exist"
-- ============================================================================

-- 1. Create loyalty_transactions table for customer points tracking
-- Note: This table includes the balance_after column that was missing
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  transaction_type VARCHAR(50) NOT NULL, -- 'earned', 'spent', 'adjustment'
  amount DECIMAL(10,2) NOT NULL, -- positive for earned, negative for spent
  balance_after DECIMAL(10,2) NOT NULL, -- This fixes the "column does not exist" error
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions ON loyalty_transactions(customer_id, created_at DESC);

COMMENT ON TABLE loyalty_transactions IS 'Tracks customer loyalty points earnings and spending';
COMMENT ON COLUMN loyalty_transactions.balance_after IS 'Running balance after this transaction';

-- 2. Create customer_item_purchases table for purchase history tracking
-- This table has a proper foreign key relationship to menu_items
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
CREATE INDEX IF NOT EXISTS idx_customer_purchases_item ON customer_item_purchases(menu_item_id);

COMMENT ON TABLE customer_item_purchases IS 'Tracks most purchased items by customers';

-- 3. Enable RLS on new tables
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_item_purchases ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for loyalty_transactions
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

DROP POLICY IF EXISTS "System can update loyalty transactions" ON loyalty_transactions;
CREATE POLICY "System can update loyalty transactions" ON loyalty_transactions
  FOR UPDATE USING (true);

-- 5. RLS Policies for customer_item_purchases
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

-- 6. Create customer_reviews table (if needed for future functionality)
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

-- Enable RLS on customer_reviews
ALTER TABLE customer_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customer_reviews
DROP POLICY IF EXISTS "Customers can view their own reviews" ON customer_reviews;
CREATE POLICY "Customers can view their own reviews" ON customer_reviews
  FOR SELECT USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Everyone can view published reviews" ON customer_reviews;
CREATE POLICY "Everyone can view published reviews" ON customer_reviews
  FOR SELECT USING (status = 'published');

DROP POLICY IF EXISTS "Customers can insert their own reviews" ON customer_reviews;
CREATE POLICY "Customers can insert their own reviews" ON customer_reviews
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customers can update their own pending reviews" ON customer_reviews;
CREATE POLICY "Customers can update their own pending reviews" ON customer_reviews
  FOR UPDATE USING (auth.uid() = customer_id AND status = 'pending');

DROP POLICY IF EXISTS "Staff can manage all reviews" ON customer_reviews;
CREATE POLICY "Staff can manage all reviews" ON customer_reviews
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

-- 7. Add helper function to update purchase tracking (optional, for automation)
CREATE OR REPLACE FUNCTION update_customer_purchase_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Only track completed orders
  IF NEW.status = 'order_delivered' OR NEW.status = 'completed' THEN
    -- Update purchase counts for each item in the order
    -- This will be populated by the application layer for now
    NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: The trigger is commented out for now, as the application handles this logic
-- CREATE TRIGGER trg_update_purchase_history
--   AFTER UPDATE ON orders
--   FOR EACH ROW
--   WHEN (NEW.status IN ('order_delivered', 'completed'))
--   EXECUTE FUNCTION update_customer_purchase_history();

COMMENT ON FUNCTION update_customer_purchase_history IS 'Helper function for purchase history tracking (currently handled by application)';
