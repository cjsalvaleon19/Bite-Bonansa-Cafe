# Fix: Server Response Errors - Database Schema Issues

## Problem Summary

The application was experiencing two critical database-related errors:

### Error 1: Customer Dashboard Purchase History
```
Failed to load resource: the server responded with a status of 400 ()
[CustomerDashboard] Error fetching purchase history: Could not find a relationship 
between 'customer_item_purchases' and 'menu_items' in the schema cache
```

**Location**: `pages/customer/dashboard.js:158-166`

**Root Cause**: The `customer_item_purchases` table did not exist in the database, but the customer dashboard was attempting to fetch purchase history data from it.

### Error 2: Orders Queue Pickup Order Completion
```
[OrdersQueue] Failed to complete pickup order: column "balance_after" does not exist
bffpcgsevigxpldidxgl.supabase.co/rest/v1/orders?id=eq.968a719c-a631-4836-83ba-563a54d65460:1  
Failed to load resource: the server responded with a status of 400 ()
```

**Location**: `pages/cashier/orders-queue.js:177-208`

**Root Cause**: The `loyalty_transactions` table was missing the `balance_after` column that the application expected.

### Error 3: Migration 042 Didn't Add balance_after
```
Error: Failed to run sql query: ERROR: 42703: column "balance_after" of relation "loyalty_transactions" does not exist
```

**Root Cause**: The `loyalty_transactions` table was created by an earlier schema file (`fix_orders_and_loyalty_schema.sql`) without the `balance_after` column. Migration 042 used `CREATE TABLE IF NOT EXISTS`, so it skipped creation when the table already existed, leaving the column missing.

## Solution

