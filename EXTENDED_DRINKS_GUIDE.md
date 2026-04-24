# Extended Drinks Menu Guide

## Overview
Migration 015 adds 8 additional Hot/Iced Drinks and introduces a new **Frappe Series** category with 4 frozen drinks.

## New Items Summary

### Additional Hot/Iced Drinks (8 items)

**Tier 1 - Fruit Flavors (₱99-₱119):**
1. **Strawberry Latte**
   - 12oz Hot: ₱99
   - 16oz Iced: ₱104
   - 22oz Iced: ₱119
   - Add-ons: Extra Shot, Coffee Jelly, Pearls, Cream Cheese (+₱15)

2. **Blueberry Latte**
   - 12oz Hot: ₱99
   - 16oz Iced: ₱104
   - 22oz Iced: ₱119
   - Add-ons: Extra Shot, Coffee Jelly, Pearls, Cream Cheese (+₱15)

3. **Ube Taro Latte**
   - 12oz Hot: ₱99
   - 16oz Iced: ₱104
   - 22oz Iced: ₱119
   - Add-ons: Extra Shot, Coffee Jelly, Pearls, Cream Cheese (+₱15)

4. **Passion Fruit Latte**
   - 12oz Hot: ₱99
   - 16oz Iced: ₱104
   - 22oz Iced: ₱119
   - Add-ons: Extra Shot, Coffee Jelly, Pearls, Cream Cheese (+₱15)

**Tier 2 - Biscoff Base (₱99-₱124):**
5. **Biscoff Latte**
   - 12oz Hot: ₱99
   - 16oz Iced: ₱109
   - 22oz Iced: ₱124
   - Add-ons: Extra Shot, Coffee Jelly, Pearls, Cream Cheese (+₱15)

**Tier 3 - Biscoff Premium (₱104-₱134):**
6. **Biscoff Matcha Latte**
   - 12oz Hot: ₱104
   - 16oz Iced: ₱119
   - 22oz Iced: ₱134
   - Add-ons: Extra Shot, Coffee Jelly, Pearls, Cream Cheese (+₱15)

7. **Biscoff Cafe Latte**
   - 12oz Hot: ₱104
   - 16oz Iced: ₱119
   - 22oz Iced: ₱134
   - Add-ons: Extra Shot, Coffee Jelly, Pearls, Cream Cheese (+₱15)

**Tier 4 - Cookie Base (₱104-₱129):**
8. **Oreo Latte**
   - 12oz Hot: ₱104
   - 16oz Iced: ₱114
   - 22oz Iced: ₱129
   - Add-ons: Extra Shot, Coffee Jelly, Pearls, Cream Cheese (+₱15)

### Frappe Series (4 items) - NEW CATEGORY

All frappes are **iced only** (no hot option) and come in 2 sizes: 16oz and 22oz.

**Premium Frappes (₱124-₱139):**
1. **Caramel Macchiato Frappe**
   - 16oz: ₱124
   - 22oz: ₱139
   - Add-ons: Coffee Jelly, Pearls, Cream Cheese (+₱15)

2. **Cookies & Cream Frappe**
   - 16oz: ₱124
   - 22oz: ₱139
   - Add-ons: Coffee Jelly, Pearls, Cream Cheese (+₱15)

3. **Matcha Frappe**
   - 16oz: ₱124
   - 22oz: ₱139
   - Add-ons: Coffee Jelly, Pearls, Cream Cheese (+₱15)

**Standard Frappe (₱119-₱134):**
4. **Strawberry Frappe**
   - 16oz: ₱119
   - 22oz: ₱134
   - Add-ons: Coffee Jelly, Pearls, Cream Cheese (+₱15)

## Key Implementation Details

### Hot/Iced Drinks Variant Structure
Uses same structure as migration 014:
- **"Size & Type"** combined variant (12oz Hot, 16oz Iced, 22oz Iced)
- **"Add Ons"** optional variant with "No Add Ons" default

### Frappe Series Variant Structure
Simplified structure (no temperature variant needed):
- **"Size"** variant only (16oz, 22oz)
- **"Add Ons"** optional variant (Coffee Jelly, Pearls, Cream Cheese)
- **No Extra Shot** option for frappes

## Database Tables

Same 3-table variant architecture:
```
menu_items_base
  └─ menu_item_variant_types
      └─ menu_item_variant_options
```

## Complete Menu Count

