# Supabase Database Setup Requirements

## Date: 2026-04-24

This document outlines the required Supabase database tables and configuration to resolve errors shown in the browser console.

---

## ⚠️ Important: Schema Cache Reload Required

After running any SQL migrations in Supabase SQL Editor, you **MUST reload the schema cache**:

1. Go to **Supabase Dashboard**
2. Navigate to **Project Settings** → **API**
3. Click the **"Reload schema"** button
4. Wait for confirmation

**Why?** Without reloading the schema cache, new columns/tables won't be visible to the REST API, causing 400/404 errors.

---

## 📋 Required Tables

### 1. loyalty_transactions

**Purpose:** Tracks customer loyalty points earnings and spending

**Status:** ⚠️ Check if exists

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('earned', 'spent', 'adjustment')), 
  amount DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL CHECK (balance_after >= 0),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions ON loyalty_transactions(customer_id, created_at DESC);
```

**Used by:**
- Customer dashboard (loyalty balance display)
- Order completion (automatic points earning)
- Checkout page (points redemption)

---

### 2. customer_item_purchases

**Purpose:** Tracks purchase history and most ordered items per customer

**Status:** ⚠️ Check if exists

**Schema:**
```sql
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
```

**Used by:**
- Customer dashboard ("Most Purchased Items" section)
- Automatic tracking when orders are delivered
- Personalized recommendations

---

### 3. customer_reviews

**Purpose:** Customer reviews and feedback with image uploads

**Status:** ⚠️ Check if exists

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS customer_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255),
  review_text TEXT NOT NULL,
  star_rating INT NOT NULL CHECK (star_rating >= 1 AND star_rating <= 5),
  image_urls TEXT[],
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_reviews ON customer_reviews(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON customer_reviews(status, created_at DESC);
```

**Used by:**
- Customer reviews page
- Public testimonials display
- Admin review moderation

---

## 🔐 Row Level Security (RLS)

All tables must have RLS enabled with appropriate policies:

### loyalty_transactions RLS

```sql
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- Customers can view their own transactions
CREATE POLICY "Customers can view own loyalty transactions" 
ON loyalty_transactions FOR SELECT 
USING (auth.uid() = customer_id);

-- Admin/Cashier can view all
CREATE POLICY "Admin/Cashier can view all loyalty transactions"
ON loyalty_transactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'cashier')
  )
);
```

### customer_item_purchases RLS

```sql
ALTER TABLE customer_item_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view own purchases" 
ON customer_item_purchases FOR SELECT 
USING (auth.uid() = customer_id);

CREATE POLICY "Admin can view all purchases"
ON customer_item_purchases FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role = 'admin'
  )
);
```

### customer_reviews RLS

```sql
ALTER TABLE customer_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can CRUD own reviews" 
ON customer_reviews FOR ALL 
USING (auth.uid() = customer_id);

CREATE POLICY "Public can view published reviews"
ON customer_reviews FOR SELECT
USING (status = 'published');
```

---

## 🤖 Database Triggers

### Automatic Loyalty Points Tracking

```sql
CREATE OR REPLACE FUNCTION update_loyalty_on_order_complete()
RETURNS TRIGGER AS $$
DECLARE
  points_earned DECIMAL(10,2);
  current_balance DECIMAL(10,2);
BEGIN
  -- Only award points when order is delivered
  IF NEW.status = 'order_delivered' AND OLD.status != 'order_delivered' THEN
    -- Calculate points (2% for orders ≤ ₱500, 3.5% for orders > ₱500)
    IF NEW.total_amount <= 500 THEN
      points_earned := FLOOR(NEW.total_amount * 0.02);
    ELSE
      points_earned := FLOOR(NEW.total_amount * 0.035);
    END IF;
    
    -- Get current balance
    SELECT COALESCE(SUM(amount), 0) INTO current_balance
    FROM loyalty_transactions
    WHERE customer_id = NEW.customer_id;
    
    -- Insert transaction
    INSERT INTO loyalty_transactions (
      customer_id,
      order_id,
      transaction_type,
      amount,
      balance_after,
      description
    ) VALUES (
      NEW.customer_id,
      NEW.id,
      'earned',
      points_earned,
      current_balance + points_earned,
      'Points earned from order #' || NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_loyalty_on_order_complete
AFTER UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_loyalty_on_order_complete();
```

