# Migration 086: Fix Customer Item Purchases ON CONFLICT Error

## Problem

Getting error: **"ON CONFLICT DO UPDATE command cannot affect row a second time"** when completing pickup orders in the Orders Queue.

### Root Cause

The `track_customer_item_purchases()` trigger function processes each item in an order individually. When an order contains **multiple quantities of the same menu item** (e.g., "2x Coffee"), the function tries to upsert the same `(customer_id, menu_item_id)` row twice in the same transaction:

```sql
-- Order items: [{"id": "coffee-uuid", "quantity": 1}, {"id": "coffee-uuid", "quantity": 1}]
-- Loop iteration 1: INSERT/UPDATE (customer_id, coffee-uuid) → Success
-- Loop iteration 2: INSERT/UPDATE (customer_id, coffee-uuid) → ERROR!
```

PostgreSQL doesn't allow the same row to be affected multiple times by ON CONFLICT DO UPDATE within a single statement.

## Solution

**Aggregate items by `menu_item_id` before upserting** - group items in the SQL query so each menu_item_id is processed only once:

```sql
-- Before: Process each item array element individually
FOR v_order_item IN SELECT ... FROM jsonb_array_elements(NEW.items)

-- After: Aggregate by menu_item_id first
FOR v_aggregated_item IN 
  SELECT 
    menu_item_id,
    SUM(quantity) as total_quantity,
    SUM(price) as total_price
  FROM jsonb_array_elements(NEW.items)
  GROUP BY menu_item_id  -- Key fix: group identical items
```

## How to Run

### Option 1: Supabase Dashboard (Recommended)

1. Go to https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql
2. Copy and paste the entire content of `086_fix_customer_purchases_conflict.sql`
3. Click **RUN**
4. Verify success message in output

### Option 2: psql Command Line

```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres" \
  -f supabase/migrations/086_fix_customer_purchases_conflict.sql
```

## Verification

After running the migration, test by completing a pickup order with multiple items:

```sql
-- Verify the function was updated
SELECT pg_get_functiondef('track_customer_item_purchases'::regproc);

-- Should see: GROUP BY (item->>'id')::UUID in the function definition
```

## Testing

1. Create a pickup order with 2x of the same item (e.g., 2 coffees)
2. Go to Cashier > Orders Queue
3. Click "Complete Pick-up" for the order
4. Should succeed without error (previously would fail with 500 error)

## Impact

- **Fixes**: "ON CONFLICT DO UPDATE command cannot affect row a second time" error
- **Affected**: All order completions (dine-in, take-out, pickup, delivery)
- **Safe**: No data loss - only changes how items are aggregated before tracking
- **Backward compatible**: Works with all existing orders

## Related Issues

- Error appears in console: `[OrdersQueue] Failed to complete pickup order: ON CONFLICT DO UPDATE command cannot affect row a second time`
- 500 server error when clicking "Complete Pick-up" button
- Migration 078 introduced the track_customer_item_purchases feature
- Migration 074 fixed similar issue for loyalty_transactions table