Created **TWO** migrations to handle both scenarios:
1. **Migration 042** - Creates missing tables (if they don't exist)
2. **Migration 043** - Adds missing columns to existing tables (using ALTER TABLE)

### Files Created

1. **`supabase/migrations/042_create_missing_loyalty_and_purchase_tables.sql`**
   - Complete migration SQL script
   - Creates 3 tables: `loyalty_transactions`, `customer_item_purchases`, `customer_reviews`
   - Sets up proper foreign key relationships
   - Configures Row Level Security (RLS) policies
   - Adds indexes for performance

2. **`supabase/migrations/043_add_balance_after_to_loyalty_transactions.sql`**
   - Adds missing `balance_after` column to existing `loyalty_transactions` table
   - Fixes column data types (INT → DECIMAL, TEXT → VARCHAR)
   - Ensures consistency with migration 042's schema
   - Adds `total_spent` column to `customer_item_purchases` if missing

3. **`supabase/migrations/RUN_MIGRATION_042.md`**
   - Detailed migration guide for 042
   - Step-by-step application instructions
   - Verification queries
   - Rollback procedures

4. **`supabase/migrations/RUN_MIGRATION_043.md`**
   - Detailed migration guide for 043
   - Explains why both migrations are needed
   - Verification steps
   - Rollback instructions

## What the Migration Does

### 1. Creates `loyalty_transactions` Table
```sql
CREATE TABLE loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  transaction_type VARCHAR(50) NOT NULL,  -- 'earned', 'spent', 'adjustment'
  amount DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,   -- ✅ This fixes Error 2
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Fixes**: The missing `balance_after` column that was causing pickup order completion to fail.

### 2. Creates `customer_item_purchases` Table
```sql
CREATE TABLE customer_item_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,  -- ✅ This fixes Error 1
  purchase_count INT NOT NULL DEFAULT 0,
  last_purchased_at TIMESTAMP DEFAULT NOW(),
  total_spent DECIMAL(10,2) DEFAULT 0,
  UNIQUE(customer_id, menu_item_id)
);
```

**Fixes**: The missing table and proper foreign key relationship to `menu_items` that was causing the schema cache error.

### 3. Creates `customer_reviews` Table
```sql
CREATE TABLE customer_reviews (
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
```

**Purpose**: Prepares the database for the customer reviews feature.

## How to Apply the Fix

### ⚠️ Important: Apply BOTH Migrations

Due to the way tables were created on production, you need to apply **BOTH** migrations:

1. **Migration 042** - Creates tables if they don't exist
2. **Migration 043** - Adds missing columns to tables that already exist

### Quick Steps (7 minutes)

1. Open your **Supabase Dashboard → SQL Editor**
2. **First**, copy and run `042_create_missing_loyalty_and_purchase_tables.sql`
3. **Then**, copy and run `043_add_balance_after_to_loyalty_transactions.sql`
4. Verify with the provided queries

See `APPLY_MIGRATION_042_NOW.md` for the fastest guide with both migrations.

### Verification

After running the migration, execute these queries to confirm:

```sql
-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('loyalty_transactions', 'customer_item_purchases', 'customer_reviews');
```

Expected: 3 rows

```sql
-- Verify balance_after column exists
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'loyalty_transactions' 
  AND column_name = 'balance_after';
```

Expected: 1 row

```sql
-- Verify foreign key to menu_items
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'customer_item_purchases' 
  AND constraint_type = 'FOREIGN KEY';
```

Expected: At least 2 foreign keys (one to `users`, one to `menu_items`)

## Testing After Migration

### Test 1: Customer Dashboard
1. Log in as a customer at `/customer/dashboard`
2. Dashboard should load without errors
3. Check browser console - no "Could not find a relationship" errors
4. The "Most Purchased Items" section displays properly (may be empty if no purchases yet)

### Test 2: Pickup Order Completion
1. Log in as a cashier at `/cashier/orders-queue`
2. Have a pickup order in "out_for_delivery" status (or create one)
3. Click "Order Complete" button
4. Order should complete successfully
5. No "column balance_after does not exist" error
6. Customer receives completion notification

## Impact

### Errors Fixed
- ✅ Customer Dashboard purchase history now loads without 400 errors
- ✅ Cashiers can complete pickup orders without database errors
- ✅ Schema cache properly recognizes relationships between tables

### Features Enabled
- 📊 Purchase history tracking for customers
- 💰 Loyalty points system (earning and redemption)
- ⭐ Customer reviews infrastructure (ready for future implementation)
- 📈 Personalized recommendations based on purchase patterns

## Technical Details

### Database Security (RLS)
All tables have Row Level Security enabled:
- **Customers** can only view their own data
- **Staff** (admin/cashier) can view and manage all data
- **System** operations are allowed for automated processes

### Performance Optimizations
Indexes created for:
- `loyalty_transactions(customer_id, created_at DESC)` - Fast transaction history lookup
- `customer_item_purchases(customer_id, purchase_count DESC)` - Quick most-purchased queries
- `customer_item_purchases(menu_item_id)` - Efficient item-based queries
- `customer_reviews(customer_id)` - Customer review lookups
- `customer_reviews(status)` - Published review filtering

### Data Integrity
- Foreign keys ensure referential integrity
- Unique constraints prevent duplicate records
- Check constraints validate data (e.g., star_rating between 1-5)
- Cascade deletes maintain consistency

## Related Code

### Frontend Components Using These Tables

**Customer Dashboard** (`pages/customer/dashboard.js`):
- Lines 156-176: Fetches `customer_item_purchases` with menu items
- Lines 125-138: Calculates loyalty balance from `loyalty_transactions`
- Lines 141-154: Fetches total earnings from `loyalty_transactions`

**Orders Queue** (`pages/cashier/orders-queue.js`):
- Lines 177-208: `handleCompletePickup` function (needs `loyalty_transactions` table)
- Updates order status and potentially records loyalty points

## Migration Safety

This migration is:
- ✅ **Idempotent** - Safe to run multiple times (uses `IF NOT EXISTS`)
- ✅ **Non-destructive** - Only creates, never drops or modifies existing data
- ✅ **Backwards compatible** - Existing features continue to work
- ✅ **Reversible** - Rollback script provided in RUN_MIGRATION_042.md

## Next Steps

1. **Apply both migrations** to your production database (042 then 043)
2. **Test** both affected features (customer dashboard and pickup orders)
3. **Monitor** for any additional errors in the browser console or server logs
4. **Consider implementing** the loyalty points earning logic (currently infrastructure-only)
5. **Plan** the customer reviews feature implementation (tables are ready)

## Why Two Migrations?

**Background**: The `loyalty_transactions` table may have been created manually or by an earlier schema script (`fix_orders_and_loyalty_schema.sql`) that didn't include the `balance_after` column.

**Migration 042** uses `CREATE TABLE IF NOT EXISTS`, which means:
- ✅ If table doesn't exist → Creates it with all columns including `balance_after`
- ❌ If table already exists → Skips creation, leaving missing columns

**Migration 043** uses `ALTER TABLE ADD COLUMN IF NOT EXISTS`, which means:
- ✅ Always adds missing columns to existing tables
- ✅ Safe to run even if column already exists
- ✅ Fixes data types to match the proper schema

**Both migrations together** handle all scenarios:
- Fresh database → 042 creates tables, 043 does nothing
- Existing incomplete tables → 042 skips, 043 adds missing columns
- Already fixed → Both skip, no changes made

## Support

If issues persist after migration:
1. Check Supabase logs for detailed error messages
2. Verify RLS policies are active
3. Ensure authenticated users have proper roles
4. Check that `users` and `menu_items` tables exist and are accessible

---

**Migration Files**: 
- `supabase/migrations/042_create_missing_loyalty_and_purchase_tables.sql`  
- `supabase/migrations/043_add_balance_after_to_loyalty_transactions.sql`

**Guides**: 
- `supabase/migrations/RUN_MIGRATION_042.md`
- `supabase/migrations/RUN_MIGRATION_043.md`
- `APPLY_MIGRATION_042_NOW.md` (Quick Start - includes both)

**Date**: April 29, 2026
