# Fix: Duplicate Categories in POS Interface

## Problem
The cashier POS interface was showing more than 9 category tabs (All + 8 categories). Instead of the expected 9 tabs, it was showing duplicate and subcategory tabs like "Beverages", "Salads", "Breakfast & Snacks", "Rice Meals", "Appetizers", "Japanese", "Burgers", "Pasta & Noodles", "Sandwiches", etc.

**Expected**: 9 tabs total
1. All (shows all items)
2. Snacks & Bites
3. Noodles
4. Chicken
5. Rice & More
6. Milktea Series
7. Hot/Iced Drinks
8. Frappe Series
9. Fruit Soda & Lemonade

**Actual**: 17+ tabs showing, including duplicates and subcategories

## Root Cause

Migration `024_create_categories_table.sql` was initially written to extract ALL unique categories from the `menu_items_base` table:

```sql
-- PROBLEMATIC CODE (original version)
INSERT INTO categories (name, sort_order)
SELECT DISTINCT 
  category,
  CASE category
    WHEN 'Snacks & Bites' THEN 1
    -- ... 
    ELSE 99  -- All non-standard categories got sort_order 99
  END as sort_order
FROM menu_items_base
WHERE category IS NOT NULL AND category != ''
```

This approach caused problems because:

1. **Multiple Migrations Created Different Categories**: Different migrations used different category names:
   - Migration 012 used: `Appetizers`, `Beverages`, `Burgers`, `Rice Meals`
   - Migration 013 updated items to use: `Snacks & Bites`, `Noodles`, `Chicken`, `Rice & More`, etc.
   - Some items were never updated and still had old category names

2. **All Categories Were Extracted**: The `SELECT DISTINCT category FROM menu_items_base` extracted EVERY category value, including:
   - Old/outdated categories (Appetizers, Beverages)
   - Subcategories (Breakfast & Snacks, Salads)
   - Granular categories (Japanese, Burgers, Pasta & Noodles)
   - Standard categories (Snacks & Bites, Noodles, etc.)

3. **All Were Displayed**: The frontend displayed all rows from the `categories` table, showing both standard AND non-standard categories.

## Solution

### Fix Migration 024
Changed the migration to explicitly insert only the 8 standard categories instead of extracting from `menu_items_base`:

```sql
-- FIXED CODE
INSERT INTO categories (name, sort_order)
VALUES 
  ('Snacks & Bites', 1),
  ('Noodles', 2),
  ('Chicken', 3),
  ('Rice & More', 4),
  ('Milktea Series', 5),
  ('Hot/iced Drinks', 6),
  ('Frappe Series', 7),
  ('Fruit Soda & Lemonade', 8)
ON CONFLICT (name) DO NOTHING;

-- Also added cleanup to remove non-standard categories
DELETE FROM categories 
WHERE name NOT IN (
  'Snacks & Bites', 'Noodles', 'Chicken', 'Rice & More',
  'Milktea Series', 'Hot/iced Drinks', 'Frappe Series', 'Fruit Soda & Lemonade'
);
```

### New Migration 025
Created a cleanup migration for users who already ran the old version of migration 024:

- Deletes all non-standard categories
- Ensures the 8 standard categories exist with correct sort_order
- Verifies the fix (should have exactly 8 categories)
- Safe to run multiple times (idempotent)

## How to Apply the Fix

### Option 1: Fresh Database Setup
If you haven't run migration 024 yet, simply run the updated migration:

```bash
# Migration 024 now only inserts 8 standard categories
npx supabase db push
```

### Option 2: Already Ran Old Migration 024
If you already ran the old version of migration 024 and have duplicate categories:

```bash
# Run the cleanup migration
npx supabase db push

# This will run migration 025 which:
# 1. Deletes all non-standard categories
# 2. Ensures 8 standard categories exist
# 3. Verifies the count
```

### Option 3: Manual Cleanup via SQL
You can also manually run the cleanup SQL in your Supabase SQL Editor:

```sql
-- Delete non-standard categories
DELETE FROM categories 
WHERE name NOT IN (
  'Snacks & Bites',
  'Noodles',
  'Chicken',
  'Rice & More',
  'Milktea Series',
  'Hot/Iced Drinks',
  'Frappe Series',
  'Fruit Soda & Lemonade'
);

-- Verify (should return 8)
SELECT COUNT(*) FROM categories;
```

