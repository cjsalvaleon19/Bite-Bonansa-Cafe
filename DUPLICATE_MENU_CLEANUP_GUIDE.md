# Duplicate Menu Items and Variants Cleanup Guide

## Problem Statement

The database had several data integrity issues:

1. **Duplicate menu items with different prices**: Some menu items were inserted multiple times with both old and new prices, causing confusion in the UI
2. **Duplicate Chicken Platter variants**: The Chicken Platter had duplicate variant types and options from different migrations
3. **Old data not removed**: When prices were updated via new migrations, old entries were not deleted

## Root Cause

### Migration History
- **Migration 012**: Initial menu seeding with Chicken Platter at ₱249
  - Created "Flavor" variant type with 7 flavors
  - Created "Add-ons" variant type with 3 options (Extra Rice, Gravy, Coleslaw)
  
- **Migration 013**: Menu pricing update with Chicken Platter at ₱254 (new price)
  - Created "Flavor" variant type with 7 flavors (same flavors, different order)
  - Created "Add Ons" variant type with 2 options (No Add Ons, Rice)

### The Issue

Both migrations used `INSERT` statements without:
1. Deleting the old data first
2. Using `ON CONFLICT` properly to update existing records
3. Checking if the item already exists before inserting

This resulted in:
- **Two Chicken Platter entries** in `menu_items_base` (₱249 and ₱254)
- **Two sets of variants** for Chicken Platter
- **Duplicate variant options** showing in the UI

## Solution: Migration 028

### What It Does

Migration 028 (`028_cleanup_duplicate_menu_items_and_variants.sql`) performs the following cleanup:

#### 1. **Delete Old Chicken Platter Variants**
   - Deletes variant options for the old "Add-ons" type (Extra Rice, Gravy, Coleslaw)
   - Deletes variant options for the old ₱249 Chicken Platter
   - Deletes the old "Add-ons" variant type itself
   - Deletes all variant types associated with the ₱249 Chicken Platter

#### 2. **Delete Old Chicken Platter Menu Item**
   - Removes the ₱249 entry
   - Keeps only the ₱254 entry (current price)

#### 3. **Delete Other Duplicate Menu Items**
   - Identifies all menu items with duplicates (same name and category)
   - Keeps the newest entry based on:
     - Latest `created_at` timestamp
     - Highest `base_price` (assuming price updates)
     - Highest `id` as final tiebreaker
   - Deletes old duplicate entries and their associated variants

#### 4. **Cleanup Orphaned Data**
   - Removes any variant types without a parent menu item
   - Removes any variant options without a parent variant type

#### 5. **Verification**
   - Counts remaining duplicates (should be 0)
   - Verifies Chicken Platter has exactly 1 entry
   - Shows final Chicken Platter configuration
   - Displays variant types and options for verification

## What Data Is Kept

### Chicken Platter (₱254)
**Menu Item:**
- Name: "Chicken Platter"
- Price: ₱254.00
- Category: Chicken
- Has Variants: true

**Variant Types:**
1. **Flavor** (required, single selection)
   - Honey Butter
   - Soy Garlic
   - Sweet & Sour
   - Sweet & Spicy
   - Teriyaki
   - Buffalo
   - Barbecue

2. **Add Ons** (optional, single selection)
   - No Add Ons (₱0)
   - Rice (+₱15)

## What Data Is Deleted

### Chicken Platter (₱249) - OLD
**Menu Item:**
- The entire ₱249 menu item entry

**Old Variant Types:**
- "Add-ons" variant type (note: lowercase 'ons')

**Old Variant Options:**
- Extra Rice (+₱15)
- Gravy (+₱10)
- Coleslaw (+₱15)
- All "Flavor" options associated with the ₱249 entry

### Other Duplicate Menu Items
Any other menu items with duplicates will have their older entries removed based on:
- Older `created_at` timestamp
- Lower `base_price`
- Lower `id`

## How to Run the Migration

### Prerequisites
1. **Backup your database** before running any cleanup migration
2. Run the diagnostic script first to see what will be deleted:
   ```bash
   # Run find_all_duplicates.sql in Supabase SQL Editor
   ```

### Running the Migration

**Option 1: Via Supabase Dashboard**
1. Open Supabase Dashboard
2. Navigate to SQL Editor
3. Copy contents of `supabase/migrations/028_cleanup_duplicate_menu_items_and_variants.sql`
4. Click "Run"
5. Review the NOTICE messages in the output

**Option 2: Via Supabase CLI**
```bash
supabase db push
```

### Expected Output

```
CLEANUP MIGRATION 028 - Starting
================================================================
Duplicate menu item groups found: [number]
Chicken Platter entries found: [number]
================================================================
Deleting old Chicken Platter variant options...
Deleting old Chicken Platter variant types...
Deleting old Chicken Platter menu item...
Deleting other duplicate menu items...
================================================================
CLEANUP MIGRATION 028 - Complete
================================================================
Total available menu items: [number]
Remaining duplicate menu items: 0 (should be 0)
Chicken Platter entries: 1 (should be 1)
Chicken Platter variant types: 2
Chicken Platter variant options: 9
✓ All duplicates successfully removed
✓ Only updated menu items and variants remain
================================================================
```

