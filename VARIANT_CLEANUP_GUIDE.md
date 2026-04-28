# Variant Options Cleanup Guide

## Problem Statement

The variant system had issues where:
1. **Unavailable variant options** (marked as `available = false`) were stored in the database but should not exist at all
2. **Orphaned variant types** existed without any options, causing errors when customers tried to customize items
3. **Inconsistent has_variants flags** where items with variants had `has_variants = false` or items without variants had `has_variants = true`

## Solution Overview

This cleanup ensures that:
- Only **valid, available variant options** exist in the database
- Unavailable options are **permanently deleted**, not just marked as unavailable
- The UI properly **filters** any unavailable options that might exist temporarily
- A **trigger** prevents future creation of unavailable variant options

## Changes Made

### 1. Database Migration (027_cleanup_invalid_variant_options.sql)

**Step 1: Delete unavailable variant options**
```sql
DELETE FROM menu_item_variant_options
WHERE available = false;
```
Rationale: If a variant option is unavailable, it shouldn't be in the system at all.

**Step 2: Delete orphaned variant types**
```sql
DELETE FROM menu_item_variant_types
WHERE id NOT IN (
  SELECT DISTINCT variant_type_id 
  FROM menu_item_variant_options
);
```
Rationale: Variant types without options are useless and cause errors.

**Step 3: Fix has_variants flags**
```sql
-- Set to false for items with no variant types
UPDATE menu_items_base
SET has_variants = false
WHERE has_variants = true
  AND id NOT IN (
    SELECT DISTINCT menu_item_id 
    FROM menu_item_variant_types
  );

-- Set to true for items with variant types
UPDATE menu_items_base
SET has_variants = true
WHERE id IN (
  SELECT DISTINCT menu_item_id 
  FROM menu_item_variant_types
)
AND (has_variants = false OR has_variants IS NULL);
```

**Step 4: Create prevention trigger**
```sql
CREATE OR REPLACE FUNCTION check_variant_option_availability()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.available = false THEN
    RAISE EXCEPTION 'Cannot create/mark variant options as unavailable. Delete the option instead.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

This trigger prevents:
- Creating new unavailable options
- Marking existing options as unavailable
- Forces deletion instead of soft-delete

### 2. UI Updates (components/VariantSelectionModal.js)

Added filtering to only show available options:

**Before:**
```javascript
type.options
  .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
  .map(option => (
    // render option
  ))
```

**After:**
```javascript
type.options
  .filter(option => option.available !== false) // Filter unavailable
  .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
  .map(option => (
    // render option
  ))
```

### 3. Cashier POS Interface (pages/cashier/pos.js)

Already properly filters available options in the display:
```javascript
const availableOptions = vt.options ? vt.options.filter(opt => opt.available !== false) : [];
```

## Data Integrity Principles

### What Should Be In The Database

✅ **YES - Keep these:**
- Variant options that are currently available to customers
- Variant types that have at least one available option
- Menu items with properly set `has_variants` flags

❌ **NO - Delete these:**
- Variant options marked as `available = false`
- Variant types with zero options
- Any orphaned or inconsistent data

### Soft Delete vs Hard Delete

**We use HARD DELETE for variant options because:**
1. **Simplicity**: No need to filter `available = false` in every query
2. **Data integrity**: Prevents confusion about what's truly available
3. **Performance**: Smaller tables, faster queries
4. **Historical tracking**: Order history already captures variant details in order_items

**If you need to temporarily remove a variant:**
- Delete the option from `menu_item_variant_options`
- The variant can be re-added later if needed
- Existing orders retain the variant details in their order_items records

## Audit Script (audit_variant_data.sql)

Use this script to check the health of your variant data:

```bash
# Run in Supabase SQL Editor
psql -f audit_variant_data.sql
```

The script shows:
- All menu items with variant counts
- Orphaned variant types
- Variant options with their hierarchy
- Items with mismatched has_variants flags
- Summary statistics

## Migration Instructions

### Prerequisites
- Backup your database before running the cleanup migration
- Run the audit script first to see what will be cleaned

### Running the Migration

**Via Supabase Dashboard:**
1. Navigate to SQL Editor
2. Paste contents of `027_cleanup_invalid_variant_options.sql`
3. Click "Run"
4. Check the output for verification messages

**Via Supabase CLI:**
```bash
supabase db push
```

### Verification

After migration, run these checks:

```sql
-- Should return 0 rows (no unavailable options)
SELECT COUNT(*) FROM menu_item_variant_options WHERE available = false;