## Verification

After applying the fix, verify:

1. **Database Check**:
```sql
SELECT name, sort_order FROM categories ORDER BY sort_order;
```
Should return exactly 8 rows with the standard categories.

2. **POS Interface Check**:
   - Open the cashier POS interface
   - Count the category tabs (should be 9 total: "All" + 8 categories)
   - Tabs should be: All, Snacks & Bites, Noodles, Chicken, Rice & More, Milktea Series, Hot/iced Drinks, Frappe Series, Fruit Soda & Lemonade

3. **Customer Interface Check**:
   - Open the customer order page
   - Verify same 9 tabs appear
   - Verify menu items load correctly for each category

## Related Files

- `supabase/migrations/024_create_categories_table.sql` - Fixed to only insert 8 categories
- `supabase/migrations/025_cleanup_duplicate_categories.sql` - Cleanup migration for existing databases
- `app/customer/order/page.tsx` - Customer interface (has fallback if categories table missing)
- `pages/cashier/pos.js` - Cashier POS interface (has fallback if categories table missing)

## Why Not Update Menu Items Instead?

You might ask: "Why not update all menu items to use the standard categories?"

**Answer**: That's a good approach for the long term, but has risks:
- Hundreds of menu items across multiple migrations
- Risk of breaking existing orders that reference old category names
- Risk of breaking reports/analytics that filter by category
- Migration 013 already attempted this but didn't catch all items

Instead, we:
1. **Control the categories table** to show only standard categories
2. **Keep menu items as-is** to avoid breaking existing data
3. **Map menu items to categories** - items can have any category value, but only standard categories are shown as tabs
4. **Future cleanup** can be done incrementally without affecting the UI

## Expected Behavior

### Menu Item Category Values
Menu items in `menu_items_base` may have various category values:
- Some items: `Snacks & Bites` ✓ (standard)
- Some items: `Appetizers` (old, maps to Snacks & Bites)
- Some items: `Beverages` (old, maps to Hot/iced Drinks)
- Etc.

### Categories Table (What's Shown as Tabs)
Only 8 standard categories:
1. Snacks & Bites
2. Noodles
3. Chicken
4. Rice & More
5. Milktea Series
6. Hot/Iced Drinks
7. Frappe Series
8. Fruit Soda & Lemonade

### Category Filtering Logic
When user clicks a category tab:
```javascript
// POS and Customer interfaces filter by exact match
menuItems.filter(item => item.category === selectedCategory)

// "All" tab shows all items (no filter)
```

**Important**: If a menu item has category "Appetizers", it won't show up when "Snacks & Bites" tab is selected. This is intentional - those items should appear in "All" tab only until their category is updated to a standard category.

## Preventive Measures for Future

1. **When Adding New Menu Items**:
   - Always use one of the 8 standard categories
   - Never create new category values

2. **When Updating Existing Menu Items**:
   - Update non-standard categories to standard ones
   - Verify items appear in correct category tabs

3. **Category Table Integrity**:
   - Migration 024 (updated) ensures only 8 categories
   - Migration 025 cleans up any duplicates
   - RLS policies allow staff to manage categories
   - Unique constraint prevents duplicate category names

## Testing Checklist

- [ ] Run migration 024 (updated version) or migration 025 (cleanup)
- [ ] Verify `SELECT COUNT(*) FROM categories` returns 8
- [ ] Open cashier POS interface
- [ ] Count category tabs - should be 9 total (All + 8 categories)
- [ ] Click each category tab and verify menu items load
- [ ] Open customer order page
- [ ] Verify same 9 tabs appear
- [ ] Add items to cart from different categories
- [ ] Place a test order to verify everything works

## Summary

**Problem**: Too many category tabs showing (17+ instead of 9)  
**Cause**: Migration 024 extracted all categories from database including old/duplicate ones  
**Fix**: Migration 024 now explicitly inserts only 8 standard categories  
**Cleanup**: Migration 025 removes non-standard categories from existing databases  
**Result**: Exactly 9 tabs (All + 8 standard categories)
