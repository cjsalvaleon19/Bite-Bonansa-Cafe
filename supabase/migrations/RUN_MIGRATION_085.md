# Migration 085: Remove Duplicate Loyalty Trigger

## Problem
**Multiple loyalty triggers causing duplicate key errors**

Query results show TWO active triggers on the `orders` table:
```sql
SELECT tgname, tgrelid::regclass, tgfoid::regproc
FROM pg_trigger
WHERE tgname LIKE '%loyalty%'
  AND tgrelid = 'orders'::regclass
  AND NOT tgisinternal;
```

Results:
| tgname | tgrelid | tgfoid |
|--------|---------|--------|
| `trg_award_loyalty_points` | orders | `award_loyalty_points` |
| `trg_award_loyalty_points_on_order_completion` | orders | `award_loyalty_points_on_order_completion` |

## Root Cause
Two separate loyalty award triggers exist and both fire on order updates:

1. **Old Trigger:** `trg_award_loyalty_points`
   - Created in `fix_orders_and_loyalty_schema.sql`
   - Calls `award_loyalty_points()` function
   - **NO ON CONFLICT handling** ❌
   - Can cause duplicate key violations

2. **New Trigger:** `trg_award_loyalty_points_on_order_completion`
   - Created in migrations 079, 082
   - Calls `award_loyalty_points_on_order_completion()` function
   - **HAS ON CONFLICT handling** ✅
   - Safe from duplicates

When both triggers fire, they both try to insert loyalty transactions, causing the duplicate key error.

## Solution
This migration:
1. **Drops** the old `trg_award_loyalty_points` trigger
2. **Drops** the old `award_loyalty_points()` function
3. **Keeps** `trg_award_loyalty_points_on_order_completion` (the correct one)

## How to Run

### In Supabase Dashboard SQL Editor:
1. Go to SQL Editor
2. Copy the contents of `085_remove_duplicate_loyalty_trigger.sql`
3. Execute the migration
4. Verify output shows successful completion

### Expected Output:
```
NOTICE:  ================================================================
NOTICE:  Migration 085: Remove Duplicate Loyalty Trigger - COMPLETE
NOTICE:  ================================================================
NOTICE:  Changes applied:
NOTICE:    ✓ Dropped trg_award_loyalty_points trigger
NOTICE:    ✓ Dropped award_loyalty_points() function
NOTICE:    ✓ Only trg_award_loyalty_points_on_order_completion remains
NOTICE:    ✓ Prevents duplicate loyalty transaction errors
NOTICE:  
NOTICE:  Active trigger: trg_award_loyalty_points_on_order_completion
NOTICE:  Active function: award_loyalty_points_on_order_completion()
NOTICE:    - Has ON CONFLICT (order_id, transaction_type) DO NOTHING
NOTICE:    - Safe from duplicate key violations
NOTICE:  ================================================================
```

## Verification

After running the migration, verify only one trigger exists:

```sql
SELECT tgname, tgrelid::regclass, tgfoid::regproc
FROM pg_trigger
WHERE tgname LIKE '%loyalty%'
  AND tgrelid = 'orders'::regclass
  AND NOT tgisinternal;
```

**Expected result:** Only ONE row:
| tgname | tgrelid | tgfoid |
|--------|---------|--------|
| `trg_award_loyalty_points_on_order_completion` | orders | `award_loyalty_points_on_order_completion` |

## Test the Fix
1. Complete an order in the cashier queue
2. Verify no duplicate key errors occur
3. Verify loyalty points are awarded only once
4. Check `loyalty_transactions` table for single entry per order

## Related Migrations
- **073-082:** Created `trg_award_loyalty_points_on_order_completion` with ON CONFLICT
- **084:** Fixed `add_loyalty_points()` function (different from these triggers)
- **085:** THIS MIGRATION - Removes duplicate trigger

## Notes
- The old `award_loyalty_points()` function is completely removed
- Only `award_loyalty_points_on_order_completion()` should handle loyalty awards
- This completes the cleanup of all duplicate loyalty triggers
