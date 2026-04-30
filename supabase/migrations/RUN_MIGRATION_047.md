# Migration 047: Remove Orphaned Journal Triggers

## Purpose

This migration removes orphaned triggers on the `order_items` table that reference a non-existent function `post_order_journal_entries`, which was causing failures when marking order items as served in the Orders Queue.

## Problem

**Error**: `function public.post_order_journal_entries(text, character varying, text) does not exist`

**When It Occurs**: When cashiers try to mark an order item as served in the Orders Queue (`/cashier/orders-queue`)

**Root Cause**: 
- A trigger was created on the `order_items` table in production that references `post_order_journal_entries`
- This function was never created or has been dropped
- When updating `order_items.served = true`, the trigger fires and fails

## Solution

This migration:
1. Scans all triggers on the `order_items` table
2. Identifies triggers that reference journal-related functions
3. Drops those orphaned triggers
4. Drops the `post_order_journal_entries` function if it exists (to prevent future conflicts)

## What Gets Removed

- Any trigger on `order_items` that references functions with "journal" in the name
- Specifically targets `post_order_journal_entries` function
- Does NOT remove valid triggers like `trg_update_customer_item_purchases`

## What Gets Kept

- Valid triggers that serve actual functionality
- `trg_update_customer_item_purchases` - updates customer purchase tracking
- Any other triggers that reference existing, working functions

## How to Apply

### Via Supabase Dashboard (Recommended)

1. Go to SQL Editor in your Supabase Dashboard
2. Copy and paste the entire contents of this file
3. Click "Run"
4. Check the output for success messages

### Via psql Command Line

```bash
psql -h <your-db-host> -U postgres -d postgres -f supabase/migrations/047_remove_orphaned_journal_triggers.sql
```

### Via Supabase CLI

```bash
supabase db push
```

## Verification

After running the migration, you should see output similar to:

```
NOTICE: Dropped trigger trg_post_journal_entries referencing journal function post_order_journal_entries
NOTICE: ✓ Dropped 1 orphaned trigger(s) from order_items table
NOTICE: ════════════════════════════════════════════════════════════
NOTICE: VERIFICATION: order_items table has 1 active trigger(s)
NOTICE: ════════════════════════════════════════════════════════════
```

The remaining trigger should be `trg_update_customer_item_purchases` (or similar valid triggers).

## Testing

After applying this migration:

1. Navigate to Orders Queue: `/cashier/orders-queue`
2. Find an order with items
3. Click "Mark as Served" on an item
4. Verify that:
   - The item is marked as served successfully
   - No "function does not exist" error appears
   - The order status updates correctly when all items are served

## Impact

**Positive**:
- ✅ Marking items as served will work correctly
- ✅ No more "function does not exist" errors
- ✅ Order completion workflow will function properly

**Neutral**:
- ⚠️ If journal functionality was intended, it was never working anyway (function didn't exist)
- ⚠️ No journal entries will be created when items are marked as served

**Note**: If you need journal/audit functionality for order items, you'll need to implement it properly by:
1. Creating the `post_order_journal_entries` function
2. Creating a proper trigger that calls it
3. Testing that it works as expected

## Rollback

If you need to rollback this migration (not recommended):

```sql
-- WARNING: This will recreate the error
-- Only do this if you're about to implement proper journal functionality

-- You would need to recreate the trigger that was dropped
-- However, since the function doesn't exist, this will just cause the same error again
-- Not recommended unless you implement the function first
```

## Related Migrations

- Migration 044: Added `served` column to `order_items`
- Migration 045: Added `variant_details` column to `order_items`

## Dependencies

This migration has no dependencies and can be run independently, but it's recommended to run it after migrations 045 and 046 for the complete fix.

## Author Notes

This migration is defensive and safe to run multiple times (idempotent). It uses `IF EXISTS` clauses to prevent errors if triggers have already been dropped.

The migration identifies triggers by:
1. Checking if the function name contains "journal"
2. Specifically looking for `post_order_journal_entries`

This ensures we don't accidentally drop valid triggers while cleaning up orphaned ones.
