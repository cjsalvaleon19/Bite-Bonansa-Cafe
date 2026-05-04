# Migration 084: Fix add_loyalty_points() Duplicate Key Error

## Problem
**ERROR:** `duplicate key value violates unique constraint "unique_loyalty_per_order"`

```
DETAIL: Key (order_id, transaction_type)=(590c5e08-983a-4417-9dd0-10e137fabc5c, earned) already exists.
CONTEXT: SQL statement in add_loyalty_points() function
```

The `add_loyalty_points()` function was missing the `ON CONFLICT DO NOTHING` clause that prevents duplicate loyalty transaction inserts.

## Root Cause
Two loyalty point systems were running:
1. **Old System:** `add_loyalty_points()` function with `trigger_add_loyalty_points` trigger (NO conflict handling)
2. **New System:** `award_loyalty_points_on_order_completion()` function (HAS conflict handling via migrations 079, 082)

Both were active, causing duplicate inserts and constraint violations.

## Solution
This migration:
1. **Drops** the old `trigger_add_loyalty_points` trigger to prevent conflicts
2. **Updates** `add_loyalty_points()` function to include `ON CONFLICT DO NOTHING`
3. **Ensures** `award_loyalty_points_on_order_completion()` remains the active loyalty trigger

## How to Run

### In Supabase Dashboard SQL Editor:
1. Go to SQL Editor
2. Copy the contents of `084_fix_add_loyalty_points_duplicate.sql`
3. Execute the migration
4. Verify output shows successful completion

### Expected Output:
```
NOTICE:  ================================================================
NOTICE:  Migration 084: Fix add_loyalty_points Duplicate - COMPLETE
NOTICE:  ================================================================
NOTICE:  Changes applied:
NOTICE:    ✓ Dropped trigger_add_loyalty_points trigger to avoid conflicts
NOTICE:    ✓ Updated add_loyalty_points() with ON CONFLICT DO NOTHING
NOTICE:    ✓ Prevents duplicate key errors in loyalty_transactions
NOTICE:    ✓ award_loyalty_points_on_order_completion() is the active trigger
NOTICE:  ================================================================
```

## Verification

After running the migration, verify:

1. **Check active triggers:**
```sql
SELECT tgname, tgrelid::regclass, tgfoid::regproc 
FROM pg_trigger 
WHERE tgname LIKE '%loyalty%' 
  AND tgrelid = 'orders'::regclass
  AND NOT tgisinternal;
```

Expected: Only `trg_award_loyalty_points_on_order_completion` should be active

2. **Test order completion:**
- Complete an order in the cashier queue
- Check for no duplicate key errors
- Verify loyalty points are awarded only once

## Related Migrations
- **079:** `ensure_loyalty_conflict_handling.sql` - Added ON CONFLICT to award_loyalty_points_on_order_completion
- **082:** `fix_loyalty_duplicate_error.sql` - Verified constraint and ON CONFLICT handling
- **084:** THIS MIGRATION - Fixed the old add_loyalty_points function

## Notes
- The `add_loyalty_points()` function is legacy code
- The active loyalty system uses `award_loyalty_points_on_order_completion()`
- This migration maintains backward compatibility while preventing errors
