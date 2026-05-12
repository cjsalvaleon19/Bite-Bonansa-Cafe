# Migration 144: Fix JSON Arrow Operators in `track_customer_item_purchases`

## Problem

The `track_customer_item_purchases()` function currently stored in the database uses the **single-arrow `->` operator** (which returns `jsonb`) for all JSON field extractions:

```sql
item->'id'        -- returns jsonb, e.g. "\"abc-...\""
item->'quantity'  -- returns jsonb
item->'price'     -- returns jsonb
```

This causes a **runtime type error** whenever the trigger fires:

```
ERROR: COALESCE types jsonb and text cannot be matched
```

Because the code does things like `COALESCE(item->'quantity', '')` where `''` is `text`, not `jsonb`.

The EXCEPTION WHEN OTHERS block prevents the error from blocking order completion, but **purchase tracking silently records nothing** for every completed order.

## Root Cause

Migration 142 (`142_harden_customer_purchase_tracking_trigger.sql`) contains the correct **double-arrow `->>` operator** (which returns `text`), but the version in the database has single-arrow `->`. Migration 142 was either not applied to this database, or was applied with corrupted characters.

## What This Migration Does

Drops and recreates `track_customer_item_purchases()` replacing all `->` (jsonb) operators with `->>'` (text) operators:

| Before (broken) | After (fixed) |
|---|---|
| `item->'id'` | `item->>'id'` |
| `item->'quantity'` | `item->>'quantity'` |
| `item->'price'` | `item->>'price'` |
| `COALESCE(item->'id', '') ~ ...` | `COALESCE(item->>'id', '') ~ ...` |

## How to Run

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project → **SQL Editor**.
2. Click **+ New query**.
3. Copy the entire content of `supabase/migrations/144_fix_track_customer_purchases_arrow_operators.sql`.
4. Paste and click **RUN** (`Ctrl + Enter`).
5. Confirm the Results tab shows:
   ```
   NOTICE: Migration 144: track_customer_item_purchases() recreated with ->> (text) operators...
   ```

### Option 2: psql

```bash
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" \
  -f supabase/migrations/144_fix_track_customer_purchases_arrow_operators.sql
```

## Verification

```sql
-- 1. Confirm the function now uses ->> operators
SELECT pg_get_functiondef('track_customer_item_purchases'::regproc);
-- Expected: body contains "->>'id'" and "->>'quantity'" and "->>'price'"
-- NOT: "->'id'" (single arrow)

-- 2. Confirm the trigger is present
SELECT tgname FROM pg_trigger
JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
WHERE pg_class.relname = 'orders' AND tgname = 'trg_track_customer_purchases';
-- Expected: 1 row
```

## Also Apply (If Not Already Done)

Run these migrations in order if they haven't been applied yet:

| Migration | What it fixes |
|---|---|
| `142_harden_customer_purchase_tracking_trigger.sql` | (superseded by 144) |
| `143_harden_order_completion_notification_and_loyalty_triggers.sql` | Adds EXCEPTION WHEN OTHERS to notification and loyalty triggers so they can't block order completion |

## Testing

1. Create a **Pick-up** order with 2+ items (including duplicate items to test GROUP BY).
2. In **Cashier → Orders Queue**, move the order through to `out_for_delivery`.
3. Click **✓ Order Complete** — should complete instantly with success alert.
4. Verify in Supabase → `customer_item_purchases` table that a row was inserted.
