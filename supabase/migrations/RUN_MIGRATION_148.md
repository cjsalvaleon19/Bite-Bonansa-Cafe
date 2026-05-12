# Migration 148: Fix `->` vs `->>` Operator Corruption (URGENT)

## ⚠️ Apply This Migration Now

Your production database is running a corrupted version of
`track_customer_item_purchases()` that uses the **single-arrow** JSON operator
(`->`, returns JSONB) instead of the **double-arrow** operator (`->>`, returns
TEXT). This happened because migration 147 was copied through a web page that
HTML-encoded `>>` as `&gt;&gt;` — which, when pasted, silently became `>` (a
single `>`), leaving `->` where `->>` was intended.

### What the corrupted function does

| Expression | Actual type | Problem |
|---|---|---|
| `LOWER(item->'id')` | JSONB | `LOWER()` requires TEXT — runtime error |
| `COALESCE(item->'id', '')` | JSONB vs TEXT | Type mismatch — runtime error |
| `item->'quantity' ~ '^\d+$'` | JSONB | Regex `~` requires TEXT — runtime error |

These errors are caught by the `EXCEPTION WHEN OTHERS` block, so **orders
complete successfully** — but **purchase tracking is silently not recording any
data**.

### Why you still see HTTP 500 errors

If a legacy trigger (`trigger_update_customer_purchases`) is still present in
your database alongside the corrupted function, that trigger fires on every
order update and lacks exception handling, causing a 500 rollback.

Migration 148 drops all legacy triggers and recreates the function correctly.

---

## How to Apply

### Option 1: Supabase Dashboard (Recommended)

> ⚠️ **Do NOT copy-paste this SQL through a web browser address bar or any
> interface that HTML-encodes special characters.** Use the Supabase SQL Editor
> directly and paste from the raw file.

1. Open your Supabase project → **SQL Editor** (left sidebar).
2. Click **+ New query**.
3. Open the file
   `supabase/migrations/148_fix_arrow_operators_in_for_loop_trigger.sql`
   in a **plain text editor** (VS Code, Notepad++, etc.).
4. Select all (`Ctrl+A`) and copy (`Ctrl+C`).
5. Paste into the Supabase SQL Editor (`Ctrl+V`).
6. Click **RUN** or press `Ctrl+Enter`.
7. Check the Results tab — it should end with:
   ```
   NOTICE: Migration 148 applied: track_customer_item_purchases() recreated with ->> (TEXT) operators. ...
   ```

### Option 2: psql

```bash
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" \
  -f supabase/migrations/148_fix_arrow_operators_in_for_loop_trigger.sql
```

---

## Verification

After applying, run these in the SQL Editor:

```sql
-- 1. Confirm the new trigger exists
SELECT tgname
FROM pg_trigger
JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
WHERE pg_class.relname = 'orders'
  AND tgname = 'trg_track_customer_purchases';
-- Expected: 1 row

-- 2. Confirm legacy trigger is gone
SELECT tgname
FROM pg_trigger
JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
WHERE pg_class.relname = 'orders'
  AND tgname = 'trigger_update_customer_purchases';
-- Expected: 0 rows

-- 3. Confirm function body uses ->> (TEXT) operators
SELECT pg_get_functiondef('track_customer_item_purchases'::regproc);
-- Look for: item->>'id', item->>'quantity', item->>'price'
-- These should have TWO > characters, not one.
-- If you see item->'id' (one >) the operator is WRONG.

-- 4. Confirm legacy function is gone
SELECT proname FROM pg_proc WHERE proname = 'update_customer_purchases';
-- Expected: 0 rows
```

---

## After Applying

1. Hard-refresh the cashier browser tab (`Ctrl+Shift+R`) to clear the
   service worker cache.
2. Complete a test pickup order — it should succeed without any 500 error
   or "ON CONFLICT DO UPDATE" warning in the console.

---

## What Changed

| Area | Before | After |
|---|---|---|
| JSON field extraction | `->'id'` (JSONB — broken) | `->>'id'` (TEXT — correct) |
| LOWER() on item IDs | Fails at runtime | Works correctly |
| COALESCE with quantity/price | Type mismatch error | Works correctly |
| Legacy trigger cleanup | May still be present | Dropped definitively |
| Order completion (500) | Possible if legacy trigger present | Fixed |
| Purchase tracking data | Silently skipped | Now records correctly |

---

## Related Files

- `supabase/migrations/148_fix_arrow_operators_in_for_loop_trigger.sql` — SQL to run
- `supabase/migrations/147_for_loop_purchase_tracking_trigger.sql` — Previous migration (correct in repo but corrupted in DB)
- `supabase/migrations/144_fix_track_customer_purchases_arrow_operators.sql` — Earlier fix for the same `->` vs `->>` bug
