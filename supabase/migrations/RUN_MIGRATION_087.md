# Migration 087: Verify and Reapply Customer Purchases Fix

## Problem

You're still getting this error when completing pickup orders:

```
[OrdersQueue] Failed to complete pickup order: ON CONFLICT DO UPDATE command cannot affect row a second time
```

Even though Migration 086 was created to fix this issue, it appears the fix may not have been properly applied to your live database.

## What This Does

This migration:
1. **Checks** if the `track_customer_item_purchases()` function has the GROUP BY fix
2. **Reapplies** the fix from Migration 086 to ensure it's correctly implemented
3. **Verifies** that the fix was successfully applied

## Root Cause (Recap)

When an order contains multiple quantities of the same item (e.g., "2x Coffee"), the database trigger tries to update the same row twice:

```sql
-- Without GROUP BY (causes error):
Coffee #1 → INSERT/UPDATE (customer_id, coffee-uuid) ✓
Coffee #2 → INSERT/UPDATE (customer_id, coffee-uuid) ✗ ERROR!

-- With GROUP BY (works correctly):
Coffee items aggregated → INSERT/UPDATE (customer_id, coffee-uuid, quantity=2) ✓
```

## How to Run

### Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to: **SQL Editor** (left sidebar)
3. Click **+ New query**
4. Copy the entire content of `supabase/migrations/087_verify_and_reapply_customer_purchases_fix.sql`
5. Paste into the SQL editor
6. Click **RUN** (or press Ctrl+Enter)
7. Check the **Results** tab for success messages

### Expected Output

You should see:

```
NOTICE: ================================================================
NOTICE: Checking track_customer_item_purchases function...
NOTICE: ================================================================
NOTICE: Function is missing GROUP BY aggregation!
WARNING: The fix from migration 086 needs to be applied.
NOTICE: ================================================================
NOTICE: Migration 087: Verify and Reapply Customer Purchases Fix
NOTICE: ================================================================
NOTICE: SUCCESS: Function now has GROUP BY aggregation
NOTICE: 
NOTICE: Changes applied:
NOTICE:   ✓ Added GROUP BY aggregation in track_customer_item_purchases()
NOTICE:   ✓ Prevents multiple upserts for same menu_item_id in one order
NOTICE:   ✓ Fixes: "ON CONFLICT DO UPDATE cannot affect row twice" error
NOTICE: 
NOTICE: Example: Order with 2x Coffee now processes as 1 aggregated row
NOTICE:   Before: Coffee item #1 → upsert, Coffee item #2 → ERROR!
NOTICE:   After:  Coffee items aggregated → single upsert (quantity=2)
NOTICE: ================================================================
```

## Verification After Running

Run this query to verify the fix is in place:

```sql
-- Check the current function definition
SELECT pg_get_functiondef('track_customer_item_purchases'::regproc);
```

You should see `GROUP BY (item->>'id')::UUID` in the function definition.

## Testing

1. Go to your customer app and create a pickup order
2. Add **2 or more of the same item** (e.g., 2x Coffee, 3x Burger)
3. Place the order
4. Go to **Cashier → Orders Queue**
5. Find the order and click **"Complete Pick-up"**
6. The order should complete successfully without any errors

**Before fix**: 500 error with "ON CONFLICT DO UPDATE command cannot affect row a second time"  
**After fix**: Order completes successfully ✓

## Why Rerun Migration 086?

Even though Migration 086 exists in the codebase, it may not have been executed on your live database. Common reasons:

- Migration was added after your database was deployed
- Migration failed silently during previous run
- Database was restored from an earlier backup
- Migration file was created but not executed via Supabase dashboard

This migration (087) ensures the fix is properly applied.

## Impact

- **Fixes**: Pickup order completion errors
- **Affects**: All order types (dine-in, take-out, pickup, delivery)
- **Safe**: No data loss, backward compatible
- **Required**: Must run this to fix the error

## Related Files

- `supabase/migrations/086_fix_customer_purchases_conflict.sql` - Original fix
- `supabase/migrations/078_track_customer_item_purchases.sql` - Original feature
- `pages/cashier/orders-queue.js` - Frontend code that triggers the error

## Need Help?

If you're still experiencing issues after running this migration:

1. Verify the migration ran successfully (check Results tab)
2. Check for any error messages in the Supabase logs
3. Ensure you're running the migration on the correct project/database
4. Try clearing your browser cache and reloading the page
