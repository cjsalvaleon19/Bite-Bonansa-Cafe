# Migration 142: Harden Customer Purchase Tracking Trigger

## Problem

You are still getting this error when completing orders in the Orders Queue:

```
[OrdersQueue] Purchase tracking conflict for order: <order-id>
ON CONFLICT DO UPDATE command cannot affect row a second time
```

Along with:

```
Failed to load resource: the server responded with a status of 500 ()
[SW] Network failed, serving from cache: /cashier/orders-queue
```

### Why previous migrations (086, 087, 088) may not have fully resolved this

Previous fixes targeted the `trg_track_customer_purchases` trigger / `track_customer_item_purchases()` function. However, **a legacy trigger** — `trigger_update_customer_purchases` (backed by `update_customer_purchases()`) — may still be present in the live database from an even older migration. Both triggers fire on every `UPDATE` to the `orders` table, and the legacy one has no exception handling, so it rolls back the entire order status update with a HTTP 500 error.

Migration 142 resolves this definitively by:

1. **Dropping the legacy trigger/function pair** (`trigger_update_customer_purchases` / `update_customer_purchases`).
2. **Dropping and recreating** the current pair (`trg_track_customer_purchases` / `track_customer_item_purchases`) with:
   - A single batch `INSERT ... SELECT ... GROUP BY` instead of a per-item loop, which prevents the "cannot affect row a second time" conflict by design.
   - An inner `BEGIN ... EXCEPTION WHEN OTHERS ... END` block so any remaining edge-case failure is logged as a `WARNING` and **never** blocks the order status update.
   - Input validation (UUID pattern check, numeric guards) before touching `customer_item_purchases`.
   - `SECURITY DEFINER SET search_path = public` for correct privilege scoping.

## How to Run

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project → **SQL Editor** (left sidebar).
2. Click **+ New query**.
3. Copy the entire content of `supabase/migrations/142_harden_customer_purchase_tracking_trigger.sql`.
4. Paste it into the editor and click **RUN** (or press `Ctrl + Enter`).
5. Confirm there are no errors in the **Results** tab.

### Option 2: psql Command Line

```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres" \
  -f supabase/migrations/142_harden_customer_purchase_tracking_trigger.sql
```

## Verification

Run the following queries in the SQL Editor to confirm the migration applied correctly:

```sql
-- 1. Confirm the legacy trigger is gone
SELECT tgname
FROM pg_trigger
JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
WHERE pg_class.relname = 'orders'
  AND tgname IN ('trigger_update_customer_purchases', 'trg_track_customer_purchases');

-- Expected: only 'trg_track_customer_purchases' should appear.

-- 2. Confirm the new function body contains GROUP BY and EXCEPTION handling
SELECT pg_get_functiondef('track_customer_item_purchases'::regproc);

-- Expected: should contain 'GROUP BY', 'EXCEPTION', and 'WHEN OTHERS'.

-- 3. Confirm the legacy function is gone
SELECT proname FROM pg_proc WHERE proname = 'update_customer_purchases';
-- Expected: 0 rows.
```

## Testing

1. In the customer app, create a pickup or delivery order that contains **two or more units of the same menu item** (e.g. 2× Coffee).
2. Go to **Cashier → Orders Queue**.
3. Click **"Complete Pick-up"** (or mark all items as served for a dine-in order).
4. The order should complete successfully — no 500 error, no browser console warning about "ON CONFLICT DO UPDATE".

**Before fix**: HTTP 500, `[OrdersQueue] Purchase tracking conflict for order: ...`, service worker cache fallback.  
**After fix**: Order completes instantly. ✓

## Impact

| Area | Effect |
|------|--------|
| Order completion | Fixed — no more 500 rollbacks from purchase tracking |
| Purchase history (`customer_item_purchases`) | Continues to be updated correctly |
| Loyalty points | Unaffected — separate trigger |
| Existing data | No changes — safe to apply at any time |

## Related Files

- `supabase/migrations/142_harden_customer_purchase_tracking_trigger.sql` — The SQL to run
- `supabase/migrations/078_track_customer_item_purchases.sql` — Original feature
- `supabase/migrations/086_fix_customer_purchases_conflict.sql` — First GROUP BY fix
- `supabase/migrations/087_verify_and_reapply_customer_purchases_fix.sql` — Reapply attempt
- `supabase/migrations/088_fix_track_purchases_exception_handling.sql` — Exception handling added
- `pages/cashier/orders-queue.js` — Client-side conflict guard (already handles gracefully)

## Need Help?

If you are still experiencing the error after running this migration:

1. Verify the migration ran without errors in the Supabase Results tab.
2. Run the verification queries above to confirm both triggers/functions are in the expected state.
3. Check Supabase → **Logs → Database** for any `WARNING` messages from `track_customer_item_purchases` — these are now non-fatal.
4. Ensure you are running the migration on the **correct project** (check the project URL matches your production Supabase URL).
5. Hard-refresh the cashier browser tab (`Ctrl + Shift + R`) to clear the service worker cache.
