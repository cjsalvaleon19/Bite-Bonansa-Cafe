# Quick Start: Fix Order Items Table

## Problem
Application errors when placing orders:
- ❌ 404 error on `/rest/v1/order_items`
- ❌ `operator does not exist: text = uuid` error
- ❌ Orders failing to complete

## Root Cause
The `order_items` table does not exist in the database.

## Solution
Run the migration SQL file to create the missing table.

## Steps to Apply Fix

### Step 1: Open Supabase Dashboard
1. Go to your Supabase project
2. Navigate to **SQL Editor**

### Step 2: Run Migration
1. Click **New Query**
2. Copy the entire contents of `create_order_items_table.sql`
3. Paste into the SQL Editor
4. Click **Run**

### Step 3: Verify Success
You should see output like:
```
NOTICE: ════════════════════════════════════════════════════════════
NOTICE: VERIFICATION: orders.id data type is: uuid
NOTICE: ════════════════════════════════════════════════════════════
NOTICE: SUCCESS: orders.id is UUID - proceeding with UUID-compatible order_items
...
NOTICE: ✓ SUCCESS: order_items table created successfully!
```

### Step 4: Test Order Placement
1. Go to the customer order page in your app
2. Add items to cart
3. Fill in delivery details
4. Place an order
5. ✅ Order should complete successfully without errors

## What Gets Created

- ✅ `order_items` table with UUID compatibility
- ✅ 3 performance indexes
- ✅ 4 RLS policies for security
- ✅ Trigger for customer purchase tracking
- ✅ Foreign keys to `orders` and `menu_items`

## Expected Results

**Before Fix:**
```
❌ Failed to load resource: 404
❌ Failed to place order: operator does not exist: text = uuid
```

**After Fix:**
```
✅ Order placed successfully!
✅ Order items saved to database
✅ Customer purchase tracking updated
```

## Alternative: Using Supabase CLI

If you prefer using the CLI:

```bash
# Copy to migrations folder
cp create_order_items_table.sql supabase/migrations/017_Create_Order_Items_Table.sql

# Apply migration
npx supabase db push
```

## Troubleshooting

### Migration fails with "table already exists"
- This is safe to ignore if you've run it before
- The migration uses `CREATE TABLE IF NOT EXISTS`

### Still getting 404 errors
- Wait 30 seconds for Supabase to detect schema changes
- Try refreshing your browser
- Check Supabase Dashboard → Database → Tables to confirm `order_items` exists

### Type mismatch errors persist
- Verify `orders.id` is UUID type by running:
  ```sql
  SELECT data_type FROM information_schema.columns 
  WHERE table_name = 'orders' AND column_name = 'id';
  ```
- Should return: `uuid`

## Important Notes

⚠️ **DO NOT run the proposed "Code 4"** that changes `orders.id` to TEXT  
⚠️ This fix keeps `orders.id` as UUID (correct approach)  
⚠️ The header selector error is unrelated and needs separate investigation

## Questions?

See full documentation in `ORDER_ITEMS_TABLE_FIX.md`
