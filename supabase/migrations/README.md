# Supabase Migrations

This directory contains SQL migration files for the Bite Bonanza Cafe database.

## Available Migrations

### 012_Seed_Bite_Bonanza_Menu_Variants.sql
**Purpose:** Create menu variants schema and seed all menu items with subcategories

**What it does:**
- Creates `menu_items_base`, `menu_item_variant_types`, and `menu_item_variant_options` tables
- Sets up Row Level Security (RLS) policies
- Seeds 24 menu items with complete variant configurations

**Menu items included:**
- **Beverages** (4): Milktea, Hot/Iced Drinks, Frappe, Fruit Soda & Lemonade
- **Appetizers** (4): Nachos, Fries, Siomai, Calamares  
- **Pasta & Noodles** (6): Spag Solo, Spag & Chicken, Ramyeon, Samyang Carbonara, Samyang Carbonara & Chicken, Tteokbokki
- **Chicken** (3): Chicken Meal, Chicken Platter, Chicken Burger
- **Rice Meals** (1): Silog
- **Breakfast** (1): Waffles
- **Sandwiches** (2): Clubhouse, Footlong
- **Simple Items** (3): Spam Musubi, Sushi, Caesar Salad

### 013_Update_Menu_Pricing_Complete.sql
**Purpose:** Update menu pricing with complete variant system

**What it does:**
- Updates pricing for all existing menu items
- Adds new items with updated pricing structure
- Includes all variants: sizes, varieties, spice levels, flavors, sauces, add-ons

### 014_Add_Hot_Iced_Drinks.sql
**Purpose:** Add Hot/Iced drinks category expansion

**What it does:**
- Adds additional Hot/Iced drinks variations
- Includes size variants (12oz Hot, 16oz Iced, 22oz Iced)
- Adds add-ons options (Extra Shot, Coffee Jelly, Pearls, Cream Cheese)

### 015_Add_Extended_Drinks_And_Frappe.sql
**Purpose:** Add extended drinks and initial Frappe Series

**What it does:**
- Adds 8 additional hot/iced drinks (Strawberry Latte, Blueberry Latte, Ube Taro Latte, etc.)
- Adds 4 initial Frappe Series items (Caramel Macchiato, Cookies & Cream, Matcha, Strawberry)
- All frappes have 16oz/22oz sizes only (no hot option)
- Add-ons: Coffee Jelly, Pearls, Cream Cheese

### 016_Update_Menu_Multiple_Addons_And_New_Items.sql
**Purpose:** Enable multiple add-ons selection and add new menu items

**What it does:**
- Updates all "Add Ons" variant types to allow multiple selection (`allow_multiple = true`)
- Removes "No Add Ons" option from all menu items
- Adds "Extra Rice" add-on (₱10) to Silog Meals
- Removes Add-ons from Nachos
- Adds 7 new Frappe Series items:
  - Red Velvet Frappe, Ube Taro Frappe (₱119-₱134)
  - Dark Chocolate Frappe, Mocha Frappe, Mocha Latte Frappe (₱124-₱139)
  - Lotus Biscoff Frappe, Mango Graham Frappe (₱134-₱149)
- Adds 11 new Fruit Soda & Lemonade items (no add-ons):
  - Strawberry Soda, Green Apple Soda, Blue Lemonade Soda, Lychee Soda (₱54-₱69)
  - Blueberry Soda (₱64-₱79)
  - Passion Fruit Soda (₱74-₱89)
  - Lemonade Juice, Lemon Strawberry Juice, Lemon Blueberry Juice (₱54-₱79)
  - Lemon Passion Fruit Juice (₱84-₱99)
  - Lemon Yogurt Slush (₱94-₱109)

**Total items after migration:** 80 menu items

### 017_order_number_4digit_daily.sql
**Purpose:** Implement 4-digit daily order numbering system

### 018_create_notifications_system.sql
**Purpose:** Create notifications system for order updates

