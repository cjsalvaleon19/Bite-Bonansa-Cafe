# Migration 029: Fix Variant Duplicates and Add Missing Variants

## Quick Start

**IMPORTANT: Run this migration to fix duplicate variant types and add missing variants!**

### Issues Being Fixed

Based on the screenshot showing duplicate Flavor sections for Chicken Platter, this migration addresses:

1. **Chicken Platter** - Delete duplicate "Flavor" variant type (the one with 14 options), keep the correct one with 7 flavors
2. **Chicken Meal** - Delete duplicate entries (old price), keep only the newest one
3. **Chicken Burger** - Ensure exactly 8 flavors, add "No Vegies" add-on
4. **Fruit Soda & Lemonade** - Add Size variant (16oz/22oz) with price modifiers
5. **All Items** - Clean up any duplicate variant types

### How to Run

#### Step 1: Backup (Recommended)
Backup your database before running any migration.

#### Step 2: Run the Migration

**Via Supabase Dashboard:**
1. Open Supabase Dashboard → SQL Editor
2. Copy and paste: `supabase/migrations/029_fix_variant_duplicates_and_add_missing_variants.sql`
3. Click "Run"
4. Check the output messages for success

**Via Supabase CLI:**
```bash
cd /path/to/Bite-Bonansa-Cafe
supabase db push
```

#### Step 3: Verify
Run these queries to confirm the fixes:

```sql
-- Verify Chicken Platter has only 1 Flavor variant type with 7 options
SELECT 
  COUNT(DISTINCT vt.id) as flavor_types,
  COUNT(vo.id) as flavor_options
FROM menu_items_base mb
JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
LEFT JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
WHERE mb.name = 'Chicken Platter'
  AND vt.variant_type_name = 'Flavor';
-- Should return: flavor_types = 1, flavor_options = 7

-- Verify Chicken Meal is not duplicated
SELECT COUNT(*) FROM menu_items_base WHERE name = 'Chicken Meal';
-- Should return: 1

-- Verify Chicken Burger has 8 flavors
SELECT COUNT(*) 
FROM menu_items_base mb
JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
WHERE mb.name = 'Chicken Burger'
  AND vt.variant_type_name = 'Flavor';
-- Should return: 8

-- Verify Chicken Burger has "No Vegies" option
SELECT COUNT(*) 
FROM menu_items_base mb
JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
WHERE mb.name = 'Chicken Burger'
  AND vo.option_name = 'No Vegies';
-- Should return: 1

-- Verify Fruit Soda items have Size variant
SELECT name, has_variants
FROM menu_items_base
WHERE category = 'Fruit Soda & Lemonade';
-- All should have has_variants = true
```

## What Gets Fixed

### 1. Chicken Platter - Remove Duplicate Flavor Variant

**Before:**
- 2 "Flavor" variant types (one with 14 options, one with 7)
- Showing duplicate options in UI (Barbecue, Buffalo Wings, Honey Butter, etc. appearing twice)

**After:**
- 1 "Flavor" variant type with exactly 7 options:
  - Honey Butter
  - Soy Garlic
  - Sweet & Sour
  - Sweet & Spicy
  - Teriyaki
  - Buffalo
  - Barbecue

### 2. Chicken Meal - Remove Duplicate Entry

**Before:**
- Multiple "Chicken Meal" entries (old price and new price)

**After:**
- 1 "Chicken Meal" entry (newest/highest price)

### 3. Chicken Burger - Fix Flavors and Add Option

**Before:**
- Variable number of flavors
- Missing "No Vegies" add-on

**After:**
- Exactly 8 flavors:
  - Honey Butter
  - Soy Garlic
  - Sweet & Sour
  - Sweet & Spicy
  - Teriyaki
  - Buffalo
  - Barbecue
  - Korean BBQ
- "No Vegies" add-on option available

### 4. Fruit Soda & Lemonade - Add Size Variant

**Before:**
- No size options
- Fixed price

**After:**
- Size variant (required):
  - 16oz (base price, no modifier)
  - 22oz (+₱15)

### 5. All Items - Clean Duplicate Variant Types

**Before:**
- Some menu items have duplicate variant types (same variant_type_name)

**After:**
- Each menu item has unique variant type names
- Duplicates removed (keeps most recent)

## Expected Output

```
================================================================
CLEANUP MIGRATION 029 - Starting
================================================================
Chicken Platter "Flavor" variant types: 2
Chicken Meal entries: 2
================================================================
Deleting Chicken Platter Flavor variant type ID: XXX
Keeping Chicken Platter Flavor variant type ID: YYY
Deleted 1 old Chicken Meal entries
Chicken Burger current flavor count: X
Fixed Chicken Burger: 8 flavors and "No Vegies" add-on
Processing: [Fruit Soda items]
Added Size variant (16oz/22oz) to: [items]
Checking for duplicate variant types...
================================================================
CLEANUP MIGRATION 029 - Complete
================================================================
Chicken Platter flavor options: 7 (should be 7) ✓
Chicken Meal entries: 1 (should be 1) ✓
Chicken Burger flavor options: 8 (should be 8) ✓
Chicken Burger has "No Vegies": true (should be true) ✓
Fruit Soda items with Size variant: X
Remaining duplicate variant types: 0 (should be 0) ✓

✓ All variant duplicates successfully removed
✓ All missing variants successfully added
✓ Menu data is clean and correct
================================================================
```

## Troubleshooting

### Error: Variant type not found
- The migration is safe - it checks for existence before deleting
- If variant types don't exist, it will skip and note in the output

### Duplicates still showing in UI
- Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)
- Check database directly to confirm changes applied
- Restart your app server

### Migration already run?
- Safe to run multiple times for steps that check existence
- Deletion steps only run if duplicates exist

## Related Files

- `supabase/migrations/029_fix_variant_duplicates_and_add_missing_variants.sql` - The migration
- `diagnose_variant_duplicates.sql` - Diagnostic script to check current state

## Summary

This migration:
- ✅ Removes duplicate "Flavor" variant type from Chicken Platter
- ✅ Deletes duplicate "Chicken Meal" entries
- ✅ Ensures Chicken Burger has exactly 8 flavors
- ✅ Adds "No Vegies" option to Chicken Burger
- ✅ Adds Size variant (16oz/22oz) to all Fruit Soda & Lemonade items
- ✅ Cleans up any duplicate variant types across all menu items
- ✅ Maintains data integrity
- ✅ Provides verification and audit trail

After running this migration, the variant selection UI will show clean, non-duplicate options for all menu items.