After migration 015:
- **Snacks & Bites**: 4 items
- **Noodles**: 9 items
- **Chicken**: 3 items
- **Rice & More**: 7 items
- **Milktea Series**: 16 items
- **Hot/Iced Drinks**: 19 items (11 from migration 014 + 8 new)
- **Frappe Series**: 4 items (NEW)

**Grand Total: 62 menu items**

## Migration Application

### Prerequisites
- Migrations 013 and 014 must be applied first
- Requires tables: `menu_items_base`, `menu_item_variant_types`, `menu_item_variant_options`

### Apply Migration

**Option 1: Supabase Dashboard**
1. Go to SQL Editor in Supabase Dashboard
2. Copy contents of `015_Add_Extended_Drinks_And_Frappe.sql`
3. Paste and run

**Option 2: Supabase CLI**
```bash
supabase migration up
```

**Option 3: psql**
```bash
psql -h <host> -U <user> -d <database> -f supabase/migrations/015_Add_Extended_Drinks_And_Frappe.sql
```

## Verification Queries

### Verify all new Hot/Iced Drinks
```sql
SELECT name, base_price, category 
FROM menu_items_base 
WHERE category = 'Hot/Iced Drinks' 
  AND name IN ('Strawberry Latte', 'Blueberry Latte', 'Ube Taro Latte', 
               'Biscoff Latte', 'Biscoff Matcha Latte', 'Biscoff Cafe Latte',
               'Passion Fruit Latte', 'Oreo Latte')
ORDER BY base_price, name;
```

### Verify Frappe Series category
```sql
SELECT name, base_price 
FROM menu_items_base 
WHERE category = 'Frappe Series' 
ORDER BY base_price DESC, name;
```

### Check variant structure for Frappes
```sql
SELECT mb.name, vt.variant_type_name, vo.option_name, vo.price_modifier
FROM menu_items_base mb
JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
WHERE mb.category = 'Frappe Series'
ORDER BY mb.name, vt.display_order, vo.display_order;
```

### Total menu items count
```sql
SELECT category, COUNT(*) as item_count
FROM menu_items_base
GROUP BY category
ORDER BY category;
```

## Pricing Summary

### Hot/Iced Drinks Price Ranges (19 total)
- Entry tier: ₱74-₱84 (Americano)
- Fruit lattes: ₱99-₱119 (Strawberry, Blueberry, Ube Taro, Passion Fruit, Spanish, Cafe)
- Standard tier: ₱104-₱129 (Caramel Macchiato, Mochas, Matcha, Dark Chocolate, Oreo)
- Biscoff tier: ₱99-₱134 (Biscoff, Biscoff Matcha, Biscoff Cafe)

### Frappe Series Price Ranges (4 total)
- Standard: ₱119-₱134 (Strawberry Frappe)
- Premium: ₱124-₱139 (Caramel Macchiato, Cookies & Cream, Matcha)

### Add-ons (consistent across all drinks)
- All add-ons: +₱15 each
- Hot/Iced: Extra Shot, Coffee Jelly, Pearls, Cream Cheese
- Frappes: Coffee Jelly, Pearls, Cream Cheese (no Extra Shot)

## Business Logic Notes

1. **Frappe Temperature**: All frappes are frozen/blended drinks - no hot variant exists
2. **Biscoff Premium Pricing**: Biscoff specialty drinks have higher price points
3. **Add-on Consistency**: All add-ons maintain ₱15 pricing for simplicity
4. **Size Increments**: 
   - Most drinks: 16oz (+₱5), 22oz (+₱15-20)
   - Biscoff variants: 16oz (+₱15), 22oz (+₱30)
5. **Kitchen Department**: All drinks route to "Drinks" department

## Migration Safety

- **Additive only** - does not delete existing items
- **No schema changes** - uses existing tables
- **Idempotent** - can be run multiple times safely (will error on duplicate but won't corrupt data)
- **Transaction safe** - entire migration runs in single transaction

## Troubleshooting

### If migration fails:
1. Check that migrations 013 and 014 were applied
2. Verify tables exist: `menu_items_base`, `menu_item_variant_types`, `menu_item_variant_options`
3. Check for duplicate item names (shouldn't happen with fresh DB)
4. Review Supabase logs for specific error

### If items don't appear in portal:
1. Verify `has_variants=true` flag is set
2. Check that variant_types exist for each item
3. Ensure `available=true` in menu_items_base
4. Clear browser cache and refresh portal