### 020_cashier_interface_tables.sql
**Purpose:** Create tables for cashier interface

### 021_add_missing_orders_columns.sql
**Purpose:** Add missing columns to orders table

### 022_cashier_settings.sql
**Purpose:** Add cashier settings table

### 023_fix_cashier_interface_issues.sql
**Purpose:** Fix cashier interface issues

### 024_create_categories_table.sql
**Purpose:** Create categories table for menu organization

### 025_cleanup_duplicate_categories.sql
**Purpose:** Clean up duplicate category entries

### 026_enable_has_variants_flag.sql
**Purpose:** Enable has_variants flag and create summary view

### 027_cleanup_invalid_variant_options.sql
**Purpose:** Clean up invalid variant options (available=false)

### 028_cleanup_duplicate_menu_items_and_variants.sql
**Purpose:** Clean up duplicate menu items and variants

### 029_fix_variant_duplicates_and_add_missing_variants.sql
**Purpose:** Fix duplicate variant types and add missing variants
- Removes duplicate Chicken Platter "Flavor" variant types
- Deletes duplicate "Chicken Meal" entries
- Ensures Chicken Burger has exactly 8 flavors
- Adds size variant (16oz/22oz) for Fruit Soda & Lemonade items

### 030_cleanup_duplicate_variant_options.sql
**Purpose:** Clean up duplicate variant options (same option_name for same variant_type_id)

### 031_fix_remaining_menu_variant_errors.sql
**Purpose:** Fix remaining menu item variant errors
- Fixes Fries: Remove duplicate Barbeque flavor
- Fixes Spag Solo: Keep only "Meaty Sauce" add-on
- Fixes Samyang Carbonara & Chicken: Keep only Spam, Egg, Cheese add-ons
- Fixes Chicken Burger: Replace Korean BBQ with Original flavor
- Deletes Chicken Meal menu item entirely
- Fixes Footlong: Keep only "No Vegies" add-on
- Fixes Clubhouse: Keep only "No Vegies" and "Spam" add-ons
- Fixes Waffles: Replace Plain/Nutella with Lotus Biscoff, Oreo, Mallows
- Adds Size and Add Ons variants to all Frappe Series items

---

## How to Run Migrations

### Method 1: Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New Query"

3. **Run Migration**
   - Open the migration file you want to run (e.g., `supabase/migrations/016_Update_Menu_Multiple_Addons_And_New_Items.sql`)
   - Copy ALL contents
   - Paste into SQL Editor
   - Click "Run" (or Ctrl+Enter / Cmd+Enter)

4. **Wait for Completion**
   - Migration should complete in a few seconds
   - Check for success messages

**Note:** Run migrations in order (012 → 013 → 014 → 015 → 016) if starting fresh.

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
psql -h <your-db-host> -U postgres -d postgres -f supabase/migrations/012_Seed_Bite_Bonanza_Menu_Variants.sql
```

---

## Verification

After running migration 016, verify it worked:

```sql
-- Check total items created
SELECT COUNT(*) as total_items,
       COUNT(CASE WHEN has_variants THEN 1 END) as items_with_variants
FROM menu_items_base;
```

**Expected Results:**
- Total items: 80
- Items with variants: ~75+

```sql
-- Verify multiple add-ons enabled
SELECT COUNT(*) as add_ons_with_multiple
FROM menu_item_variant_types
WHERE variant_type_name = 'Add Ons' AND allow_multiple = true;

-- Verify "No Add Ons" removed
SELECT COUNT(*) as no_add_ons_count
FROM menu_item_variant_options
WHERE option_name = 'No Add Ons';
-- Should return 0

-- Verify Extra Rice for Silog Meals
SELECT mb.name, vo.option_name, vo.price_modifier
FROM menu_item_variant_options vo
JOIN menu_item_variant_types vt ON vo.variant_type_id = vt.id
JOIN menu_items_base mb ON vt.menu_item_id = mb.id
WHERE mb.name = 'Silog Meals' AND vo.option_name = 'Extra Rice';
```

```sql
-- View all items with variant details
SELECT 
  mb.name,
  mb.category,
  mb.has_variants,
  COUNT(DISTINCT vt.id) as variant_types,
  COUNT(vo.id) as total_options
