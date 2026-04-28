# Category Capitalization Fix

## Issue Discovered

After fixing the duplicate categories issue, a **capitalization mismatch** was discovered that would prevent "Hot/Iced Drinks" items from appearing in their category tab.

## Problem

**Migration 024 and 025** were using:
- `'Hot/iced Drinks'` (lowercase "i" in "iced")

**Migrations 013-016** (menu item seeds) use:
- `'Hot/Iced Drinks'` (capital "I" in "Iced")

### Impact

When a user clicks the "Hot/iced Drinks" category tab:
```javascript
// Frontend filters items like this:
menuItems.filter(item => item.category === 'Hot/iced Drinks')
```

But menu items from migrations 014-016 have:
```sql
category = 'Hot/Iced Drinks'  -- Capital I
```

**Result**: Exact string matching fails, so NO items appear in the "Hot/iced Drinks" category tab! ❌

## Root Cause

Migrations 013-016 establish the **authoritative category names**:

### Migration 013 (`013_Update_Menu_Pricing_Complete.sql`)
```sql
-- SNACKS & BITES CATEGORY
VALUES ('Nachos', 'Snacks & Bites', 94.00, ...)
-- NOODLES CATEGORY  
VALUES ('Spag Solo', 'Noodles', 85.00, ...)
-- CHICKEN CATEGORY
VALUES ('Chicken Meals', 'Chicken', 79.00, ...)
-- RICE & MORE CATEGORY
VALUES ('Silog Meals', 'Rice & More', 109.00, ...)
-- MILKTEA SERIES CATEGORY
VALUES ('Brown Sugar Milktea', 'Milktea Series', 59.00, ...)
```

### Migration 014 (`014_Add_Hot_Iced_Drinks.sql`)
```sql
-- HOT/ICED DRINKS CATEGORY
VALUES ('Americano', 'Hot/Iced Drinks', 74.00, ...)  -- ← Capital "I"
VALUES ('Spanish Latte', 'Hot/Iced Drinks', 99.00, ...)
VALUES ('Cafe Latte', 'Hot/Iced Drinks', 99.00, ...)
```

### Migration 015 (`015_Add_Extended_Drinks_And_Frappe.sql`)
```sql
-- FRAPPE SERIES CATEGORY
VALUES ('Caramel Frappe', 'Frappe Series', 104.00, ...)
VALUES ('Java Chip Frappe', 'Frappe Series', 104.00, ...)
```

### Migration 016 (`016_Update_Menu_Multiple_Addons_And_New_Items.sql`)
```sql
-- FRUIT SODA & LEMONADE
VALUES ('Strawberry Soda', 'Fruit Soda & Lemonade', 54.00, ...)
VALUES ('Lemonade Juice', 'Fruit Soda & Lemonade', 54.00, ...)
```

## Solution

Updated migrations 024 and 025 to use **exact capitalization** from migrations 013-016:

```sql
-- Migration 024 - FIXED
INSERT INTO categories (name, sort_order)
VALUES 
  ('Snacks & Bites', 1),
  ('Noodles', 2),
  ('Chicken', 3),
  ('Rice & More', 4),
  ('Milktea Series', 5),
  ('Hot/Iced Drinks', 6),        -- ✓ Capital "I" (was lowercase)
  ('Frappe Series', 7),
  ('Fruit Soda & Lemonade', 8)
ON CONFLICT (name) DO NOTHING;
```

## The 8 Standard Categories (Exact Capitalization Required)

These are the **only** valid category names. Use them exactly as shown:

1. **`Snacks & Bites`** (Migration 013)
2. **`Noodles`** (Migration 013)
3. **`Chicken`** (Migration 013)
4. **`Rice & More`** (Migration 013)
5. **`Milktea Series`** (Migration 013)
6. **`Hot/Iced Drinks`** (Migration 014) ⚠️ **Capital "I" in "Iced"**
7. **`Frappe Series`** (Migration 015)
8. **`Fruit Soda & Lemonade`** (Migration 016)

## Verification

After applying the fix:

1. **Database Check**:
```sql
SELECT name FROM categories ORDER BY sort_order;
```
Should return:
```
Snacks & Bites
Noodles
Chicken
Rice & More
Milktea Series
Hot/Iced Drinks      ← Capital "I"
Frappe Series
Fruit Soda & Lemonade
```

2. **POS Interface Check**:
   - Click "Hot/Iced Drinks" tab
   - Should show items like: Americano, Spanish Latte, Cafe Latte, etc.
   - If empty, check category capitalization in database

3. **Query Test**:
```sql
-- Should return items from migration 014
SELECT name, category 
FROM menu_items_base 
WHERE category = 'Hot/Iced Drinks';  -- Capital "I"
```

## Why This Matters

Category filtering in both POS and customer interfaces uses **exact string comparison**:

```javascript
// Frontend code (POS and Customer Order pages)
const filteredItems = selectedCategory === 'All'
  ? menuItems
  : menuItems.filter(item => item.category === selectedCategory);
```

**Exact match required**:
- `'Hot/Iced Drinks' === 'Hot/Iced Drinks'` ✓ Match (items appear)
- `'Hot/iced Drinks' === 'Hot/Iced Drinks'` ❌ No match (items hidden)

## Best Practices Going Forward

1. **When Adding New Menu Items**:
   - Always use one of the 8 standard categories listed above
   - Copy-paste category names to avoid typos
   - Double-check capitalization matches migrations 013-016

2. **When Querying Categories**:
   - Use exact category names from the categories table
   - Don't normalize or change capitalization

3. **When Creating Migrations**:
   - Reference migrations 013-016 for authoritative category names
   - Test category filtering after applying migration

## Files Modified

- `supabase/migrations/024_create_categories_table.sql` - Fixed capitalization
- `supabase/migrations/025_cleanup_duplicate_categories.sql` - Fixed capitalization  
- `DUPLICATE_CATEGORIES_FIX.md` - Updated documentation
- `CASHIER_POS_FIX_SUMMARY.md` - Updated documentation

## Related Issues

- **Duplicate Categories Issue**: Migration 024 was extracting all categories from `menu_items_base`, causing 17+ tabs instead of 9
- **Capitalization Issue**: Migration 024/025 used "Hot/iced Drinks" instead of "Hot/Iced Drinks"

Both issues are now fixed in the same migrations (024 and 025).
