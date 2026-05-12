# Migration 146: Bulletproof Purchase Tracking Trigger (URGENT)

## ⚠️ Action Required

You are seeing this error in the cashier browser console:

```
[OrdersQueue] Purchase tracking conflict for order: <uuid>
ON CONFLICT DO UPDATE command cannot affect row a second time
```

And a 500 HTTP error when completing pickup orders:

```
bffpcgsevigxpldidxgl.supabase.co/rest/v1/orders?id=eq.<uuid>  Failed to load resource: the server responded with a status of 500
```

**This migration must be applied to your production Supabase database.**

> If you also see `[OrdersQueue] Retry after purchase conflict failed`, apply
> [Migration 147](./RUN_MIGRATION_147.md) instead — it is a stronger fix.

---

## How to Apply

### Option 1: Supabase Dashboard (Recommended)

1. Open your Supabase project → **SQL Editor** (left sidebar).
2. Click **+ New query**.
3. Copy the entire content of
   `supabase/migrations/146_bulletproof_purchase_tracking_trigger.sql`.
4. Paste it into the editor and click **RUN** (`Ctrl + Enter`).
5. Confirm the **Results** tab shows no errors.

### Option 2: psql

```bash
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" \
  -f supabase/migrations/146_bulletproof_purchase_tracking_trigger.sql
```

---

## Verification

Run these in the SQL Editor after applying the migration:

```sql
-- 1. Confirm the trigger exists
SELECT tgname
FROM pg_trigger
JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
WHERE pg_class.relname = 'orders'
  AND tgname = 'trg_track_customer_purchases';

-- 2. Confirm the function has LOWER() and EXCEPTION handling
SELECT pg_get_functiondef('track_customer_item_purchases'::regproc);
-- Look for: LOWER(), EXCEPTION, WHEN OTHERS, outer EXCEPTION block

-- 3. Confirm legacy function is gone
SELECT proname FROM pg_proc WHERE proname = 'update_customer_purchases';
-- Expected: 0 rows
```

---

## After Applying

1. Hard-refresh the cashier browser tab (`Ctrl + Shift + R`) to clear the service worker cache.
2. Try completing the previously-failing order again.
