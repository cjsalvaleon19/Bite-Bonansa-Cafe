# Fix for Database Errors - Quick Start Guide

## Summary of Errors Fixed

This update fixes the following errors that appeared in the browser console:

1. ✅ **Orders query syntax error (400)** - Fixed incorrect Supabase query syntax
2. ✅ **Missing `loyalty_transactions` table (404)** - SQL migration script provided
3. ✅ **Missing `customer_item_purchases` table (404)** - SQL migration script provided  
4. ✅ **CSP violation for Google Maps API** - Content Security Policy updated
5. ✅ **Customer dashboard query errors** - Query syntax corrected

## What Changed

### Code Changes (Already Applied)

1. **pages/customer/dashboard.js** - Fixed orders query syntax on line 110
   - Changed from: `.not('status', 'in', '(order_delivered,cancelled)')`
   - Changed to: `.or('status.eq.order_in_queue,status.eq.order_in_process,status.eq.out_for_delivery')`

2. **next.config.js** - Updated Content Security Policy to allow Google Maps
   - Added `https://maps.googleapis.com` to `script-src`
   - Added Google Maps domains to `img-src` and `connect-src`

### Database Changes (Action Required)

You need to run the SQL migration script in your Supabase database.

## 🚀 How to Apply the Fix

### Step 1: Run the SQL Migration (5 minutes)

1. Open your **Supabase Dashboard**
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Open the file `SUPABASE_MIGRATION.sql` from this repository
5. Copy the entire contents
6. Paste into the Supabase SQL Editor
7. Click **Run** (or press Ctrl+Enter)

The script will create:
- `loyalty_transactions` table with RLS policies
- `customer_item_purchases` table with RLS policies  
- `customer_reviews` table with RLS policies
- Delivery fee calculation functions
- Automatic triggers for loyalty points and purchase tracking

**Note:** The script is safe to run multiple times (uses `IF NOT EXISTS` and `DROP POLICY IF EXISTS`)

### Step 2: Verify the Migration

After running the migration, verify everything was created:

```sql
-- Check if all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('loyalty_transactions', 'customer_item_purchases', 'customer_reviews')
ORDER BY table_name;
```

Expected result: Should return 3 rows (all three tables)

### Step 3: Test the Application

1. **Clear your browser cache** (Ctrl+Shift+R or Cmd+Shift+R)
2. **Login to the customer portal**
3. **Check the browser console** (F12) - you should see **no errors** about:
   - loyalty_transactions
   - customer_item_purchases
   - 400 errors on orders query
   - CSP violations for Google Maps

4. **Test these features:**
   - ✅ Customer Dashboard - Should load without errors
   - ✅ Order Portal - Menu should display
   - ✅ Order Tracking - Should work
   - ✅ Reviews Page - Should load
   - ✅ Checkout Page - Google Maps should load

## What Each Table Does

### loyalty_transactions
Tracks customer loyalty points:
- **earned** - Points earned from completed orders
- **spent** - Points redeemed during checkout
- **adjustment** - Manual adjustments by admin

### customer_item_purchases  
Tracks purchase history:
- Shows most purchased items on customer dashboard
- Automatically updated when orders are marked as delivered
- Used for personalized recommendations

### customer_reviews
Stores customer feedback:
- Star ratings (1-5)
- Review text and title
- Image uploads (requires storage bucket setup - see STORAGE_BUCKET_SETUP.md)
- Status workflow: pending → published → archived

## Delivery Fee Calculation

The migration also includes delivery fee calculation functions:

```sql
-- Calculate delivery fee from store to customer location
SELECT calculate_delivery_fee_from_store(
  6.2178483,  -- customer latitude
  124.8221226 -- customer longitude
);
```

**Pricing Structure:**
- Base fee: ₱30 (up to 1000m)
- Tiered additional fees from ₱5 to ₱68
- Maximum fee: ₱98 (capped at 10km)

See `DELIVERY_FEE_IMPLEMENTATION.md` for full pricing table.

## Troubleshooting

### Error: "table already exists"
This is normal if you ran the script before. The script uses `IF NOT EXISTS` so it's safe to run multiple times.

### Error: "relation does not exist" after migration
1. Verify the tables were created:
   ```sql
   \dt loyalty_transactions
   \dt customer_item_purchases
   \dt customer_reviews
   ```
2. Check RLS is enabled:
   ```sql
   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
   ```

### Still seeing 404 errors
1. Hard refresh your browser (Ctrl+Shift+F5)
2. Check Supabase connection URL is correct in `.env.local`
3. Verify you're connected to the correct Supabase project

### CSP errors for Google Maps
1. Deploy the code changes (they're already committed)
2. Restart your development server
3. Clear browser cache

## Storage Bucket Setup (Optional)

For customer review image uploads, you need to create a storage bucket:

1. Go to **Supabase Dashboard** > **Storage**
2. Click **New Bucket**
3. Name: `reviews`
4. Make it **public**
5. Set file size limit: 5MB

See `STORAGE_BUCKET_SETUP.md` for detailed instructions.

## Next Steps

After applying this fix:

1. ✅ All console errors should be resolved
2. ✅ Customer dashboard displays correctly
3. ✅ Loyalty points tracking is functional
4. ✅ Purchase history tracking is functional
5. ✅ Google Maps loads on checkout page
6. ✅ Reviews feature is ready to use

## Questions?

If you encounter any issues:

1. Check the browser console for specific error messages
2. Check Supabase logs: **Dashboard** > **Database** > **Logs**
3. Verify your `.env.local` has correct Supabase credentials
4. Ensure you're running the latest code from this branch

## Files Changed

- ✅ `pages/customer/dashboard.js` - Fixed orders query
- ✅ `next.config.js` - Updated CSP for Google Maps
- 🆕 `SUPABASE_MIGRATION.sql` - Complete database migration
- 🆕 `FIX_README.md` - This guide

---

**Estimated time to apply:** 5-10 minutes  
**Requires:** Supabase SQL Editor access
