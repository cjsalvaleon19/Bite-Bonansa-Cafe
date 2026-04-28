# Migration 023 - Table/View Conflict Fix

## Issue
When running migration `023_fix_cashier_interface_issues.sql`, you may encounter:

```
ERROR:  42809: "menu_items" is not a view
HINT:  Use DROP TABLE to remove a table.
```

## Root Cause

The migration attempted to drop `menu_items` as a VIEW:
```sql
DROP VIEW IF EXISTS menu_items CASCADE;
```

However, in some database instances, `menu_items` exists as a TABLE (created by older migrations like `database_role_and_schema_fixes.sql`). PostgreSQL requires you to use `DROP TABLE` for tables and `DROP VIEW` for views - they cannot be used interchangeably.

## Solution Applied

The migration has been updated (2026-04-28) to drop as TABLE first:

```sql
-- Drop existing menu_items (could be either table or view from previous migrations)
-- First try to drop as table, then as view
DROP TABLE IF EXISTS menu_items CASCADE;
DROP VIEW IF EXISTS menu_item_variants CASCADE;
```

This ensures the migration works regardless of whether `menu_items` exists as a table or view.

## If You Already Encountered the Error

### Option 1: Use Updated Migration (Recommended)
1. Pull the latest version of the migration file
2. Re-run the migration

### Option 2: Manual Fix
1. Connect to your Supabase database via SQL Editor
2. Run this command manually:
   ```sql
   DROP TABLE IF EXISTS menu_items CASCADE;
   ```
3. Then re-run the full migration file

## Why This Happened

The codebase evolved over time:
1. **Initially**: `menu_items` was created as a regular TABLE
2. **Migration 012**: Introduced `menu_items_base` as the actual table with variants support
3. **Migration 023**: Attempted to create `menu_items` as a VIEW to map queries to `menu_items_base`

The conflict occurs because migration 023 didn't account for databases that still had the old `menu_items` table.

## Prevention

The updated migration now:
- Uses `DROP TABLE IF EXISTS` to safely remove the old table
- Uses `CASCADE` to drop dependent objects
- Creates the new view with the same name
- Adds INSTEAD OF triggers to make the view fully updatable

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
2026-04-28

## Commit
The fix was committed with message: "Fix migration to drop menu_items table before creating view"