-- Should return 0 rows (no orphaned variant types)
SELECT COUNT(*) 
FROM menu_item_variant_types vt
LEFT JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
WHERE vo.id IS NULL;

-- Should return 0 rows (no mismatched has_variants)
SELECT COUNT(*)
FROM menu_items_base mb
WHERE (
  (mb.has_variants = true AND NOT EXISTS (
    SELECT 1 FROM menu_item_variant_types vt WHERE vt.menu_item_id = mb.id
  ))
  OR
  (mb.has_variants = false AND EXISTS (
    SELECT 1 FROM menu_item_variant_types vt WHERE vt.menu_item_id = mb.id
  ))
);
```

All queries should return 0.

## Best Practices Going Forward

### Adding New Variant Options

✅ **DO:**
```sql
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, available, display_order)
VALUES (variant_type_id, 'New Option', 10.00, true, 1);
```

❌ **DON'T:**
```sql
-- This will be rejected by the trigger
INSERT INTO menu_item_variant_options (variant_type_id, option_name, available)
VALUES (variant_type_id, 'Unavailable Option', false);
```

### Removing Variant Options

✅ **DO - Delete it:**
```sql
DELETE FROM menu_item_variant_options WHERE id = 'option-uuid';
```

❌ **DON'T - Mark as unavailable:**
```sql
-- This will be rejected by the trigger
UPDATE menu_item_variant_options SET available = false WHERE id = 'option-uuid';
```

### Temporarily Hiding Variant Options

If you need to temporarily hide a variant option:

1. **Option 1 - Delete and Re-add Later:**
   - Delete the option now
   - Store the details (option_name, price_modifier) somewhere
   - Re-insert when needed

2. **Option 2 - Use a Different Approach:**
   - Consider if you really need soft-delete functionality
   - If yes, add a new column like `is_temporarily_hidden` (but this adds complexity)

## Troubleshooting

### Issue: Trigger prevents marking option as unavailable

**Error:**
```
ERROR: Cannot create/mark variant options as unavailable. Delete the option instead.
```

**Solution:**
```sql
-- Instead of updating, delete the option
DELETE FROM menu_item_variant_options WHERE id = 'option-uuid';
```

### Issue: Variant type has no options

**Symptom:** Error when customers try to select variants

**Solution:**
```sql
-- Either add an option to the variant type
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier)
VALUES ('variant-type-uuid', 'Default Option', 0);

-- Or delete the empty variant type
DELETE FROM menu_item_variant_types WHERE id = 'variant-type-uuid';
```

### Issue: Menu item shows "Customizable" but has no variants

**Symptom:** `has_variants = true` but no variant types exist

**Solution:**
```sql
-- Fix automatically with migration 027, or manually:
UPDATE menu_items_base 
SET has_variants = false 
WHERE id = 'item-uuid';
```

## Impact Analysis

### Database Changes
- Deletes all unavailable variant options
- Deletes all orphaned variant types
- Updates has_variants flags to match reality
- Adds trigger to prevent future inconsistencies

### UI Changes
- VariantSelectionModal filters unavailable options
- Cashier POS already filters properly
- No visible change for correctly configured items

### Order History
- **Not affected**: Existing orders already have variant details stored in order_items
- Historical data is preserved even after deleting variant options

## Related Files

- `/supabase/migrations/027_cleanup_invalid_variant_options.sql` - Cleanup migration
- `/audit_variant_data.sql` - Diagnostic script
- `/components/VariantSelectionModal.js` - Variant selection UI component
- `/pages/cashier/pos.js` - Cashier POS interface
- `/supabase/migrations/026_enable_has_variants_flag.sql` - Previous variant migration

## Summary

After running this cleanup:
1. ✅ Only valid, available variant options exist in the database
2. ✅ All variant types have at least one option
3. ✅ All has_variants flags are accurate
4. ✅ Future invalid options are prevented by trigger
5. ✅ UI properly filters any edge cases
6. ✅ Data integrity is enforced at multiple levels
