# Quick Database Setup Guide

This guide will help you complete the database setup in Supabase to fix all remaining issues.

## Prerequisites

- Access to your Supabase project dashboard
- SQL Editor access in Supabase

## Step 1: Add Menu Items (5 minutes)

1. Open Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Copy the entire content of `menu_items_insert.sql`
4. Paste into the query editor
5. Click "Run" or press Ctrl+Enter
6. Verify success:
   ```sql
   SELECT COUNT(*) FROM menu_items;
   -- Should return ~283 items
   
   SELECT category, COUNT(*) as count 
   FROM menu_items 
   GROUP BY category 
   ORDER BY category;
   -- Should show 16 categories
   ```

## Step 2: Create Customer Reviews Table (2 minutes)

1. In SQL Editor, create a new query
2. Copy and paste this SQL:

```sql
-- Create customer_reviews table
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_reviews_customer ON customer_reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON customer_reviews(status);

-- Enable Row Level Security
ALTER TABLE customer_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies
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
      AND users.role IN ('admin', 'cashier')
    )
  );
```

3. Click "Run"
4. Verify success:
   ```sql
   SELECT * FROM customer_reviews LIMIT 1;
   -- Should return empty result (table exists but no data yet)
   ```

## Step 3: Fix Rider Portal Access (if needed)

If the rider account is still showing customer portal:

### Option A: Check Current Role

```sql
SELECT email, role FROM users WHERE email = 'johndave0991@gmail.com';
```

If the role is NOT 'rider', proceed to Option B.

### Option B: Update Role

```sql
UPDATE users 
SET role = 'rider' 
WHERE email = 'johndave0991@gmail.com';
```

### Option C: Rider Hasn't Registered Yet

If the query in Option A returns no results, the rider account doesn't exist yet.

**Solution:**
1. Have the rider register at your app's registration page
2. Use the exact email: `johndave0991@gmail.com`
3. The system will automatically assign the 'rider' role
4. After registration, they should be able to access `/rider/dashboard`

## Step 4: Verify All Tables Exist

Run this query to check all required tables:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'users',
  'menu_items',
  'orders',
  'loyalty_transactions',
  'customer_reviews',
  'customer_item_purchases',
  'cash_drawer_transactions',
  'delivery_reports',
  'deliveries',
  'riders'
)
ORDER BY table_name;
```

Expected tables:
- ✓ users
- ✓ menu_items
- ✓ orders
- ✓ loyalty_transactions (for loyalty balance)
- ✓ customer_reviews (should exist after Step 2)
- ✓ customer_item_purchases
- ✓ cash_drawer_transactions
- ✓ delivery_reports
- ✓ deliveries
- ✓ riders

If any tables are missing, run the full schema:

```bash
# In Supabase SQL Editor
# Run: database_schema.sql
# Then: database_schema_updates.sql (if applicable)
```

## Step 5: Test Everything

### Test 1: Login and Check Console
1. Open your app in browser
2. Open Developer Tools (F12)
3. Go to Console tab
4. Login with any account
5. **Expected:** No errors about `loyalty_balance` or `customer_reviews`

### Test 2: Customer Portal
1. Login as a customer
2. Click "Order Portal" in navigation
3. **Expected:** See menu items grouped by category
4. Try adding items to cart

### Test 3: Customer Reviews
1. Still logged in as customer
2. Click "Share Review" in navigation
3. **Expected:** Page loads without 404 errors
4. Try creating a review (should work)

### Test 4: Rider Portal (if applicable)
1. Login with: `johndave0991@gmail.com`
2. **Expected:** Automatically redirected to `/rider/dashboard`
3. Should see rider-specific interface, not customer portal

### Test 5: Loyalty Balance
1. Login as a customer
2. Go to Profile page
3. **Expected:** Loyalty Balance shows ₱0.00 (no errors)
4. Go to Dashboard
5. **Expected:** Total Points Earned shows ₱0.00 (no errors)

## Troubleshooting

### "relation customer_reviews does not exist"
- **Solution:** Run Step 2 again
- Verify table creation: `\dt customer_reviews` or check in Table Editor

### "column users.loyalty_balance does not exist"
- **Solution:** Clear browser cache and hard reload (Ctrl+Shift+R)
- The code has been updated, this error should not appear with latest code

### Menu items not showing
- **Solution:** Run Step 1 again
- Check: `SELECT COUNT(*) FROM menu_items;`
- Should return > 0

### Rider still sees customer portal
- **Solution:** Check Step 3
- Verify email is exactly: `johndave0991@gmail.com` (case-sensitive in database)
- After updating role, have rider logout and login again

### RLS Policies Preventing Access
If you get permission denied errors:

```sql
-- Temporarily disable RLS for testing (NOT for production)
ALTER TABLE customer_reviews DISABLE ROW LEVEL SECURITY;
```

Then re-enable after testing:
```sql
ALTER TABLE customer_reviews ENABLE ROW LEVEL SECURITY;
```

## Summary Checklist

After completing all steps, you should have:

- [x] 283 menu items in database
- [x] customer_reviews table created
- [x] No loyalty_balance errors
- [x] Order Portal navigation working
- [x] Customer reviews page working (no 404)
- [x] Rider portal access (if account exists with correct role)
- [x] All loyalty balance displays showing ₱0.00 or calculated values

## Need Help?

If you encounter issues:

1. Check browser console for specific error messages
2. Check Supabase logs (Database → Logs)
3. Verify environment variables are set correctly
4. Check that all tables have proper RLS policies

## Production Deployment

After testing locally:

1. Ensure all database changes are applied to production Supabase instance
2. Deploy code changes to production (Vercel/your hosting)
3. Test again in production environment
4. Monitor for any errors in production logs

---

**Estimated Total Time:** 10-15 minutes

**Required Access:** Supabase SQL Editor, admin access to users table
