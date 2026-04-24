# Variant Selection Fix Guide

## Problem Statement
Menu items with variants (add-ons, size, flavors, etc.) were not showing the variant selection modal when clicking "Add to Cart". Customers couldn't select their preferences before adding items to cart.

## Root Cause
The variant selection functionality was already implemented in the code:
- VariantSelectionModal component exists and is functional
- Database schema supports variants (menu_items_base, menu_item_variant_types, menu_item_variant_options)
- Frontend code checks for variants before adding to cart

However, the `has_variants` flag in the `menu_items_base` table was not set to `true` for items that have variant types defined.

## Solution

### 1. Database Fix
Run the SQL script `fix_has_variants_flag.sql` to ensure all items with variant types have `has_variants=true`:

```sql
UPDATE menu_items_base
SET has_variants = true
WHERE id IN (
  SELECT DISTINCT menu_item_id
  FROM menu_item_variant_types
)
AND (has_variants = false OR has_variants IS NULL);
```

### 2. Verify Migration Status
Check if menu items with variants have been properly migrated:

```sql
-- Check items with variants
SELECT 
  mb.name,
  mb.category,
  mb.has_variants,
  COUNT(DISTINCT vt.id) as variant_types,
  COUNT(vo.id) as total_options
FROM menu_items_base mb
LEFT JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
LEFT JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
GROUP BY mb.id
HAVING COUNT(DISTINCT vt.id) > 0
ORDER BY mb.category, mb.name;
```

### 3. If No Variants Exist
If the above query returns no results, run the complete migration script:
- `complete_menu_variants_migration.sql` - Creates all menu items with their variants

## How It Works

### Frontend Flow
1. User clicks "Add to Cart" on a menu item
2. `addToCart()` function checks if item has variants:
   ```javascript
   if (item.has_variants && item.variant_types && item.variant_types.length > 0) {
     setSelectedItem(item);
     setShowVariantModal(true);
   }
   ```
3. VariantSelectionModal opens, showing:
   - All variant types (Size, Flavor, Add-ons, etc.)
   - Options for each variant type
   - Price modifiers
   - Quantity selector
4. User selects required variants and optional add-ons
5. User clicks "Add to Cart" in modal
6. Item is added with variant details and final price

### Database Structure
- **menu_items_base**: Base menu items with `has_variants` flag
- **menu_item_variant_types**: Types of variants (Size, Flavor, Add-ons)
  - `is_required`: Must select before adding to cart
  - `allow_multiple`: Can select multiple options (for add-ons)
- **menu_item_variant_options**: Specific options with price modifiers

### Example Menu Items with Variants
Based on the screenshot and migration scripts:
- **Chicken Burger**: Flavor variants (Barbecue, Buffalo Wings, Honey Butter, etc.)
- **Chicken Meals**: 7 flavor variants available
- **Chicken Platter**: Flavor variants for sharing
- **Milktea**: Size (16oz, 22oz) + Add-ons (Pearls, Cream Cheese, etc.)
- **Fries**: Flavor variants (Cheese, Meaty Sauce, Sour Cream, Barbecue)
- **Silog**: Meat variants (Bangus, Corned Beef, Tocino, etc.)

## Testing
After applying the fix:
1. Navigate to Order Portal
2. Click "Add to Cart" on items with variants (e.g., Chicken Burger)
3. Variant selection modal should appear
4. Select required variants
5. Click "Add to Cart" in modal
6. Item should appear in cart with variant details and correct price

## Files Modified/Created
- `fix_has_variants_flag.sql` - SQL script to fix the has_variants flag
- `VARIANT_SELECTION_FIX.md` - This guide

## Files Already Implemented
- `components/VariantSelectionModal.js` - Variant selection UI
- `pages/customer/order-portal.js` - Integration with modal
- `menu_variants_schema.sql` - Database schema
- `complete_menu_variants_migration.sql` - Sample menu items with variants
