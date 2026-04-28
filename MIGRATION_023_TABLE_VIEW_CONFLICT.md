# Migration 023 - Table/View Conflict Fix

## Issue 1: Table vs View Conflict
When running migration `023_fix_cashier_interface_issues.sql`, you may encounter:

```
ERROR:  42809: "menu_items" is not a view
HINT:  Use DROP TABLE to remove a table.
```

### Root Cause
The migration attempted to drop `menu_items` as a VIEW, but in some database instances, `menu_items` exists as a TABLE.

### Solution Applied
The migration now drops as TABLE first:
```sql
DROP TABLE IF EXISTS menu_items CASCADE;
```

## Issue 2: Missing is_sold_out Column
When running the migration, you may encounter:

```
ERROR:  42703: column "is_sold_out" does not exist
LINE 33:   is_sold_out,
```

### Root Cause
The migration was creating a view that selects `is_sold_out` from `menu_items_base`, but this column didn't exist in the base table yet. Migration 022 was adding it to the wrong table (`menu_items` instead of `menu_items_base`).

### Solution Applied (2026-04-28)

Both migrations have been updated:

**Migration 022** (`022_cashier_settings.sql`):
- Now adds `is_sold_out` column to `menu_items_base` (not `menu_items`)
- Creates index on `menu_items_base.is_sold_out`

**Migration 023** (`023_fix_cashier_interface_issues.sql`):
- First ensures `is_sold_out` column exists in `menu_items_base` (defensive check)
- Then drops the `menu_items` table
- Finally creates `menu_items` view that includes the `is_sold_out` column

The correct order is:
1. Add column to the base table (`menu_items_base`)
2. Drop the old table (`menu_items`)
3. Create view (`menu_items`) that exposes the column from base table

## If You Already Encountered the Error

### Option 1: Use Updated Migrations (Recommended)
1. Pull the latest version of both migration files (022 and 023)
2. Drop the problematic objects manually if needed:
   ```sql
   DROP TABLE IF EXISTS menu_items CASCADE;
   ```
3. Re-run both migrations in order:
   - First: `022_cashier_settings.sql`
   - Then: `023_fix_cashier_interface_issues.sql`

### Option 2: Manual Fix
1. Connect to your Supabase database via SQL Editor
2. Run these commands in order:
   ```sql
   -- Add the column to the base table
   ALTER TABLE menu_items_base ADD COLUMN IF NOT EXISTS is_sold_out BOOLEAN DEFAULT FALSE;
   CREATE INDEX IF NOT EXISTS idx_menu_items_base_sold_out ON menu_items_base(is_sold_out);
   
   -- Drop the old table
   DROP TABLE IF EXISTS menu_items CASCADE;
   ```
3. Then re-run the full migration 023 file

## Why This Happened

The codebase evolved over time:
1. **Initially**: `menu_items` was created as a regular TABLE
2. **Migration 012**: Introduced `menu_items_base` as the actual table with variants support
3. **Migration 022**: Attempted to add `is_sold_out` column to `menu_items` table
4. **Migration 023**: Attempted to create `menu_items` as a VIEW to map queries to `menu_items_base`

The conflicts occurred because:
- Migration 023 didn't account for databases that still had the old `menu_items` table (fixed by using DROP TABLE)
- Migration 022 added `is_sold_out` to the wrong table - it added it to `menu_items` which would be dropped, instead of `menu_items_base` where it needs to be (fixed by targeting `menu_items_base`)
- Migration 023 tried to select `is_sold_out` from `menu_items_base` before it existed (fixed by adding the column first)

## Prevention

The updated migrations now:
- **Migration 022**: Adds `is_sold_out` column to `menu_items_base` (the actual base table)
- **Migration 023**: 
  - Defensively ensures `is_sold_out` exists in `menu_items_base`
  - Uses `DROP TABLE IF EXISTS` to safely remove the old table
  - Uses `CASCADE` to drop dependent objects
  - Creates the new `menu_items` view with the same name
  - Adds INSTEAD OF triggers to make the view fully updatable

The proper sequence is:
1. Column added to base table (`menu_items_base`)
2. Old table dropped (`menu_items`)
3. View created (`menu_items`) that maps to base table and exposes all columns including `is_sold_out`

## Verification

After running the updated migration, verify:

```sql
-- Check that menu_items is now a view
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'menu_items';
```

Expected result:
```
table_name  | table_type
------------|------------
menu_items  | VIEW
```

## Related Files
- Migration: `supabase/migrations/023_fix_cashier_interface_issues.sql`
- Documentation: `CASHIER_INTERFACE_FIX.md`
- Summary: `FIX_SUMMARY.md`

## Date Fixed
- **2026-04-28**: Fixed table/view DROP conflict
- **2026-04-28**: Fixed is_sold_out column targeting wrong table

## Commits
- "Fix migration to drop menu_items table before creating view"
- "Fix is_sold_out column to be added to menu_items_base"