FROM menu_items_base mb
LEFT JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
LEFT JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
GROUP BY mb.id, mb.name, mb.category, mb.has_variants
ORDER BY mb.category, mb.name;
```

**Run full test script:**
```bash
# Run the test script
psql -h <your-db-host> -U postgres -d postgres -f test_migration_016.sql
```

---

## Testing in Application

After migration:

1. **Navigate to Order Portal**
   - Go to: `/customer/order-portal`
   - Login as a customer

2. **Test Variant Selection**
   - Click on items like "Milktea", "Fries", "Chicken Meal"
   - Variant selection modal should appear
   - Required variants marked with red asterisk (*)
   - **Can now select multiple add-ons** (new feature!)
   - "No Add Ons" option should no longer appear

3. **Test New Frappe Items**
   - Browse "Frappe Series" category
   - New items should include: Red Velvet, Ube Taro, Dark Chocolate, Mocha, Mocha Latte, Lotus Biscoff, Mango Graham
   - Can select multiple add-ons: Coffee Jelly, Pearls, Cream Cheese

4. **Test New Fruit Soda Items**
   - Browse "Fruit Soda & Lemonade" category
   - New items should include various sodas and juices
   - These items should NOT have add-ons options

5. **Test Silog Meals**
   - Click on "Silog Meals"
   - Verify "Extra Rice" (₱10) appears as an add-on option
   - Can select multiple add-ons now

6. **Test Nachos**
   - Click on "Nachos"
   - Verify NO add-ons section appears
   - Only Sauce selection should be available

3. **Verify Functionality**
   - Select variants and add to cart
   - **Test selecting multiple add-ons** (e.g., Coffee Jelly + Pearls + Cream Cheese)
   - Check that all selected variants show in cart
   - Verify prices update correctly with all modifiers
   - Complete checkout with variant items

---

## Rollback

If you need to rollback the migration:

```sql
-- WARNING: This will delete all menu item data

-- Delete all variant options
DELETE FROM menu_item_variant_options;

-- Delete all variant types  
DELETE FROM menu_item_variant_types;

-- Delete all base menu items
DELETE FROM menu_items_base;

-- Drop tables (optional)
DROP TABLE IF EXISTS menu_item_variant_options CASCADE;
DROP TABLE IF EXISTS menu_item_variant_types CASCADE;
DROP TABLE IF EXISTS menu_items_base CASCADE;
```

---

## Troubleshooting

### Error: "table already exists"
**Solution:** This is fine. The migration uses `CREATE TABLE IF NOT EXISTS` which is safe.

### Error: "duplicate key value"
**Solution:** Items already exist. The migration uses `ON CONFLICT DO NOTHING` which is safe.

### Variants not showing in UI
**Check:**
1. Migration completed successfully (run verification queries)
2. Browser cache cleared
3. Logged in as customer role
4. No JavaScript errors in browser console

---

## Migration Details

**Latest Migration:** `031_fix_remaining_menu_variant_errors.sql`
**Total Migrations:** 17 (012 through 031, with some numbers skipped)
**Total Menu Items:** ~80 (after Chicken Meal deletion)
**Safe to rerun:** Yes (most migrations are idempotent)
**Dependencies:** Requires `users` table to exist for RLS policies

---

## Support

For additional help, see:
- `../QUICK_START.md` - Quick migration guide
- `../APPLY_MIGRATION_NOW.md` - Detailed step-by-step instructions
- `../MENU_VARIANTS_IMPLEMENTATION.md` - Technical implementation details
- `../scripts/README.md` - Alternative migration methods
- `../RUN_MIGRATION_031.md` - Detailed guide for migration 031

---

**Last Updated:** 2026-04-28
