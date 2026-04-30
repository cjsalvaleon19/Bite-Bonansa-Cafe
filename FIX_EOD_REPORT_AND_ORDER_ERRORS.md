# Fix for EOD Report, POS, and Orders Queue Errors

## Problem Summary

The application was experiencing several critical errors:

1. **EOD Report Failed to Fetch Orders**: `column order_items_1.variant_details does not exist`
2. **Duplicate Order Number Constraint**: `duplicate key value violates unique constraint "orders_order_number_key"`
3. **Orders Queue Failed to Mark Items as Served**: `function public.post_order_journal_entries(text, character varying, text) does not exist`
4. **Missing DOM Element**: `Could not find element with selector .header-and-quick-actions-mfe-Header--organisation-name-text`

## Root Causes

### 1. Missing variant_details Column
The `order_items` table was missing the `variant_details` column, which the EOD Report was trying to query. The application code (Customer Order Portal and Cashier POS) was already capturing variant information but wasn't storing it in the database because the column didn't exist.

### 2. Invalid UNIQUE Constraint on order_number
The `orders` table had a global UNIQUE constraint on the `order_number` column. However, order numbers are designed to reset daily (001, 002, 003...), so the same order number can appear on different days. The global constraint prevented this, causing duplicate key errors when a new day started.

### 3. Missing Database Function in Trigger
A trigger on the `order_items` table was referencing a function `post_order_journal_entries` that doesn't exist. When the Orders Queue tried to mark an item as served (updating `order_items.served = true`), the trigger would fire and fail because the function was missing.

### 4. Missing DOM Element (Frontend Issue)
This appears to be a frontend rendering issue unrelated to the database schema.

## Solutions Implemented

### Migration 045: Add variant_details Column
**File**: `supabase/migrations/045_add_variant_details_to_order_items.sql`

This migration:
- Adds `variant_details JSONB` column to the `order_items` table
- Creates a GIN index on `variant_details` for efficient JSONB queries
- Stores variant selections like `{"Size": "Large", "Temperature": "Iced"}`

**Code Changes**:
- Updated `app/customer/order/page.tsx` to save `variant_details` when placing orders
- Updated `pages/cashier/pos.js` to save `variant_details` when creating POS orders
- Both now store the variant selections as JSONB in the database

### Migration 046: Fix Duplicate Order Number Constraint
**File**: `supabase/migrations/046_fix_duplicate_order_number_constraint.sql`

This migration:
- Removes the global UNIQUE constraint on `order_number`
- Creates a composite unique index: `idx_orders_order_number_date_unique`
- Ensures order numbers are unique per day, allowing daily resets

The new constraint allows:
- Day 1: Orders 001, 002, 003...
- Day 2: Orders 001, 002, 003... (resets)
- Prevents: Two orders with number 001 on the same day

### Migration 047: Remove Orphaned Journal Triggers
**File**: `supabase/migrations/047_remove_orphaned_journal_triggers.sql`

This migration:
- Identifies and drops triggers on `order_items` that reference journal-related functions
- Drops the `post_order_journal_entries` function if it exists
- Cleans up orphaned triggers that cause errors when updating order items

**Why This is Needed**:
- A trigger was created in production that references a non-existent function
- The trigger fires when updating `order_items.served` status
- Without the function, the update fails with "function does not exist" error
- Removing the orphaned trigger allows updates to proceed normally

## How to Apply These Fixes

### 1. Run the Migrations in Supabase

Connect to your Supabase project and run these migrations in order:

```bash
# Migration 045: Add variant_details column
psql -h <your-supabase-host> -U postgres -d postgres -f supabase/migrations/045_add_variant_details_to_order_items.sql

# Migration 046: Fix duplicate order number constraint
psql -h <your-supabase-host> -U postgres -d postgres -f supabase/migrations/046_fix_duplicate_order_number_constraint.sql

# Migration 047: Remove orphaned triggers
psql -h <your-supabase-host> -U postgres -d postgres -f supabase/migrations/047_remove_orphaned_journal_triggers.sql
```

Or use the Supabase Dashboard:
1. Go to SQL Editor in your Supabase Dashboard
2. Copy and paste the contents of `045_add_variant_details_to_order_items.sql`
3. Click "Run"
4. Repeat for `046_fix_duplicate_order_number_constraint.sql`
5. Repeat for `047_remove_orphaned_journal_triggers.sql`