## Verification

After running the migration, verify the cleanup:

### 1. Check for Duplicates
```sql
-- Should return 0 rows
SELECT name, category, COUNT(*) as count
FROM menu_items_base
WHERE available = true
GROUP BY name, category
HAVING COUNT(*) > 1;
```

### 2. Check Chicken Platter
```sql
-- Should return 1 row with price = 254.00
SELECT * FROM menu_items_base
WHERE name = 'Chicken Platter';
```

### 3. Check Chicken Platter Variants
```sql
-- Should show 2 variant types: "Flavor" and "Add Ons"
SELECT 
  mb.name,
  vt.variant_type_name,
  vo.option_name,
  vo.price_modifier
FROM menu_items_base mb
JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
WHERE mb.name = 'Chicken Platter'
ORDER BY vt.variant_type_name, vo.option_name;
```

Expected result:
- **Flavor**: 7 options (Barbecue, Buffalo, Honey Butter, Soy Garlic, Sweet & Sour, Sweet & Spicy, Teriyaki)
- **Add Ons**: 2 options (No Add Ons, Rice)

## Impact on Application

### Before Migration
- Menu items showed duplicate entries with different prices
- Chicken Platter showed duplicate variants in the customization modal
- Confusing user experience with old and new options

### After Migration
- Each menu item appears exactly once with the correct price
- Chicken Platter shows only the current variants
- Clean, consistent data across the application

### No Impact On
- **Order history**: Existing orders are not affected
- **Customer data**: No customer data is modified
- **UI code**: No code changes required
- **Other menu items**: Only duplicates are affected

## Best Practices Going Forward

To prevent duplicate data in the future:

### 1. Use UPSERT Instead of INSERT
```sql
-- GOOD: Use ON CONFLICT to update existing records
INSERT INTO menu_items_base (name, category, base_price, ...)
VALUES ('Item Name', 'Category', 100.00, ...)
ON CONFLICT (name, category) 
DO UPDATE SET base_price = EXCLUDED.base_price, ...;
```

### 2. Delete Before Insert
```sql
-- GOOD: Clean up old data first
DELETE FROM menu_items_base 
WHERE name = 'Item Name' AND category = 'Category';

INSERT INTO menu_items_base (name, category, base_price, ...)
VALUES ('Item Name', 'Category', 100.00, ...);
```

### 3. Check Before Insert
```sql
-- GOOD: Only insert if it doesn't exist
INSERT INTO menu_items_base (name, category, base_price, ...)
SELECT 'Item Name', 'Category', 100.00, ...
WHERE NOT EXISTS (
  SELECT 1 FROM menu_items_base 
  WHERE name = 'Item Name' AND category = 'Category'
);
```

### 4. Use Transactions
```sql
-- GOOD: Wrap related operations in a transaction
BEGIN;
  DELETE FROM menu_items_base WHERE name = 'Item Name';
  INSERT INTO menu_items_base (...) VALUES (...);
  -- Add variants
COMMIT;
```

## Related Files

- `supabase/migrations/028_cleanup_duplicate_menu_items_and_variants.sql` - The cleanup migration
- `find_all_duplicates.sql` - Diagnostic script to identify duplicates
- `audit_variant_data.sql` - General variant system audit script
- `supabase/migrations/012_Seed_Bite_Bonanza_Menu_Variants.sql` - Original seeding (old data)
- `supabase/migrations/013_Update_Menu_Pricing_Complete.sql` - Price updates (new data)

## Troubleshooting

### Issue: Migration fails with foreign key constraint error

**Solution:** The migration deletes data in the correct order (options → types → items), but if you encounter this:
1. Check if there are orders referencing the old menu items
2. Ensure no other tables have foreign keys to menu_items_base

### Issue: Chicken Platter still shows duplicates after migration

**Solution:**
1. Run the diagnostic script: `find_all_duplicates.sql`
2. Check if the migration ran successfully
3. Verify the ₱249 entry was deleted
4. Clear your browser cache (UI might be caching old data)

### Issue: Migration says duplicates remain

**Solution:**
1. Check which items are still duplicated using the verification queries
2. These might be items other than Chicken Platter
3. Investigate why the deletion criteria didn't catch them
4. May need to manually delete specific duplicates

## Summary

Migration 028 successfully:
- ✅ Removes all duplicate menu items
- ✅ Keeps only the newest/updated versions
- ✅ Cleans up Chicken Platter duplicate variants
- ✅ Removes old "Add-ons" variant type
- ✅ Keeps only "Add Ons" variant type with current options
- ✅ Maintains data integrity
- ✅ Does not affect order history
- ✅ Provides verification and audit trail

The menu system is now clean and consistent, showing only current prices and variants.
