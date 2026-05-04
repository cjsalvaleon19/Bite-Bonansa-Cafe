# URGENT: Fix 409 Loyalty Duplicate Key Errors

## Problem
The Orders Queue is showing 409 errors when completing orders:
```
Failed to load resource: the server responded with a status of 409
duplicate key value violates unique constraint "unique_loyalty_per_order"
```

## Root Cause
The database migration to prevent duplicate loyalty awards hasn't been applied to your production Supabase database yet.

## Immediate Fix Required

### Step 1: Apply Migration via Supabase Dashboard

1. Log into your Supabase project dashboard at https://supabase.com
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New query**
4. Copy and paste the ENTIRE contents of this file: `supabase/migrations/082_fix_loyalty_duplicate_error.sql`
5. Click **RUN** (or press Cmd/Ctrl + Enter)
6. Wait for the success message: "Migration 082: Fix Loyalty Duplicate Error - COMPLETE"

### Step 2: Verify the Fix

After running the migration, verify it worked:

```sql
-- Run this query in Supabase SQL Editor to verify

-- 1. Check that the constraint exists
SELECT conname, contype 
FROM pg_constraint 
WHERE conname = 'unique_loyalty_per_order';
-- Expected: Should return 1 row

-- 2. Check that the trigger exists  
SELECT tgname 
FROM pg_trigger 
WHERE tgname = 'trg_award_loyalty_points_on_order_completion';
-- Expected: Should return 1 row

-- 3. Verify ON CONFLICT handling in trigger function
SELECT prosrc 
FROM pg_proc 
WHERE proname = 'award_loyalty_points_on_order_completion';
-- Expected: Should contain "ON CONFLICT (order_id, transaction_type) DO NOTHING"
```

### Step 3: Test the Fix

1. Go to Cashier Orders Queue page
2. Complete a pickup order OR mark all items as served for a dine-in/take-out order
3. Verify NO 409 errors appear in browser console (F12 > Console tab)
4. Verify the order completes successfully
5. Check customer's loyalty points balance to confirm points were awarded once

## What This Migration Does

1. **Adds UNIQUE constraint** on `loyalty_transactions(order_id, transaction_type)` to prevent duplicate loyalty awards at database level
2. **Updates trigger function** to use `ON CONFLICT DO NOTHING` - if loyalty was already awarded, it silently ignores the duplicate attempt
3. **Prevents 409 errors** by handling conflicts gracefully in the database instead of throwing errors

## Frontend Already Has Error Handling

The frontend code in `pages/cashier/orders-queue.js` already has defensive error handling:
- If a 409 error somehow still occurs, it logs a warning instead of showing an error
- The operation continues normally
- The orders list refreshes

This provides defense-in-depth, but the database migration is the proper fix.

## Technical Details

The issue occurs because:
1. When an order is completed (status changes to `order_delivered`), a database trigger fires
2. The trigger awards loyalty points by inserting into `loyalty_transactions` table
3. If the order is updated multiple times rapidly, or if there's a race condition, the trigger can fire multiple times
4. Without `ON CONFLICT DO NOTHING`, this causes a unique constraint violation (409 error)

The migration fixes this by making duplicate inserts silently ignored instead of throwing errors.

## Questions?

If you encounter any issues applying this migration:
1. Check the Supabase SQL Editor for error messages
2. Ensure you're running it on the correct database (production/staging)
3. Verify you have admin access to run migrations
4. Contact Supabase support if the issue persists

## DO NOT DELAY

This affects all order completions in the Orders Queue. Apply this migration immediately to prevent customer-facing errors.
