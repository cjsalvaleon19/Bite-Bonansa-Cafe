# Menu Update Guide - Multiple Add-ons & New Items

## Overview

This guide covers the menu update that enables customers to select **multiple add-ons** and adds **18 new menu items** (7 Frappe Series + 11 Fruit Soda & Lemonade items).

## What's Changed

### 1. Multiple Add-ons Selection ✨ **NEW FEATURE**

Customers can now select **multiple add-ons** for their items instead of being limited to one.

**Example:**
- **Before:** Choose Coffee Jelly **OR** Pearls **OR** Cream Cheese
- **After:** Choose Coffee Jelly **AND** Pearls **AND** Cream Cheese (or any combination)

**Benefits:**
- More customization options for customers
- Higher average order value
- Better customer satisfaction

### 2. "No Add Ons" Removed

The "No Add Ons" option has been removed from all menu items. If customers don't want add-ons, they simply don't select any.

### 3. Silog Meals - Extra Rice Add-on

Silog Meals now include an "Extra Rice" add-on option (₱10).

**Add-ons available for Silog Meals:**
- Extra Rice (₱10)

### 4. Nachos - No Add-ons

Nachos no longer have an add-ons section. Only the sauce selection remains.

### 5. New Frappe Series Items (7 items)

| Item Name | 16oz Price | 22oz Price | Add-ons Available |
|-----------|-----------|-----------|-------------------|
| Red Velvet Frappe | ₱119 | ₱134 | Coffee Jelly, Pearls, Cream Cheese (₱15 each) |
| Ube Taro Frappe | ₱119 | ₱134 | Coffee Jelly, Pearls, Cream Cheese (₱15 each) |
| Dark Chocolate Frappe | ₱124 | ₱139 | Coffee Jelly, Pearls, Cream Cheese (₱15 each) |
| Mocha Frappe | ₱124 | ₱139 | Coffee Jelly, Pearls, Cream Cheese (₱15 each) |
| Mocha Latte Frappe | ₱124 | ₱139 | Coffee Jelly, Pearls, Cream Cheese (₱15 each) |
| Lotus Biscoff Frappe | ₱134 | ₱149 | Coffee Jelly, Pearls, Cream Cheese (₱15 each) |
| Mango Graham Frappe | ₱134 | ₱149 | Pearls, Cream Cheese (₱15 each) |

**Note:** All frappes have only 16oz and 22oz sizes (no hot option)

### 6. New Fruit Soda & Lemonade Items (11 items)

| Item Name | 16oz Price | 22oz Price | Add-ons |
|-----------|-----------|-----------|---------|
| Strawberry Soda | ₱54 | ₱69 | None |
| Green Apple Soda | ₱54 | ₱69 | None |
| Blue Lemonade Soda | ₱54 | ₱69 | None |
| Lychee Soda | ₱54 | ₱69 | None |
| Blueberry Soda | ₱64 | ₱79 | None |
| Passion Fruit Soda | ₱74 | ₱89 | None |
| Lemonade Juice | ₱54 | ₱69 | None |
| Lemon Strawberry Juice | ₱64 | ₱79 | None |
| Lemon Blueberry Juice | ₱64 | ₱79 | None |
| Lemon Passion Fruit Juice | ₱84 | ₱99 | None |
| Lemon Yogurt Slush | ₱94 | ₱109 | None |

## Implementation

### Migration File

**File:** `supabase/migrations/016_Update_Menu_Multiple_Addons_And_New_Items.sql`

**What it does:**
1. Updates all "Add Ons" variant types to `allow_multiple = true`
2. Deletes all "No Add Ons" options
3. Adds "Extra Rice" to Silog Meals
4. Removes Add-ons from Nachos
5. Adds 7 new Frappe Series items with variants
6. Adds 11 new Fruit Soda & Lemonade items with variants

### How to Apply

#### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Open `supabase/migrations/016_Update_Menu_Multiple_Addons_And_New_Items.sql`
4. Copy all contents
5. Paste into SQL Editor
6. Click "Run"
7. Wait for success message

#### Option 2: Supabase CLI

```bash
supabase db push
```

### Verification

Run this SQL to verify the migration:

