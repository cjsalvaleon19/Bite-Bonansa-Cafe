# Menu Items Not Showing - Troubleshooting Guide

## Problem

Menu items are not showing up in the customer order page despite the migrations defining 85 menu items.

## Root Cause

The database migrations that seed menu items have not been executed on the Supabase database instance.

## Solution

### Step 1: Verify Database Connection

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Run this query to check if menu items exist:

```sql
SELECT COUNT(*) as total_items, 
       COUNT(CASE WHEN available = true AND is_sold_out = false THEN 1 END) as available_items
FROM menu_items_base;
```

**Expected Result**: 
- `total_items`: Should be around 85
- `available_items`: Should be around 85

**If you get 0 or very few items**: The migrations haven't been run.

### Step 2: Check Migration Status

Run this query to see which migrations have been applied:

```sql
SELECT * FROM _supabase_migrations 
ORDER BY version DESC 
LIMIT 20;
```

Look for these critical migrations:
- `012_Seed_Bite_Bonanza_Menu_Variants`
- `013_Update_Menu_Pricing_Complete`
- `014_Add_Hot_Iced_Drinks`
- `015_Add_Extended_Drinks_And_Frappe`
- `016_Update_Menu_Multiple_Addons_And_New_Items`
- `023_fix_cashier_interface_issues`
- `028_cleanup_duplicate_menu_items_and_variants`

### Step 3: Run Required Migrations

You need to run the migrations in order. Here's the sequence:

1. **Migration 012** - Creates variant system and seeds initial menu
2. **Migration 013** - Updates menu pricing
3. **Migration 014** - Adds Hot/Iced drinks
4. **Migration 015** - Adds Frappes and extended drinks
5. **Migration 016** - Adds fruit sodas and additional items
6. **Migration 023** - Creates menu_items view (maps to menu_items_base)
7. **Migration 028** - Cleans up duplicates

#### How to Run Migrations:

**Option A: Using Supabase CLI** (Recommended)
```bash
cd /path/to/Bite-Bonansa-Cafe
supabase db push
```

**Option B: Manual SQL Execution**
1. Go to Supabase Dashboard > SQL Editor
2. Copy the contents of each migration file from `supabase/migrations/`
3. Execute them in order (012, 013, 014, 015, 016, 023, 028)

### Step 4: Verify Menu Items Are Loaded

After running migrations, verify with:

```sql
-- Count items by category
SELECT category, COUNT(*) as item_count, 
       COUNT(CASE WHEN available = true AND is_sold_out = false THEN 1 END) as available_count
FROM menu_items_base
GROUP BY category
ORDER BY category;
```

**Expected Results:**
- Snacks & Bites: 4 items
- Noodles: 9 items
- Chicken: 3 items
- Rice & More: 7 items
- Milktea Series: 15 items
- Hot/Iced Drinks: 19 items
- Frappe Series: 14 items
- Fruit Soda & Lemonade: 13 items

### Step 5: Verify Variants Are Loaded

Check that variants exist for items:

```sql
SELECT 
    mb.name,
    mb.category,
    mb.has_variants,
    COUNT(DISTINCT mvt.id) as variant_types_count,
    COUNT(DISTINCT mvo.id) as variant_options_count
FROM menu_items_base mb
LEFT JOIN menu_item_variant_types mvt ON mvt.menu_item_id = mb.id
LEFT JOIN menu_item_variant_options mvo ON mvo.variant_type_id = mvt.id
WHERE mb.available = true
GROUP BY mb.id, mb.name, mb.category, mb.has_variants
ORDER BY mb.category, mb.name
LIMIT 20;
```

Items with `has_variants = true` should have at least 1 variant type and multiple variant options.

### Step 6: Test Customer Order Page

1. Navigate to `/customer/order`
2. You should see 85 menu items organized by category
3. Items with variants should show "Select Options" button
4. Clicking on an item should show the customization dialog with varieties, sizes, and add-ons

## Quick Fix: Re-Seed Database

If migrations are corrupted or incomplete, you can re-seed the database:

```sql
-- WARNING: This will delete all existing menu items and variants
-- Backup your data first if needed

-- 1. Clear existing menu data
TRUNCATE TABLE menu_item_variant_options CASCADE;
TRUNCATE TABLE menu_item_variant_types CASCADE;
TRUNCATE TABLE menu_items_base CASCADE;

-- 2. Then run migrations 012, 013, 014, 015, 016 in order
```

## Verification Checklist

- [ ] Database connection is working
- [ ] Migration 012 has been run (variant system created)
- [ ] Migration 013 has been run (menu items with updated prices)
- [ ] Migration 014 has been run (Hot/Iced drinks added)
- [ ] Migration 015 has been run (Frappes added)
- [ ] Migration 016 has been run (Fruit sodas added)
- [ ] Migration 023 has been run (menu_items view created)
- [ ] Migration 028 has been run (duplicates cleaned up)
- [ ] Query `SELECT COUNT(*) FROM menu_items WHERE available = true AND is_sold_out = false` returns ~85
- [ ] Customer order page shows menu items
- [ ] Items with variants show "Select Options" button
- [ ] Variant selection dialog works correctly

## Common Issues

### Issue: "menu_items table not found"
**Solution**: Run migration 023 which creates the menu_items view

### Issue: "menu_items shows 0 rows"
**Solution**: Run migrations 012-016 to seed the menu items

### Issue: "Items show but no variants"
**Solution**: 
1. Verify `has_variants` flag is set correctly
2. Check that variant types and options exist for the item
3. Run migration 012 again if variant data is missing

### Issue: "Duplicate items showing"
**Solution**: Run migration 028 to clean up duplicates

## File Reference

See `MENU_ITEMS_REFERENCE.md` for a complete list of all menu items that should exist in the database.
