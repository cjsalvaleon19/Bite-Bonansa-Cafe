# Hot/Iced Drinks Menu Guide

## Overview
This guide documents the Hot/Iced Drinks category addition (`014_Add_Hot_Iced_Drinks.sql`) that adds 11 specialty coffee and drink items with hot/iced variants and add-ons.

## Menu Items (11 total)

### Pricing Tier 1: ₱74-₱84
1. **Americano**
   - 12oz Hot: ₱74
   - 16oz Iced: ₱74
   - 22oz Iced: ₱84
   - Add-ons: Extra Shot (+₱15)

### Pricing Tier 2: ₱99-₱119
2. **Spanish Latte**
   - 12oz Hot: ₱99
   - 16oz Iced: ₱104
   - 22oz Iced: ₱119
   - Add-ons: Extra Shot, Coffee Jelly, Pearls, Cream Cheese (+₱15 each)

3. **Cafe Latte**
   - 12oz Hot: ₱99
   - 16oz Iced: ₱104
   - 22oz Iced: ₱119
   - Add-ons: Extra Shot, Coffee Jelly, Pearls, Cream Cheese (+₱15 each)

### Pricing Tier 3: ₱104-₱129
4. **Caramel Macchiato**
   - 12oz Hot: ₱104
   - 16oz Iced: ₱114
   - 22oz Iced: ₱129
   - Add-ons: Extra Shot, Coffee Jelly, Pearls, Cream Cheese (+₱15 each)

5. **Cafe Mocha**
   - 12oz Hot: ₱104
   - 16oz Iced: ₱114
   - 22oz Iced: ₱129
   - Add-ons: Extra Shot, Coffee Jelly, Pearls, Cream Cheese (+₱15 each)

6. **Mocha Latte**
   - 12oz Hot: ₱104
   - 16oz Iced: ₱114
   - 22oz Iced: ₱129
   - Add-ons: Extra Shot, Coffee Jelly, Pearls, Cream Cheese (+₱15 each)

7. **Caramel Mocha**
   - 12oz Hot: ₱104
   - 16oz Iced: ₱114
   - 22oz Iced: ₱129
   - Add-ons: Extra Shot, Coffee Jelly, Pearls, Cream Cheese (+₱15 each)

8. **Matcha Espresso**
   - 12oz Hot: ₱104
   - 16oz Iced: ₱114
   - 22oz Iced: ₱129
   - Add-ons: Extra Shot, Coffee Jelly, Pearls, Cream Cheese (+₱15 each)

9. **White Choco Matcha Latte**
   - 12oz Hot: ₱104
   - 16oz Iced: ₱114
   - 22oz Iced: ₱129
   - Add-ons: Extra Shot, Coffee Jelly, Pearls, Cream Cheese (+₱15 each)

10. **Dark Chocolate**
    - 12oz Hot: ₱104
    - 16oz Iced: ₱114
    - 22oz Iced: ₱129
    - Add-ons: Extra Shot, Coffee Jelly, Pearls, Cream Cheese (+₱15 each)

11. **Matcha Latte**
    - 12oz Hot: ₱104
    - 16oz Iced: ₱114
    - 22oz Iced: ₱129
    - Add-ons: Extra Shot, Coffee Jelly, Pearls, Cream Cheese (+₱15 each)

## Variant Structure

### Size & Type Variant
All drinks use a combined "Size & Type" variant that includes both the size and whether it's hot or iced:
- **12oz Hot** - Base price (varies by drink)
- **16oz Iced** - Base price + modifier
- **22oz Iced** - Base price + higher modifier

This approach was chosen because:
1. Not all size/variety combinations exist (e.g., no 16oz Hot or 22oz Hot)
2. Pricing varies by both size AND temperature
3. Simplifies customer selection in the UI

### Add-ons Variant (Optional)
All drinks support optional add-ons:
- **No Add Ons** - ₱0 (default option)
- **Extra Shot** - +₱15
- **Coffee Jelly** - +₱15 (not available for Americano)
- **Pearls** - +₱15 (not available for Americano)
- **Cream Cheese** - +₱15 (not available for Americano)

## Database Implementation

### Tables Used
- `menu_items_base` - Base drink items with `has_variants=true`
- `menu_item_variant_types` - Two variant types per drink: "Size & Type" and "Add Ons"
- `menu_item_variant_options` - Specific options with price modifiers

### Example: Cafe Latte Structure
```sql
menu_items_base:
  - name: "Cafe Latte"
  - base_price: 99.00
  - has_variants: true

menu_item_variant_types:
  - "Size & Type" (required, single-select)
  - "Add Ons" (optional, single-select)

menu_item_variant_options (Size & Type):
  - "12oz Hot" (+₱0)
  - "16oz Iced" (+₱5)
  - "22oz Iced" (+₱20)

menu_item_variant_options (Add Ons):
  - "No Add Ons" (+₱0)
  - "Extra Shot" (+₱15)
  - "Coffee Jelly" (+₱15)
  - "Pearls" (+₱15)
  - "Cream Cheese" (+₱15)
```

## How to Apply This Migration

### Option 1: Using Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy the contents of `supabase/migrations/014_Add_Hot_Iced_Drinks.sql`
4. Paste into the SQL Editor
5. Click "Run" to execute

### Option 2: Using Supabase CLI
```bash
supabase migration up
```

### Option 3: Using psql
```bash
psql -h <your-db-host> -U <your-db-user> -d <your-database> -f supabase/migrations/014_Add_Hot_Iced_Drinks.sql
```

## Important Notes

### Prerequisites
- This migration assumes migration 013 (or earlier) has been applied
- Requires existing tables: `menu_items_base`, `menu_item_variant_types`, `menu_item_variant_options`
- Does NOT delete existing menu items (additive only)

### Post-Migration Verification
1. Verify all 11 drinks are in the database:
   ```sql
   SELECT name, category, base_price FROM menu_items_base 
   WHERE category = 'Hot/Iced Drinks' 
   ORDER BY base_price, name;
   ```

2. Check variant types are correctly assigned:
   ```sql
   SELECT mb.name, vt.variant_type_name, vt.is_required
   FROM menu_items_base mb
   JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
   WHERE mb.category = 'Hot/Iced Drinks'
   ORDER BY mb.name, vt.display_order;
   ```

3. Verify variant options and pricing:
   ```sql
   SELECT mb.name, vt.variant_type_name, vo.option_name, vo.price_modifier
   FROM menu_items_base mb
   JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
   JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
   WHERE mb.category = 'Hot/Iced Drinks'
   ORDER BY mb.name, vt.display_order, vo.display_order;
   ```

4. Test in customer portal:
   - Verify drinks appear in the menu
   - Test variant selection modal opens correctly
   - Confirm price calculations include add-ons
   - Verify cart correctly handles variant selections

## Kitchen Department
All items in this category are assigned to the **Drinks** department for kitchen routing and order management.

## Complete Menu Summary

With this migration, the complete menu now includes:
- **Snacks & Bites**: 4 items
- **Noodles**: 9 items
- **Chicken**: 3 items
- **Rice & More**: 7 items
- **Milktea Series**: 16 items
- **Hot/Iced Drinks**: 11 items

**Total**: 50 menu items