```sql
-- 1. Check Add-ons allow multiple
SELECT COUNT(*) 
FROM menu_item_variant_types
WHERE variant_type_name = 'Add Ons' AND allow_multiple = true;
-- Should return a positive number

-- 2. Check "No Add Ons" removed
SELECT COUNT(*) 
FROM menu_item_variant_options
WHERE option_name = 'No Add Ons';
-- Should return 0

-- 3. Check Extra Rice for Silog Meals
SELECT mb.name, vo.option_name, vo.price_modifier
FROM menu_item_variant_options vo
JOIN menu_item_variant_types vt ON vo.variant_type_id = vt.id
JOIN menu_items_base mb ON vt.menu_item_id = mb.id
WHERE mb.name = 'Silog Meals' AND vo.option_name = 'Extra Rice';
-- Should return 1 row

-- 4. Check new Frappe items
SELECT name, base_price
FROM menu_items_base
WHERE category = 'Frappe Series'
ORDER BY name;
-- Should show all Frappe items

-- 5. Check new Fruit Soda items
SELECT name, base_price
FROM menu_items_base
WHERE category = 'Fruit Soda & Lemonade'
ORDER BY name;
-- Should show all Fruit Soda items
```

Or run the comprehensive test script:

```bash
psql -h <your-db-host> -U postgres -d postgres -f test_migration_016.sql
```

## UI Changes

### Variant Selection Modal

The variant selection modal now shows:
- **(Select multiple)** hint for Add Ons variant types
- Multiple options can be selected by clicking
- Selected options are highlighted
- Price updates dynamically as add-ons are selected

**Example:**
```
Add Ons (Select multiple)
☑ Coffee Jelly  +₱15.00
☑ Pearls        +₱15.00
☑ Cream Cheese  +₱15.00

Total: ₱134.00 + ₱15.00 + ₱15.00 + ₱15.00 = ₱179.00
```

### Cart Display

Cart items with multiple add-ons show all selected options:

**Example:**
```
Red Velvet Frappe (22oz)
Add Ons: Coffee Jelly, Pearls, Cream Cheese
₱179.00 × 1 = ₱179.00
```

## User Experience

### Customer Flow

1. **Browse Menu**
   - New Frappe Series items visible
   - New Fruit Soda items visible

2. **Select Item**
   - Click on any item with add-ons
   - Variant selection modal opens

3. **Choose Size** (if applicable)
   - Select 16oz or 22oz

4. **Select Add-ons** (if available)
   - Multiple add-ons can be selected
   - Each add-on shows price modifier
   - Total price updates automatically

5. **Add to Cart**
   - All selections shown in cart
   - Can proceed to checkout

## Testing Checklist

- [ ] Multiple add-ons can be selected
- [ ] "No Add Ons" option is gone
- [ ] Extra Rice appears for Silog Meals
- [ ] Nachos has no add-ons section
- [ ] All 7 new Frappe items appear
- [ ] All 11 new Fruit Soda items appear
- [ ] Prices calculate correctly with multiple add-ons
- [ ] Cart displays all selected add-ons
- [ ] Checkout works with multiple add-ons
- [ ] Orders save with correct add-ons

## Troubleshooting

### Add-ons still single selection

**Cause:** Migration not applied or browser cache

**Solution:**
1. Verify migration ran successfully
2. Clear browser cache
3. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### "No Add Ons" still appears

**Cause:** Migration not applied or old data cached

**Solution:**
1. Run verification queries
2. Check migration completed successfully
3. Clear browser cache

### New items not showing

**Cause:** Migration not applied

**Solution:**
1. Apply migration 016
2. Check Supabase logs for errors
3. Verify items exist in database

### Multiple add-ons prices incorrect

**Cause:** Frontend calculation issue

**Solution:**
1. Check `VariantSelectionModal.js` calculates correctly
2. Verify all add-on price modifiers in database
3. Test with browser console open for errors

## Support

For issues:
1. Check Supabase logs
2. Review migration file
3. Run verification queries
4. Check browser console for errors

For questions, refer to:
- `supabase/migrations/README.md`
- `test_migration_016.sql`
- `components/VariantSelectionModal.js`

---

**Migration Created:** 2026-04-24  
**Total Menu Items After Migration:** 80  
**New Features:** Multiple add-ons selection, 18 new menu items
