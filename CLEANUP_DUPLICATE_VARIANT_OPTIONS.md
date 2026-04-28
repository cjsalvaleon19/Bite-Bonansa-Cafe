# Migration 030: Cleanup Duplicate Variant Options

## Problem
Duplicate variant options exist in the database where the same `option_name` appears multiple times for the same `variant_type_id`.

### Examples from Database
- **Calamares** - Sauce: Mayonnaise (2), Meaty Sauce (2), Sinamak (2)
- **Clubhouse** - Add-ons: Extra Bacon (2), Extra Cheese (2), Fries (2)
- **Footlong** - Add-ons: Extra Cheese (2), Fries (2), No Veggies (2)
- **Fries** - Flavor: Cheese (2), Meaty Sauce (2), Sour Cream (2)
- **Siomai** - Spice Level: Regular (3!), Spicy (3!)
- **Samyang Carbonara & Chicken** - Add-ons: Extra Cheese (2), Extra Egg (2)
- **Spag & Chicken** - Add-ons: Extra Cheese (2), Garlic Bread (2)
- **Spag Solo** - Add-ons: Extra Cheese (2), Garlic Bread (2), Meatballs (2)
- **Waffles** - Variety: Blueberry (2), Chocolate (2), Nutella (2), Plain (2), Strawberry (2)

## Root Cause
Multiple migrations (012, 013, 016) inserted variant options without checking if they already existed, causing duplicates of the same option_name for the same variant_type_id.

## Solution
Migration 030 automatically:
1. Identifies all duplicate variant options (same variant_type_id + option_name)
2. Keeps the most recent option (highest UUID/ID)
3. Deletes all duplicate records
4. Provides detailed logging

## How to Run

### Option 1: Supabase Dashboard
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy the contents of `supabase/migrations/030_cleanup_duplicate_variant_options.sql`
4. Click "Run"
5. Check the logs for detailed information

### Option 2: Supabase CLI
```bash
supabase db push
```

## Expected Output
```
NOTICE:  ================================================================
NOTICE:  CLEANUP MIGRATION 030 - Starting
NOTICE:  ================================================================
NOTICE:  Duplicate variant option groups found: 25
NOTICE:  ================================================================
NOTICE:  Cleaning up duplicate variant options...
NOTICE:  Found 1 duplicate(s) of option "Mayonnaise" for variant_type_id <uuid>. Keeping ID <uuid>, deleting {<uuid>}
NOTICE:  Found 1 duplicate(s) of option "Meaty Sauce" for variant_type_id <uuid>. Keeping ID <uuid>, deleting {<uuid>}
... (more deletion notices)
NOTICE:  Total duplicate variant options deleted: 30+
NOTICE:  ================================================================
NOTICE:  CLEANUP MIGRATION 030 - Complete
NOTICE:  ================================================================
NOTICE:  Remaining duplicate variant option groups: 0
NOTICE:  SUCCESS: All duplicate variant options have been cleaned up!
NOTICE:  ================================================================
```

## Verification Queries

### Check for Remaining Duplicates
```sql
SELECT 
  vt.menu_item_id,
  mb.name as menu_item_name,
  vt.variant_type_name,
  vo.option_name,
  COUNT(*) as duplicate_count,
  ARRAY_AGG(vo.id) as option_ids,
  ARRAY_AGG(vo.price_modifier) as price_modifiers
FROM menu_item_variant_options vo
JOIN menu_item_variant_types vt ON vo.variant_type_id = vt.id
JOIN menu_items_base mb ON vt.menu_item_id = mb.id
GROUP BY vt.menu_item_id, mb.name, vt.variant_type_name, vo.option_name
HAVING COUNT(*) > 1
ORDER BY mb.name, vt.variant_type_name, vo.option_name;
```

**Expected Result:** 0 rows (no duplicates)

### Count Total Variant Options
```sql
SELECT COUNT(*) as total_variant_options
FROM menu_item_variant_options;
```

### Check Specific Menu Items
```sql
-- Check Siomai (should have 2 Spice Level options: Regular, Spicy)
SELECT 
  vt.variant_type_name,
  vo.option_name,
  vo.price_modifier
FROM menu_item_variant_options vo
JOIN menu_item_variant_types vt ON vo.variant_type_id = vt.id
JOIN menu_items_base mb ON vt.menu_item_id = mb.id
WHERE mb.name = 'Siomai'
ORDER BY vt.variant_type_name, vo.display_order;
```

**Expected:** 2 rows (Regular and Spicy, each appearing once)

```sql
-- Check Waffles (should have 5 Variety options, each appearing once)
SELECT 
  vt.variant_type_name,
  vo.option_name,
  vo.price_modifier
FROM menu_item_variant_options vo
JOIN menu_item_variant_types vt ON vo.variant_type_id = vt.id
JOIN menu_items_base mb ON vt.menu_item_id = mb.id
WHERE mb.name = 'Waffles'
ORDER BY vt.variant_type_name, vo.display_order;
```

**Expected:** 5 rows (Blueberry, Chocolate, Nutella, Plain, Strawberry - each once)

## Safety Features
- **Idempotent**: Safe to run multiple times
- **Keeps Most Recent**: Always preserves the newest record (highest ID)
- **Detailed Logging**: Shows exactly what's being deleted
- **Verification**: Checks for remaining duplicates after cleanup

## After Migration
1. Clear browser cache
2. Refresh the POS/Menu Management interface
3. Verify variant options display correctly (no duplicates)
4. Test adding items with variants to cart

## Technical Details
- Uses UUID data types (not INTEGER)
- Deletion pattern: GROUP BY variant_type_id + option_name
- Keeps: option_ids[1] (highest/newest)
- Deletes: option_ids[2:end]
- No cascade issues (variant options are leaf nodes in schema)
