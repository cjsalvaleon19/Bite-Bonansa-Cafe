# Fix: Schema Cache Error & Loyalty Transactions

## Problem Summary

You're experiencing two related issues:

1. **Schema Cache Error**: `"Could not find the 'delivery_address' column of 'orders' in the schema cache"`
2. **Foreign Key Type Mismatch**: `foreign key constraint "loyalty_transactions_order_id_fkey" cannot be implemented - Key columns "order_id" and "id" are of incompatible types: uuid and text`

## Root Causes

### Issue 1: Schema Cache Out of Sync
When you run SQL directly in Supabase SQL Editor, the changes are applied to the database immediately, but **Supabase's REST API schema cache is not automatically updated**. This means:
- The database has the columns ✅
- But the REST API doesn't know about them ❌
- Your application gets a 400 error when trying to use these columns

### Issue 2: Data Type Mismatch
The `orders.id` column in your actual database is type `TEXT`, but the schema files show it should be `UUID`. This creates a foreign key constraint violation when trying to reference it from `loyalty_transactions.order_id`.

## Solution

### Step 1: Run the Fixed Migration

The file `fix_orders_and_loyalty_schema.sql` contains a comprehensive migration that:

1. ✅ Ensures ALL required columns exist in the `orders` table
2. ✅ Detects the actual data type of `orders.id` (TEXT or UUID)
3. ✅ Creates `loyalty_transactions` with matching foreign key type
4. ✅ Creates `customer_item_purchases` table
5. ✅ Sets up proper RLS policies
6. ✅ Creates automatic triggers for loyalty points and purchase tracking

**To apply:**

1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Copy the contents of `fix_orders_and_loyalty_schema.sql`
4. Paste into a new query
5. Click **Run**

You should see messages in the output indicating:
- What data type was detected for `orders.id`
- Which version of `loyalty_transactions` was created
- Success messages for each step

### Step 2: **CRITICAL** - Reload Schema Cache

After running the SQL, you **MUST** reload the Supabase schema cache. Choose one method:

#### Method A: Supabase Dashboard (Recommended)

1. Go to **Project Settings** (gear icon in sidebar)
2. Click on **API** section
3. Scroll down to **"Schema Cache"** section
4. Click the **"Reload schema"** button
5. Wait for confirmation (usually takes a few seconds)

#### Method B: Supabase CLI

```bash
npx supabase db reset --linked
```

⚠️ **Warning**: This will reset your entire local database if you're using local development.

#### Method C: API Call

```bash
curl -X POST 'https://[YOUR-PROJECT-REF].supabase.co/rest/v1/rpc/reload_schema' \
  -H "apikey: [YOUR-ANON-KEY]" \
  -H "Authorization: Bearer [YOUR-ANON-KEY]"
```

### Step 3: Verify the Fix

After reloading the schema cache:

1. **Test in Supabase Dashboard:**
   - Go to **Table Editor**
   - Click on `orders` table
   - Verify you can see all these columns:
     - `delivery_address`
     - `order_mode`
     - `contact_number`
     - `delivery_latitude`
     - `delivery_longitude`
     - `delivery_fee`
   
2. **Test in API Docs:**
   - Go to **API Docs**
   - Look at the `orders` table schema
   - All columns should be listed

3. **Test your application:**
   - Try placing an order from the checkout page
   - It should now work without the 400 error

## What This Migration Does

### Orders Table Updates
Ensures these columns exist (adds only if missing):

**Delivery Information:**
- `delivery_address` (TEXT)
- `delivery_latitude` (DECIMAL)
- `delivery_longitude` (DECIMAL)
- `delivery_fee` (DECIMAL)
- `delivery_fee_pending` (BOOLEAN)

**Order Information:**
- `order_mode` (VARCHAR) - 'delivery', 'dine-in', 'take-out', etc.
- `contact_number` (VARCHAR)
- `order_number` (VARCHAR) - Unique order tracking number
- `customer_name` (VARCHAR)

**Pricing:**
- `subtotal` (DECIMAL)
- `vat_amount` (DECIMAL)
- `total_amount` (DECIMAL)

**Payment:**
- `payment_method` (VARCHAR)
- `gcash_reference` (VARCHAR)
- `points_used` (DECIMAL)
- `cash_amount` (DECIMAL)
- `gcash_amount` (DECIMAL)

**Other:**
- `special_request` (TEXT)
- `earnings_percentage` (DECIMAL)
- `earnings_amount` (DECIMAL)
- `accepted_at` (TIMESTAMP)
- `out_for_delivery_at` (TIMESTAMP)
- `delivered_at` (TIMESTAMP)
- `rider_id` (UUID)

### Loyalty Transactions Table
Creates with **automatic type detection** for `order_id`:
- Detects if `orders.id` is UUID or TEXT
- Creates `order_id` column with matching type
- Sets up proper foreign key constraint
- Includes RLS policies for security

### Customer Item Purchases Table
Tracks which items customers buy most:
- Links customers to menu items
- Counts purchases
- Tracks last purchase date
- Used for "most purchased" features

### Automatic Triggers

**Loyalty Points Trigger:**
- Automatically awards points when orders are placed
- 0.2% points for orders ≤ ₱500
- 0.35% points for orders > ₱500
- Only awards to logged-in customers

**Purchase History Trigger:**
- Automatically tracks item purchases
- Updates purchase counts
- Maintains "most purchased items" data

## Troubleshooting

### Still Getting Schema Cache Error?

1. **Clear browser cache** - Sometimes the error is cached in browser
2. **Wait 5 minutes** - Schema cache can take time to propagate
3. **Try reloading schema again** - Sometimes it needs to be done twice
4. **Restart your Next.js dev server** - `npm run dev` or `yarn dev`

### Foreign Key Error Still Happening?

The migration script automatically detects the type. If you still get errors:

1. Check the migration output for the NOTICE messages
2. Verify which type was detected
3. Manually verify in Supabase:
   ```sql
   SELECT data_type 
   FROM information_schema.columns 
   WHERE table_name = 'orders' 
     AND column_name = 'id';
   ```

### Orders Table Doesn't Have Some Columns?

The migration uses `ADD COLUMN IF NOT EXISTS`, so it's safe to run multiple times. If columns still don't appear:

1. Check for errors in the SQL output
2. Make sure you have proper permissions
3. Try running individual ALTER TABLE statements manually

## Prevention for Future

To avoid schema cache issues in the future:

1. **Always reload schema cache** after running SQL migrations
2. **Use Supabase migrations folder** for version-controlled schema changes
3. **Test in Supabase Dashboard's Table Editor** before testing in your app
4. **Check API Docs** to verify columns are visible to the REST API

## Files in This Fix

- `fix_orders_and_loyalty_schema.sql` - The complete migration script
- `FIX_SCHEMA_CACHE_ERROR.md` - This guide

## Need Help?

If issues persist:
1. Check Supabase logs in Dashboard → Logs
2. Check browser console for detailed error messages
3. Verify your Supabase project is not on a paused plan
4. Check that RLS policies aren't blocking access
