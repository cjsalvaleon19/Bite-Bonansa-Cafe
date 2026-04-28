# Migration 031: Fix Remaining Menu Variant Errors

## Overview
This migration fixes all remaining menu item variant errors identified in the system. It addresses 9 specific issues across multiple menu items including Fries, Spag Solo, Samyang, Chicken Burger, Chicken Meal, Footlong, Clubhouse, Waffles, and Frappe Series items.

## Migration File
`supabase/migrations/031_fix_remaining_menu_variant_errors.sql`

## Issues Fixed

### 1. Fries - Duplicate Barbeque Flavor
**Problem:** Two Barbeque flavor options exist for Fries  
**Solution:** Keep only one Barbeque flavor (the most recent one)  
**Expected Result:** Fries should have exactly 1 Barbeque flavor option

### 2. Spag Solo - Incorrect Add-Ons
**Problem:** Has Garlic Bread, Extra Cheese, and Meatballs add-ons  
**Solution:** Delete all add-ons except "Meaty Sauce"  
**Expected Result:** Spag Solo should only have "Meaty Sauce" add-on

### 3. Samyang Carbonara & Chicken - Incorrect Add-Ons
**Problem:** Has Extra Egg and Extra Cheese add-ons that should be removed  
**Solution:** Delete Extra Egg and Extra Cheese, keep Spam, Egg, and Cheese  
**Expected Result:** Samyang should have exactly 3 add-ons: Spam, Egg, Cheese

### 4. Chicken Burger - Incorrect Flavor
**Problem:** Has Korean BBQ flavor instead of Original  
**Solution:** Delete Korean BBQ flavor and add Original flavor  
**Expected Result:** Chicken Burger should have Original flavor and not have Korean BBQ

### 5. Chicken Meal - Should Not Exist
**Problem:** Chicken Meal menu item exists but should be deleted  
**Solution:** Delete entire Chicken Meal menu item including all variants  
**Expected Result:** No Chicken Meal items should exist in the database

### 6. Footlong - Too Many Add-Ons
**Problem:** Has multiple add-ons but should only have one  
**Solution:** Delete all add-ons except "No Vegies"  
**Expected Result:** Footlong should have exactly 1 add-on: No Vegies

### 7. Clubhouse - Too Many Add-Ons
**Problem:** Has multiple add-ons but should only have two  
**Solution:** Delete all add-ons except "No Vegies" and "Spam"  
**Expected Result:** Clubhouse should have exactly 2 add-ons: No Vegies and Spam

### 8. Waffles - Incorrect Varieties
**Problem:** Has Plain and Nutella varieties that should be replaced  
**Solution:** Delete Plain and Nutella, add Lotus Biscoff, Oreo, and Mallows  
**Expected Result:** Waffles should have Lotus Biscoff, Oreo, and Mallows (and no Plain or Nutella)

### 9. Frappe Series - Missing Variants
**Problem:** Frappe items don't have Size and Add Ons variants  
**Solution:** Add Size variant (16oz/22oz) and Add Ons variant (Coffee Jelly, Pearls, Cream Cheese) to all Frappe Series items  
**Expected Result:** All Frappe items should have Size and Add Ons variants

## How to Run

### Method 1: Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New Query"

3. **Run Migration**
   - Open `supabase/migrations/031_fix_remaining_menu_variant_errors.sql`
   - Copy ALL contents
   - Paste into SQL Editor
   - Click "Run" (or Ctrl+Enter / Cmd+Enter)

4. **Review Output**
   - Migration logs will show the starting state
   - Progress messages for each fix
   - Final verification summary
   - Look for "✓ All menu variant errors have been fixed successfully!"

### Method 2: Supabase CLI

```bash
# Make sure you're logged in
supabase login

# Link to your project (if not already linked)
supabase link --project-ref <your-project-ref>

# Run the migration
supabase db push
```

### Method 3: Direct PostgreSQL Connection

```bash
psql -h <your-db-host> -U postgres -d postgres -f supabase/migrations/031_fix_remaining_menu_variant_errors.sql
```

## Verification

After running the migration, you should see output similar to:

```
================================================================
MIGRATION 031 - Complete
================================================================

1. Fries Barbeque flavor count: 1 (should be 1)
2. Spag Solo add-ons count: 1 (should be 1 - Meaty Sauce)
3. Samyang add-ons count: 3 (should be 3 - Spam, Egg, Cheese)
4. Chicken Burger has Original: true (should be true)
4. Chicken Burger has Korean BBQ: false (should be false)
5. Chicken Meal count: 0 (should be 0)
6. Footlong add-ons count: 1 (should be 1 - No Vegies)
7. Clubhouse add-ons count: 2 (should be 2 - No Vegies, Spam)
8. Waffles has Plain: false (should be false)
8. Waffles has Nutella: false (should be false)
8. Waffles has Lotus Biscoff: true (should be true)
8. Waffles has Oreo: true (should be true)
8. Waffles has Mallows: true (should be true)
9. Total Frappe items: 11
9. Frappe items with Size variant: 11 (should equal total)
9. Frappe items with Add Ons variant: 11 (should equal total)

✓ All menu variant errors have been fixed successfully!
✓ Menu data is now clean and correct
================================================================
```

### Manual Verification Queries

You can run these queries to verify specific fixes:

```sql
-- 1. Verify Fries Barbeque count
SELECT COUNT(*) as barbeque_count
FROM menu_items_base mb
JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
WHERE mb.name = 'Fries' 
  AND vt.variant_type_name = 'Flavor' 
  AND vo.option_name = 'Barbeque';
-- Should return: 1

-- 2. Verify Spag Solo add-ons
SELECT vo.option_name
FROM menu_items_base mb
JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
WHERE mb.name = 'Spag Solo' 
  AND vt.variant_type_name ILIKE '%Add%'
ORDER BY vo.option_name;
-- Should return: Meaty Sauce only

-- 3. Verify Samyang add-ons
SELECT vo.option_name
FROM menu_items_base mb
JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
WHERE mb.name LIKE 'Samyang%Carbonara%Chicken%'
  AND vt.variant_type_name ILIKE '%Add%'
ORDER BY vo.option_name;
-- Should return: Cheese, Egg, Spam

-- 4. Verify Chicken Burger flavors
SELECT vo.option_name
FROM menu_items_base mb
JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
WHERE mb.name = 'Chicken Burger' 
  AND vt.variant_type_name = 'Flavor'
ORDER BY vo.option_name;
-- Should include: Original
-- Should NOT include: Korean BBQ

-- 5. Verify Chicken Meal deleted
SELECT COUNT(*) as chicken_meal_count
FROM menu_items_base
WHERE name = 'Chicken Meal';
-- Should return: 0

-- 6. Verify Footlong add-ons
SELECT vo.option_name
FROM menu_items_base mb
JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
WHERE mb.name = 'Footlong' 
  AND vt.variant_type_name ILIKE '%Add%'
ORDER BY vo.option_name;
-- Should return: No Vegies only

-- 7. Verify Clubhouse add-ons
SELECT vo.option_name
FROM menu_items_base mb
JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
WHERE mb.name = 'Clubhouse' 
  AND vt.variant_type_name ILIKE '%Add%'
ORDER BY vo.option_name;
-- Should return: No Vegies, Spam

-- 8. Verify Waffles varieties
SELECT vo.option_name
FROM menu_items_base mb
JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
WHERE mb.name = 'Waffles' 
  AND vt.variant_type_name = 'Variety'
ORDER BY vo.option_name;
-- Should include: Lotus Biscoff, Mallows, Oreo
-- Should NOT include: Nutella, Plain

-- 9. Verify Frappe Series variants
SELECT 
  mb.name,
  COUNT(DISTINCT CASE WHEN vt.variant_type_name = 'Size' THEN vt.id END) as has_size,
  COUNT(DISTINCT CASE WHEN vt.variant_type_name = 'Add Ons' THEN vt.id END) as has_addons
FROM menu_items_base mb
LEFT JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
WHERE mb.category = 'Frappe Series'
GROUP BY mb.name
ORDER BY mb.name;
-- All items should have: has_size = 1, has_addons = 1
```

## Testing in Application

After running the migration, test in the customer portal:

1. **Test Fries**
   - Go to Snacks & Bites category
   - Click on Fries
   - Verify only ONE Barbeque flavor appears

2. **Test Spag Solo**
   - Go to Noodles category
   - Click on Spag Solo
   - Verify only "Meaty Sauce" add-on appears

3. **Test Samyang Carbonara & Chicken**
   - Go to Noodles category
   - Click on Samyang Carbonara & Chicken
   - Verify only Spam, Egg, and Cheese add-ons appear

4. **Test Chicken Burger**
   - Go to Chicken category
   - Click on Chicken Burger
   - Verify "Original" flavor exists
   - Verify "Korean BBQ" flavor does NOT exist

5. **Test Chicken Meal Deletion**
   - Go to Chicken category
   - Verify "Chicken Meal" does NOT appear in the menu

6. **Test Footlong**
   - Go to Sandwiches category
   - Click on Footlong
   - Verify only "No Vegies" add-on appears

7. **Test Clubhouse**
   - Go to Sandwiches category
   - Click on Clubhouse
   - Verify only "No Vegies" and "Spam" add-ons appear

8. **Test Waffles**
   - Go to Breakfast category
   - Click on Waffles
   - Verify Lotus Biscoff, Oreo, and Mallows varieties appear
   - Verify Plain and Nutella varieties do NOT appear

9. **Test Frappe Series**
   - Go to Frappe Series category
   - Click on any Frappe item
   - Verify Size variant appears (16oz and 22oz options)
   - Verify Add Ons variant appears (Coffee Jelly, Pearls, Cream Cheese options)
   - Test selecting different combinations
   - Verify prices update correctly

## Rollback

If you need to rollback this migration, you would need to:

1. Re-add the deleted variant options manually
2. Re-create the Chicken Meal menu item with its variants
3. Remove the new Waffles varieties and add back Plain and Nutella
4. Remove Size and Add Ons variants from Frappe Series items

**Note:** This migration is designed to be run once. It's idempotent and safe to run multiple times (it will skip changes that are already applied).

## Migration Safety

- ✅ Idempotent: Safe to run multiple times
- ✅ Includes verification: Confirms all changes were applied correctly
- ✅ Uses transactions: Changes are atomic (all or nothing)
- ✅ Provides detailed logging: Shows exactly what changes were made
- ✅ Respects foreign keys: Deletes in correct order (options → types → items)

## Dependencies

This migration requires:
- Migration 012: Menu variant tables must exist
- Migration 027: Variant cleanup patterns
- Migration 029: Previous variant fixes
- Migration 030: Duplicate variant options cleanup

## Support

If you encounter any issues:

1. Check the migration output for error messages
2. Run the verification queries above
3. Check browser console for JavaScript errors
4. Clear browser cache and refresh
5. Verify you're logged in as a customer user

## Last Updated
2026-04-28
