# Migration 032: Standardize Add-on Variant Names

## Overview
This migration standardizes all "Add-ons" (with hyphen) variant type names to "Add Ons" (with space) across all menu items.

## Problem
The database has inconsistent variant type names:
- Some items use "Add-ons" (with hyphen)
- Some items use "Add Ons" (with space)
- Some items have BOTH, creating duplicates

This creates confusion and inconsistency in the UI and makes it difficult to query and manage add-on options.

## Solution
The migration:
1. **Merges duplicates**: For items with both "Add-ons" and "Add Ons", it:
   - Moves all options from "Add-ons" to "Add Ons" (avoiding duplicates)
   - Deletes the "Add-ons" variant type
   
2. **Renames singles**: For items with only "Add-ons", it:
   - Renames the variant type to "Add Ons"

3. **Verifies**: Ensures no "Add-ons" variant types remain

## Expected Results
After running this migration:
- ✅ All items will use "Add Ons" (with space)
- ✅ No "Add-ons" (with hyphen) variant types will exist
- ✅ All add-on options are preserved
- ✅ No duplicate options

## How to Run
```bash
# This migration will be automatically applied with Supabase migrations
supabase db push
```

Or run directly:
```sql
\i supabase/migrations/032_standardize_addon_variant_names.sql
```

## Related Issues
- Delete all "Add-ons" Variants and retain "Add Ons" variant
- Standardize naming convention across all menu items

## Migration Safety
- ✅ Idempotent: Can be run multiple times safely
- ✅ Preserves all options: No data loss
- ✅ Handles edge cases: Both duplicates and single instances
- ✅ Includes verification: Raises exception if standardization fails
