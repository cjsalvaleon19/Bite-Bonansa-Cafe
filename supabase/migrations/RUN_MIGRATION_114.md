# Migration 114 — Apply Price Costing Headers Schema

**Error this fixes:**
> Could not find the table 'public.price_costing_headers' in the schema cache

## Steps

1. Open your [Supabase Dashboard → SQL Editor](https://supabase.com/dashboard).
2. Select the **Bite-Bonansa-Cafe** project.
3. Copy and paste the full contents of  
   `supabase/migrations/114_create_price_costing_headers.sql`  
   into the SQL editor and click **Run**.
4. After a successful run, go to **Settings → API** and click **"Reload schema cache"** (or restart PostgREST) so the new table is visible.

## What it creates

| Object | Description |
|--------|-------------|
| `price_costing_headers` | One row per menu item — stores wastage %, contingency %, CM %, selling price, total COGS |
| `price_costing_items.costing_header_id` | New FK column linking ingredient lines to their header |

Existing `price_costing_items` rows are backfilled automatically via the migration's `UPDATE` step.