### Automatic Purchase History Tracking

```sql
CREATE OR REPLACE FUNCTION update_purchase_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Only track when order is delivered
  IF NEW.status = 'order_delivered' AND OLD.status != 'order_delivered' THEN
    -- Update purchase count for each item in the order
    -- This requires order_items table
    INSERT INTO customer_item_purchases (customer_id, menu_item_id, purchase_count, last_purchased_at, total_spent)
    SELECT 
      NEW.customer_id,
      oi.menu_item_id,
      oi.quantity,
      NOW(),
      oi.price * oi.quantity
    FROM order_items oi
    WHERE oi.order_id = NEW.id
    ON CONFLICT (customer_id, menu_item_id) 
    DO UPDATE SET
      purchase_count = customer_item_purchases.purchase_count + EXCLUDED.purchase_count,
      last_purchased_at = NOW(),
      total_spent = customer_item_purchases.total_spent + EXCLUDED.total_spent;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_purchase_history
AFTER UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_purchase_history();
```

---

## 🚀 How to Apply Changes

### Step 1: Run SQL Migration

1. Open **Supabase Dashboard** → **SQL Editor**
2. Copy contents of `SUPABASE_MIGRATION.sql`
3. Paste and click **Run**
4. Verify tables were created:

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('loyalty_transactions', 'customer_item_purchases', 'customer_reviews');
```

Expected output:
```
loyalty_transactions
customer_item_purchases
customer_reviews
```

### Step 2: Reload Schema Cache ⚠️ CRITICAL

1. Go to **Project Settings** → **API**
2. Click **"Reload schema"** button
3. Wait for confirmation message

### Step 3: Verify in Application

1. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
2. Login to customer portal
3. Check browser console - should see NO 404 errors for:
   - `loyalty_transactions`
   - `customer_item_purchases`
   - `customer_reviews`

---

## 🔍 Troubleshooting

### Error: "Could not find the table 'public.loyalty_transactions'"

**Cause:** Schema cache not reloaded after migration

**Fix:** Reload schema cache (Project Settings → API → Reload schema)

---

### Error: "permission denied for table loyalty_transactions"

**Cause:** RLS policies not configured

**Fix:** Run the RLS policy SQL commands above

---

### Error: "column does not exist"

**Cause:** Table structure doesn't match expected schema

**Fix:** 
1. Drop and recreate table
2. Reload schema cache
3. Verify with: `\d loyalty_transactions` in SQL Editor

---

## 📊 Expected Behavior After Setup

### Customer Dashboard
- ✅ Shows loyalty balance (₱0.00 for new users)
- ✅ Shows total earnings
- ✅ Shows current active orders
- ✅ Shows most purchased items (empty for new users)
- ✅ NO 404 errors in console

### Order Flow
- ✅ Complete an order
- ✅ Mark as delivered
- ✅ Points automatically added to loyalty_transactions
- ✅ Purchase count updated in customer_item_purchases

### Reviews Page
- ✅ Can submit reviews
- ✅ Can upload images
- ✅ Reviews saved to database

---

## 📚 Related Files

- `SUPABASE_MIGRATION.sql` - Complete migration script
- `database_complete_schema.sql` - Full database schema
- `ERRORS_FIXED_SUMMARY.md` - Error fixes documentation
- `FIX_SCHEMA_CACHE_ERROR.md` - Schema cache guide

---

## ✅ Verification Checklist

After applying changes:

- [ ] SQL migration executed successfully
- [ ] Schema cache reloaded
- [ ] All three tables exist in database
- [ ] RLS policies enabled and configured
- [ ] Triggers created successfully
- [ ] Browser console shows no 404 errors for tables
- [ ] Customer dashboard loads without errors
- [ ] Loyalty balance displays correctly
- [ ] Test order completion → points earned
- [ ] Test review submission → saved successfully

---

**Last Updated:** 2026-04-24  
**Status:** Ready for deployment
