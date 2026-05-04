# Migration 082: Fix Loyalty Duplicate Key Error

## Problem
When cashiers complete orders in the Orders Queue, a 409 error occurs:
```
Failed to load resource: the server responded with a status of 409
duplicate key value violates unique constraint "unique_loyalty_per_order"
[OrdersQueue] Failed to complete pickup order: duplicate key value violates unique constraint "unique_loyalty_per_order"
```

This happens in two scenarios:
1. **Dine-in/Take-out orders**: When all items are marked as served, the order status changes to `order_delivered` and the database trigger tries to award loyalty points
2. **Pickup orders**: When the cashier clicks "Order Complete" button, the order status changes to `order_delivered` and the database trigger tries to award loyalty points

The error occurs because loyalty points were already awarded in a previous attempt (duplicate attempt).

## Root Cause
The unique constraint `unique_loyalty_per_order` exists to prevent duplicate loyalty awards, but the trigger function wasn't properly handling the conflict with `ON CONFLICT DO NOTHING`, or the constraint wasn't applied in production.

## Solution
Migration 082 ensures:
1. The UNIQUE constraint exists on `loyalty_transactions(order_id, transaction_type)`
2. The trigger function uses `ON CONFLICT DO NOTHING` to silently ignore duplicates
3. Frontend code gracefully handles any remaining edge case errors

## How to Apply

### Option 1: Via Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `082_fix_loyalty_duplicate_error.sql`
4. Click "Run"
5. Verify you see the success message: "Migration 082: Fix Loyalty Duplicate Error - COMPLETE"

### Option 2: Via Supabase CLI
```bash
# If using Supabase CLI
supabase db push

# Or apply specific migration
supabase migration up 082_fix_loyalty_duplicate_error
```

## Verification

After applying the migration, verify it worked:

```sql
-- 1. Check that the constraint exists
SELECT conname, contype 
FROM pg_constraint 
WHERE conname = 'unique_loyalty_per_order';

-- Expected: Should return one row with conname = 'unique_loyalty_per_order'

-- 2. Check that the trigger exists
SELECT tgname 
FROM pg_trigger 
WHERE tgname = 'trg_award_loyalty_points_on_order_completion';

-- Expected: Should return one row

-- 3. Check the trigger function has ON CONFLICT handling
SELECT prosrc 
FROM pg_proc 
WHERE proname = 'award_loyalty_points_on_order_completion';

-- Expected: Should contain "ON CONFLICT (order_id, transaction_type) DO NOTHING"
```

## Testing

After migration:
1. **Test Dine-in/Take-out orders:**
   - Go to Cashier Orders Queue
   - Mark items as served for a dine-in or take-out order
   - Mark the last item as served (which completes the order)
   - Verify no 409 error appears
   - Check that loyalty points are awarded once (not duplicated)

2. **Test Pickup orders:**
   - Go to Cashier Orders Queue  
   - Click "Ready for Pick-up" on a pickup order
   - Click "Order Complete" on the same order
   - Verify no 409 error appears
   - Check that loyalty points are awarded once (not duplicated)

3. **Verify in Customer Dashboard:**
   - Log in as the customer who placed the order
   - Check the loyalty points balance
   - Verify points were awarded only once per completed order

## Frontend Changes

The `pages/cashier/orders-queue.js` file now includes graceful error handling for the duplicate loyalty scenario in BOTH functions:

1. **`handleMarkItemServed` function**: Used when marking individual items as served in dine-in/take-out orders
   - If a duplicate loyalty error occurs, it logs a warning instead of showing an error to the user
   - The orders list is refreshed normally
   
2. **`handleCompletePickup` function**: Used when completing pickup orders
   - If a duplicate loyalty error occurs, it logs a warning instead of showing an error to the user
   - The orders list is refreshed normally
   - Shows success message to cashier

This provides defense-in-depth: even though the database should prevent the error with `ON CONFLICT DO NOTHING`, the frontend gracefully handles any edge cases.

## Related Migrations
- Migration 074: Initial loyalty conflict handling
- Migration 079: Ensure loyalty conflict handling
- Migration 081: Fix loyalty points calculation
- Migration 082: Comprehensive fix for 409 errors (this one)

## Rollback
If you need to rollback (not recommended):
```sql
-- This won't break anything, but may allow duplicate loyalty awards
DROP TRIGGER IF EXISTS trg_award_loyalty_points_on_order_completion ON orders;
DROP FUNCTION IF EXISTS award_loyalty_points_on_order_completion();
```

Note: Do not drop the unique constraint as it protects data integrity.
