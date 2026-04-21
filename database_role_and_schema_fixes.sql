-- ============================================================================
-- Essential Database Schema Fixes for User Roles and System Functionality
-- Run this in Supabase SQL Editor to ensure all tables and columns exist
-- ============================================================================

-- 1. Ensure users table has all required columns including role
-- This assumes users table exists (created by Supabase Auth)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'customer';

-- Add check constraint for role values (only if column was just created or constraint doesn't exist)
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

ALTER TABLE users ADD COLUMN IF NOT EXISTS loyalty_balance DECIMAL(10,2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_id VARCHAR(50) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cashier_id VARCHAR(50) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- Add comment for role column
COMMENT ON COLUMN users.role IS 'User role: admin, cashier, rider, or customer';
COMMENT ON COLUMN users.customer_id IS 'Unique customer ID for loyalty program';
COMMENT ON COLUMN users.cashier_id IS 'Unique cashier identification number';

-- Create index on role for faster queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

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
COMMENT ON COLUMN orders.contact_number IS 'Customer contact number for delivery';
COMMENT ON COLUMN orders.delivery_fee IS 'Delivery fee (0 initially, calculated by staff based on GPS)';
COMMENT ON COLUMN orders.delivery_fee_pending IS 'TRUE if delivery fee needs calculation by staff';

-- 4. Create customer_reviews table if it doesn't exist
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

COMMENT ON TABLE customer_reviews IS 'Customer reviews with optional image attachments';
COMMENT ON COLUMN customer_reviews.image_urls IS 'Array of URLs to uploaded review images (max 5 images per review, stored in Supabase Storage)';

-- 5. Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_reviews ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for users table
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

-- 7. RLS Policies for menu_items table
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

-- 8. RLS Policies for orders table
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

-- 9. RLS Policies for customer_reviews table
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

-- 10. Create Storage Bucket for review images (if using Supabase Storage)
-- Note: This needs to be run in the Supabase Dashboard > Storage section
-- or via Supabase API, not in SQL Editor
-- Create a bucket named 'reviews' with public access for review images

-- Verification queries
-- Run these to verify everything is set up correctly:

-- Check if role column exists and has data
SELECT COUNT(*) as user_count, role, COUNT(role) as count_by_role 
FROM users 
GROUP BY role;

-- Check menu items
SELECT COUNT(*) as total_items, 
       COUNT(DISTINCT category) as categories,
       COUNT(CASE WHEN available = true THEN 1 END) as available_items
FROM menu_items;

-- Check customer reviews table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'customer_reviews'
ORDER BY ordinal_position;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Database schema updated successfully!';
  RAISE NOTICE 'Make sure to:';
  RAISE NOTICE '1. Create "reviews" storage bucket in Supabase Dashboard > Storage';
  RAISE NOTICE '2. Set bucket to public access for review images';
  RAISE NOTICE '3. Verify user roles are assigned correctly';
END $$;
