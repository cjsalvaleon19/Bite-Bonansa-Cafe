# Order Items Table Fix - UUID Compatible Solution

## Problem Summary

The application was experiencing multiple errors when placing orders:

1. **404 Error**: `Failed to load resource: the server responded with a status of 404`
   - Path: `/rest/v1/order_items?columns=...`
   - **Root Cause**: The `order_items` table did not exist in the database

2. **Type Mismatch Error**: `operator does not exist: text = uuid`
   - **Root Cause**: Attempted to compare TEXT with UUID types

3. **Frontend Error**: `Could not find element with selector .header-and-quick-actions-mfe-Header--organisation-name-text`
   - **Root Cause**: Unrelated frontend component issue (not database)

## Why the Originally Proposed Solution Was Wrong

The original proposal suggested:

```sql
-- ❌ WRONG: Create order_items with TEXT order_id
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL,  -- ❌ TEXT instead of UUID
  ...
);

-- ❌ WRONG: Change orders.id from UUID to TEXT
ALTER TABLE orders ALTER COLUMN id TYPE TEXT USING id::TEXT;
```

### Problems with This Approach:

1. **Breaking Change**: Changing `orders.id` from UUID to TEXT would:
   - Break existing foreign key relationships (e.g., `loyalty_transactions.order_id`)
   - Corrupt existing order data
   - Break RLS policies that reference `orders.id`
   - Fail application code that expects UUID type

2. **Wrong Diagnosis**: The error wasn't caused by type mismatch between tables, but by the **absence** of the `order_items` table entirely

3. **Unnecessary Complexity**: Converting a working UUID column to TEXT adds complexity without solving the real problem

## The Correct Solution

### Root Cause Analysis

The actual problem was simple:
- Application code at `app/customer/order/page.tsx:350` tries to insert into `order_items` table
- The `order_items` table **never existed** in the database
- Supabase returned 404 because the table wasn't found

### Implementation

Create `order_items` table with **UUID** `order_id` to match the existing `orders.id` type:

```sql
CREATE TABLE IF NOT EXISTS public.order_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id  UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  price         DECIMAL(10,2) NOT NULL,
  quantity      INT NOT NULL DEFAULT 1,
  subtotal      DECIMAL(10,2) NOT NULL,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### Key Design Decisions

1. **order_id is UUID**: Matches `orders.id` type exactly
   - No type conversion needed
   - No breaking changes
   - Compatible with existing foreign keys

2. **Proper Foreign Keys**:
   - `order_id` → `orders(id)` with `ON DELETE CASCADE`
   - `menu_item_id` → `menu_items(id)` with `ON DELETE SET NULL`

3. **Row Level Security (RLS)**:
   - Customers can view items for their own orders
   - Staff (admin, cashier, rider) can view all items
   - Permissive INSERT policy for order placement
   - UPDATE/DELETE restricted to staff only

4. **Performance Indexes**:
   - `idx_order_items_order_id` - Fast lookup by order
   - `idx_order_items_menu_item_id` - Fast lookup by menu item
   - `idx_order_items_created_at` - Time-based queries

5. **Trigger Integration**:
   - Re-creates the `trg_update_customer_item_purchases` trigger
   - This trigger was defined in `fix_orders_and_loyalty_schema.sql` but couldn't be created because the table didn't exist

## How to Apply This Fix

### Option 1: Run the SQL Migration (Recommended)

```bash
# In Supabase SQL Editor, run:
cat create_order_items_table.sql
```

Or upload and execute `create_order_items_table.sql` in the Supabase Dashboard.

### Option 2: Add to Migration History

```bash
# Copy to migrations directory with next sequence number
cp create_order_items_table.sql supabase/migrations/017_Create_Order_Items_Table.sql
```

## Verification Steps

After running the migration:

1. **Check Table Creation**:
   ```sql
   SELECT * FROM information_schema.tables 
   WHERE table_schema = 'public' AND table_name = 'order_items';
   ```

2. **Verify Indexes**:
   ```sql
   SELECT * FROM pg_indexes 
   WHERE tablename = 'order_items' AND schemaname = 'public';
   ```

3. **Check RLS Policies**:
   ```sql
   SELECT * FROM pg_policies 
   WHERE tablename = 'order_items' AND schemaname = 'public';
   ```

4. **Test Order Placement**:
   - Go to the customer order page
   - Add items to cart
   - Place an order
   - Verify no errors in console
   - Check that order items are inserted correctly

## Expected Results

After applying this fix:

✅ **order_items table exists** - No more 404 errors  
✅ **UUID compatibility** - No type mismatch errors  
✅ **Order placement works** - Items are stored in `order_items` table  
✅ **RLS policies active** - Proper access control  
✅ **Triggers functional** - Customer purchase tracking works  
✅ **No breaking changes** - `orders.id` remains UUID  

## What This Fix Does NOT Address

The frontend error about `.header-and-quick-actions-mfe-Header--organisation-name-text` is **unrelated** to the database schema. This appears to be a frontend component issue that should be investigated separately.

## Files Modified

- ✅ `create_order_items_table.sql` - New migration file (this fix)
- ✅ `ORDER_ITEMS_TABLE_FIX.md` - This documentation

## Files NOT Modified (By Design)

- ❌ `orders` table - No changes needed, remains UUID
- ❌ `loyalty_transactions` table - No changes needed
- ❌ `app/customer/order/page.tsx` - Already compatible with UUID

## Summary

This fix creates the missing `order_items` table with proper UUID compatibility, maintaining consistency with the existing database schema. It avoids the dangerous approach of converting `orders.id` to TEXT, which would have caused cascading failures across the application.

The solution is:
- **Minimal** - Only adds what's missing
- **Safe** - No breaking changes to existing tables
- **Compatible** - Works with existing code and data
- **Complete** - Includes RLS, indexes, and triggers
