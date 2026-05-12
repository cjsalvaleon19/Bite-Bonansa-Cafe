# Migration 147: FOR LOOP Purchase Tracking Trigger (URGENT — apply if retry also fails)

## ⚠️ Action Required

You are seeing **both** of these in the cashier browser console:

```
[OrdersQueue] Purchase tracking conflict for order: <uuid>
ON CONFLICT DO UPDATE command cannot affect row a second time
```

**AND**

```
[OrdersQueue] Retry after purchase conflict failed:
ON CONFLICT DO UPDATE command cannot affect row a second time
```

This means the production DB trigger is a version that cannot be fixed by
normalising the items payload from the client. The trigger itself must be
replaced. **This migration supersedes migrations 142–146.**

---

## Why This Migration Is Needed

Migrations 142–146 use an `INSERT … SELECT … GROUP BY` pattern. In some
environments the `GROUP BY` operates on raw text instead of `LOWER()`-normalised
text. Two items with the same UUID but different letter cases (`"ABC-..."` vs
`"abc-..."`) group into two separate rows that both map to the same UUID key,
causing:

```
ON CONFLICT DO UPDATE command cannot affect row a second time
```

Migration 147 replaces the `INSERT … SELECT` with a **FOR LOOP** that processes
one aggregated row at a time. A single-row INSERT cannot produce this error.

---

## How to Apply

### Option 1: Supabase Dashboard (Recommended)

1. Open your Supabase project → **SQL Editor** (left sidebar).
2. Click **+ New query**.
3. Copy the entire content of
   `supabase/migrations/147_for_loop_purchase_tracking_trigger.sql`.
4. Paste it into the editor and click **RUN** (`Ctrl + Enter`).
5. Check the **Results** tab — it should end with:
   ```
   NOTICE: Migration 147 applied: FOR LOOP purchase tracking trigger. ...
   ```

### Option 2: psql

```bash
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" \
  -f supabase/migrations/147_for_loop_purchase_tracking_trigger.sql
```

---

## Verification

```sql
-- 1. Confirm the trigger exists
SELECT tgname
FROM pg_trigger
JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
WHERE pg_class.relname = 'orders'
  AND tgname = 'trg_track_customer_purchases';
-- Expected: 1 row

-- 2. Confirm the function body uses FOR LOOP and LOWER
SELECT pg_get_functiondef('track_customer_item_purchases'::regproc);
-- Look for: FOR v_item IN, GROUP BY LOWER(, EXCEPTION, WHEN OTHERS

-- 3. Confirm legacy trigger is gone
SELECT tgname
FROM pg_trigger
JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
WHERE pg_class.relname = 'orders'
  AND tgname = 'trigger_update_customer_purchases';
-- Expected: 0 rows

-- 4. Confirm legacy function is gone
SELECT proname FROM pg_proc WHERE proname = 'update_customer_purchases';
-- Expected: 0 rows
```

---

## After Applying

1. Hard-refresh the cashier browser tab (`Ctrl + Shift + R`) to clear the service worker cache.
2. Try completing the previously-failing order again.

---

## What This Migration Changes

| Area | Effect |
|------|--------|
| Order completion | Fixed — no more 500 rollbacks from purchase tracking |
| Purchase history tracking | Continues normally via FOR LOOP + LOWER GROUP BY |
| Loyalty points | Unaffected (separate trigger) |
| Customer notifications | Unaffected (separate trigger) |
| Existing data | No changes — safe to apply at any time |

---

## Related Files

- `supabase/migrations/147_for_loop_purchase_tracking_trigger.sql` — SQL to run
- `supabase/migrations/146_bulletproof_purchase_tracking_trigger.sql` — Previous fix (INSERT…SELECT)
- `pages/cashier/orders-queue.js` — Client-side conflict guard