### 2. Deploy the Code Changes

The code changes are already included in this branch. When you deploy:

```bash
# Build and deploy
npm run build
# Deploy to your hosting platform (Vercel, etc.)
```

### 3. Verify the Fixes

After deploying:

1. **Test EOD Report**: 
   - Navigate to the EOD Report page (`/cashier/eod-report`)
   - Select today's date
   - Verify that orders are fetched without errors
   - Check that variant details are displayed for items with variants

2. **Test Order Placement**:
   - Place a new customer order with variant selections
   - Check in the database that `order_items.variant_details` contains the JSONB data
   - Place multiple orders to verify order numbers increment correctly (001, 002, 003...)

3. **Test Order Item Serving**:
   - Navigate to the Orders Queue page (`/cashier/orders-queue`)
   - Find an active order
   - Click "Mark as Served" on an item
   - Verify that the item is marked as served without errors

4. **Test Order Number Reset**:
   - Wait until the next day
   - Place a new order
   - Verify that the order number resets to 001 without duplicate key errors

## Database Schema Changes

### order_items Table (After Migration 045)
```sql
CREATE TABLE order_items (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id),
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  subtotal DECIMAL(10,2) NOT NULL,
  notes TEXT,
  served BOOLEAN DEFAULT false,
  variant_details JSONB,  -- ← NEW COLUMN
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### orders Table Constraints (After Migration 046)
```sql
-- REMOVED: Global unique constraint on order_number
-- ADDED: Composite unique index for order_number per date
-- Using ::date cast instead of DATE() function (IMMUTABLE requirement)
CREATE UNIQUE INDEX idx_orders_order_number_date_unique
ON orders (order_number, (created_at::date))
WHERE order_number IS NOT NULL;
```

### order_items Table Triggers (After Migration 047)
```sql
-- REMOVED: Any triggers referencing post_order_journal_entries
-- REMOVED: post_order_journal_entries function (if it existed)
-- KEPT: Valid triggers like trg_update_customer_item_purchases
```

## Expected Behavior After Fix

### EOD Report
- ✅ Successfully fetches orders with variant details
- ✅ Displays variant selections for each order item
- ✅ No "column does not exist" errors

### Order Placement
- ✅ Customer orders store variant selections in `order_items.variant_details`
- ✅ POS orders store variant selections in `order_items.variant_details`
- ✅ Variant details are preserved for reporting and display

### Orders Queue
- ✅ Successfully marks items as served
- ✅ No "function does not exist" errors
- ✅ Order completion tracking works correctly

### Order Numbers
- ✅ Order numbers increment daily: 001, 002, 003...
- ✅ Order numbers reset each day
- ✅ No duplicate key constraint errors
- ✅ Unique constraint still prevents duplicate order numbers on the same day

## Additional Notes

### Memory Fact to Store
Consider storing this fact for future reference:
- **Subject**: order_items schema
- **Fact**: order_items table has variant_details JSONB column to store variant selections (e.g., {"Size": "Large", "Temperature": "Iced"})
- **Citation**: supabase/migrations/045_add_variant_details_to_order_items.sql:10
- **Reason**: This is important for any code that inserts or queries order items to ensure variant information is properly saved and retrieved.

### Rollback Instructions

If you need to rollback these changes:

```sql
-- Rollback Migration 047
-- WARNING: This will recreate the error, not recommended
-- If you need to add journal functionality, implement it properly first

-- Rollback Migration 046
DROP INDEX IF EXISTS idx_orders_order_number_date_unique;
ALTER TABLE orders ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);

-- Rollback Migration 045
DROP INDEX IF EXISTS idx_order_items_variant_details;
ALTER TABLE order_items DROP COLUMN IF EXISTS variant_details;
```

## Summary

These migrations and code changes resolve the critical errors in the EOD Report, POS, and Orders Queue system by:
1. Adding the missing `variant_details` column to store variant information
2. Fixing the order number constraint to allow daily resets
3. Removing orphaned triggers that reference non-existent functions
4. Updating the application code to properly save variant details

After applying these fixes, the system should operate without the errors mentioned in the problem statement.
