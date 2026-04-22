# Database Migration Guide - Customer Portal Tables

This guide provides SQL commands to create the missing tables required for the customer portal functionality.

## Overview

The following tables need to be created in Supabase:
1. `loyalty_transactions` - Tracks customer loyalty points
2. `customer_item_purchases` - Tracks customer purchase history
3. `customer_reviews` - Stores customer reviews and ratings

## Prerequisites

- Access to Supabase SQL Editor
- Admin/Owner permissions on the Supabase project

## Migration Steps

### Step 1: Apply the Complete Schema

The complete schema is available in `database_complete_schema.sql`. You can apply it in two ways:

#### Option A: Using Supabase Dashboard (Recommended)

1. Log in to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the contents of `database_complete_schema.sql`
5. Paste into the SQL Editor
6. Click **Run** to execute

#### Option B: Using Individual Table Statements

Run the following SQL statements one by one in the Supabase SQL Editor:

```sql
-- 1. Create loyalty_transactions table
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

-- 2. Create customer_item_purchases table
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

-- 3. Create customer_reviews table
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

-- 4. Enable Row Level Security (RLS)
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_item_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_reviews ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for loyalty_transactions
CREATE POLICY "Customers can view their own loyalty transactions" ON loyalty_transactions
  FOR SELECT USING (auth.uid() = customer_id);

CREATE POLICY "Staff can view all loyalty transactions" ON loyalty_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

CREATE POLICY "System can insert loyalty transactions" ON loyalty_transactions
  FOR INSERT WITH CHECK (true);

-- 6. RLS Policies for customer_item_purchases
CREATE POLICY "Customers can view their own purchases" ON customer_item_purchases
  FOR SELECT USING (auth.uid() = customer_id);

CREATE POLICY "Staff can view all purchases" ON customer_item_purchases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

CREATE POLICY "System can manage purchase tracking" ON customer_item_purchases
  FOR ALL USING (true);

-- 7. RLS Policies for customer_reviews
CREATE POLICY "Customers can view their own reviews" ON customer_reviews
  FOR SELECT USING (auth.uid() = customer_id);

CREATE POLICY "Customers can create reviews" ON customer_reviews
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can update their own reviews" ON customer_reviews
  FOR UPDATE USING (auth.uid() = customer_id);

CREATE POLICY "Customers can delete their own reviews" ON customer_reviews
  FOR DELETE USING (auth.uid() = customer_id);

CREATE POLICY "Staff can view all reviews" ON customer_reviews
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

CREATE POLICY "Staff can manage reviews" ON customer_reviews
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

-- 8. Trigger function to update customer purchases
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

DROP TRIGGER IF EXISTS trigger_update_customer_purchases ON orders;
CREATE TRIGGER trigger_update_customer_purchases
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'order_delivered')
  EXECUTE FUNCTION update_customer_purchases();

-- 9. Trigger function to add loyalty points
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
    
    -- Record transaction (only if earnings_amount is set)
    IF NEW.earnings_amount IS NOT NULL AND NEW.earnings_amount > 0 THEN
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
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_add_loyalty_points ON orders;
CREATE TRIGGER trigger_add_loyalty_points
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'order_delivered')
  EXECUTE FUNCTION add_loyalty_points();
```

### Step 2: Verify Tables Were Created

Run this query to verify all tables exist:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('loyalty_transactions', 'customer_item_purchases', 'customer_reviews')
ORDER BY table_name;
```

Expected output: 3 rows showing the three table names.

### Step 3: Verify RLS Policies

Run this query to verify RLS policies:

```sql
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('loyalty_transactions', 'customer_item_purchases', 'customer_reviews')
ORDER BY tablename, policyname;
```

### Step 4: Create Storage Bucket for Review Images

1. Navigate to **Storage** in Supabase Dashboard
2. Click **New Bucket**
3. Configure the bucket:
   - **Name**: `reviews`
   - **Public**: ✅ Checked
   - **File size limit**: 5MB
   - **Allowed MIME types**: image/jpeg, image/png, image/webp, image/gif

4. Add storage policies:

```sql
-- Allow authenticated users to upload
CREATE POLICY "Allow authenticated users to upload review images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'reviews');

-- Allow public read access
CREATE POLICY "Allow public read access to review images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'reviews');

-- Allow users to update/delete their own files
CREATE POLICY "Allow users to manage their own review images"
ON storage.objects FOR UPDATE, DELETE
TO authenticated
USING (bucket_id = 'reviews' AND auth.uid()::text = (storage.foldername(name))[1]);
```

## Verification Checklist

After applying the migration, verify:

- [ ] All three tables are created
- [ ] Indexes are created on all tables
- [ ] RLS is enabled on all tables
- [ ] All RLS policies are created
- [ ] Triggers are created and active
- [ ] Storage bucket `reviews` is created
- [ ] Storage policies are applied

## Troubleshooting

### Table already exists error
If you see "table already exists" errors, it's safe to ignore them. The `IF NOT EXISTS` clause ensures the script is idempotent.

### RLS policy errors
If RLS policies fail to create, drop them first:
```sql
DROP POLICY IF EXISTS "policy_name" ON table_name;
```

### Missing columns in orders table
If you get errors about missing columns in the `orders` table (like `earnings_amount`), you may need to run the `database_schema_updates.sql` first.

## Rollback (If Needed)

To remove these tables (⚠️ WARNING: This will delete all data):

```sql
DROP TRIGGER IF EXISTS trigger_update_customer_purchases ON orders;
DROP TRIGGER IF EXISTS trigger_add_loyalty_points ON orders;
DROP FUNCTION IF EXISTS update_customer_purchases();
DROP FUNCTION IF EXISTS add_loyalty_points();
DROP TABLE IF EXISTS customer_reviews CASCADE;
DROP TABLE IF EXISTS customer_item_purchases CASCADE;
DROP TABLE IF EXISTS loyalty_transactions CASCADE;
```

## Next Steps

After migration:
1. Configure Google Maps API key in `.env.local`
2. Test customer portal features
3. Monitor error logs for any issues
4. Create test orders to verify triggers are working

## Related Files

- `database_complete_schema.sql` - Complete schema with all tables
- `database_schema_updates.sql` - Additional schema updates
- `STORAGE_BUCKET_SETUP.md` - Storage bucket configuration guide
- `DATABASE_FIXES_SUMMARY.md` - Summary of all database fixes
