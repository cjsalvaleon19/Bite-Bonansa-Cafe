# Migration 145: Fix purchase tracking ON CONFLICT edge case

## Problem

Orders Queue shows:

```
Purchase tracking conflict for order: ... ON CONFLICT DO UPDATE command cannot affect row a second time
```

The order update can return 500 from PostgREST when this trigger error occurs.

## Root Cause

`track_customer_item_purchases()` grouped on raw JSON item IDs before UUID normalization.  
If the same item UUID appears in mixed letter case in one order payload, grouped rows remain separate, then collide on the same `(customer_id, menu_item_id)` during upsert.

## What Migration 145 Changes

- Recreates `track_customer_item_purchases()`
- Normalizes `item->>'id'` to lowercase first
- Groups by normalized ID before UUID cast/upsert
- Keeps trigger best-effort (`EXCEPTION WHEN OTHERS`) so order completion is never blocked

## How to Run (Supabase SQL Editor)

1. Open Supabase project → **SQL Editor**
2. Click **+ New query**
3. Paste contents of:
   `supabase/migrations/145_fix_customer_purchase_conflict_case_grouping.sql`
4. Click **RUN**
5. Confirm notice:
   `Migration 145 applied: normalized lowercase grouping...`

## Quick Verification

```sql
SELECT pg_get_functiondef('track_customer_item_purchases'::regproc);
```

Expected in function body:
- `LOWER(COALESCE(item->>'id', '')) AS menu_item_id_text`
- `GROUP BY valid_items.menu_item_id_text`
