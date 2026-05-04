# Fix for ON CONFLICT DO UPDATE Error in Orders Queue

## Error Message

```
[OrdersQueue] Failed to complete pickup order: ON CONFLICT DO UPDATE command cannot affect row a second time
```

## Problem Summary

When completing pickup orders (or any order type) that contain **multiple quantities of the same menu item**, the system throws a 500 error. This happens because the `track_customer_item_purchases()` database trigger attempts to update the same database row multiple times within a single transaction.

### Example Scenario

**Order:** 2x Coffee  
**What happens in database:**
1. Process Coffee #1 → Try to INSERT/UPDATE row for (customer_id, coffee_menu_id) ✓
2. Process Coffee #2 → Try to INSERT/UPDATE row for (customer_id, coffee_menu_id) ✗ **ERROR!**

PostgreSQL doesn't allow the same row to be affected multiple times by `ON CONFLICT DO UPDATE` in one transaction.

## Root Cause

The `track_customer_item_purchases()` function (created in Migration 078) loops through order items without aggregating them first. When the same item appears multiple times, it tries to upsert the same row repeatedly.

### Original Code (Migration 078 - Broken)

```sql
-- Loops through each item individually
FOR v_order_item IN 
  SELECT 
    (item->>'id')::UUID as menu_item_id,
    (item->>'quantity')::INT as quantity
  FROM jsonb_array_elements(NEW.items) AS item
  -- NO GROUP BY = processes duplicates separately
LOOP
  INSERT INTO customer_item_purchases ...
  ON CONFLICT DO UPDATE ...  -- Fails on second identical item!
END LOOP;
```

## Solution

**Migration 086** was created to fix this by adding `GROUP BY` to aggregate items before upserting.

### Fixed Code (Migration 086)

```sql
-- Aggregates items by menu_item_id FIRST
FOR v_aggregated_item IN 
  SELECT 
    (item->>'id')::UUID as menu_item_id,
    SUM((item->>'quantity')::INT) as total_quantity,
    SUM((item->>'price')::DECIMAL) as total_price
  FROM jsonb_array_elements(NEW.items) AS item
  GROUP BY (item->>'id')::UUID  -- ✓ Aggregates duplicates
LOOP
  INSERT INTO customer_item_purchases ...
  ON CONFLICT DO UPDATE ...  -- Works! Only one row per item
END LOOP;
```

### Before vs After

| Before (Broken) | After (Fixed) |
|----------------|---------------|
| Coffee #1 → upsert row | Coffee items (qty=2) → upsert row once |
| Coffee #2 → **ERROR!** | ✓ Success |

## Why You're Still Seeing the Error

Even though Migration 086 exists in the codebase, it may not have been applied to your **live database**. Migrations must be manually executed via Supabase dashboard.

## How to Fix (Action Required)

### Step 1: Run Migration 087

I've created **Migration 087** which:
1. Checks if the fix is already applied
2. Reapplies the fix from Migration 086 if needed
3. Verifies the fix was successful

**Run this now:**

1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Open the file: `supabase/migrations/087_verify_and_reapply_customer_purchases_fix.sql`
4. Copy the entire SQL content
5. Paste into Supabase SQL Editor
6. Click **RUN**

### Step 2: Verify Success

After running Migration 087, you should see output like:

```
NOTICE: SUCCESS: Function now has GROUP BY aggregation
NOTICE:   ✓ Added GROUP BY aggregation in track_customer_item_purchases()
NOTICE:   ✓ Fixes: "ON CONFLICT DO UPDATE cannot affect row twice" error
```

### Step 3: Test

1. Create a pickup order with **2 of the same item**
2. Go to Cashier → Orders Queue
3. Click "Complete Pick-up"
4. Should work without errors ✓

## Files Changed

- ✅ **NEW:** `supabase/migrations/087_verify_and_reapply_customer_purchases_fix.sql`
- ✅ **NEW:** `supabase/migrations/RUN_MIGRATION_087.md` (detailed instructions)
- 📖 **Reference:** `supabase/migrations/086_fix_customer_purchases_conflict.sql` (original fix)
- 📖 **Reference:** `supabase/migrations/RUN_MIGRATION_086.md` (original docs)

## Prevention

To prevent this issue in the future:

1. **Always test with duplicate items** when modifying order processing logic
2. **Run all migrations** in sequence on live database after deploying code
3. **Use GROUP BY** when aggregating data before ON CONFLICT operations
4. **Monitor Supabase logs** for database errors

## Related Issues

This is the same class of error that was fixed for loyalty transactions in:
- Migration 074: Fixed loyalty points ON CONFLICT error
- Migration 082: Added unique constraint for loyalty transactions
- Migration 084: Added ON CONFLICT handling to add_loyalty_points()

The pattern: **aggregate before upsert** when dealing with potentially duplicate rows.

## Technical Details

### Database: PostgreSQL Constraint

PostgreSQL error code: `21000` (cardinality violation)

> ON CONFLICT DO UPDATE command cannot affect row a second time

This error occurs when a single SQL statement with `ON CONFLICT DO UPDATE` tries to modify the same row multiple times. The fix is to aggregate/deduplicate data **before** the INSERT...ON CONFLICT statement.

### Affected Tables

- `customer_item_purchases` - tracks which items customers buy frequently
- Columns: `(customer_id, menu_item_id)` - unique constraint

### Trigger Flow

```
Order Status Changes
     ↓
trg_track_customer_purchases (trigger)
     ↓
track_customer_item_purchases() (function)
     ↓
customer_item_purchases table (upsert)
```

## Summary

**Problem:** Database error when completing orders with duplicate items  
**Cause:** Function processes items without aggregating duplicates first  
**Solution:** Add GROUP BY to aggregate items by menu_item_id before upserting  
**Action:** Run Migration 087 via Supabase dashboard  
**Status:** Fix created and ready to apply

---

**Next Steps:**
1. Run Migration 087 in Supabase dashboard
2. Test with an order containing duplicate items
3. Confirm error is resolved
4. Close this issue

If you encounter any problems, refer to `RUN_MIGRATION_087.md` for detailed instructions.
