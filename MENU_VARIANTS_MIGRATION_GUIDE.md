# Menu Variants Migration Guide

## Overview
This guide explains how to add menu item variants (subcategories) to the Bite Bonansa Cafe database so customers can choose options like Size, Flavor, Add-ons, etc. when ordering.

## Problem
The menu list is not showing subcategories for customers to choose from. This means items like Milktea can't have size options, Fries can't have flavor choices, and other menu items can't have their required and optional variants.

## Solution
Run the provided migration scripts to populate the database with menu item variants.

## Migration Scripts

There are two migration scripts that need to be run in order:

### 1. `menu_variants_schema.sql` (Already exists)
This creates the database tables needed for variants:
- `menu_items_base` - Base menu items
- `menu_item_variant_types` - Types of variants (e.g., Size, Flavor, Add-ons)
- `menu_item_variant_options` - Specific options for each variant type

**Status**: ✅ This should already be applied to your database.

### 2. `complete_menu_variants_migration.sql` (NEW)
This populates all menu items with their variants according to the requirements:

#### Beverages
- **Milktea Series**: Size (required), Add-ons (optional)
- **Hot/Iced Drinks**: Size (required), Add-ons (optional)
- **Frappe Series**: Size (required), Add-ons (optional)
- **Fruit Soda & Lemonade**: Size (required), Add-ons (optional)

#### Appetizers
- **Nachos**: Dip Sauce (required), Add-ons (optional)
- **Fries**: Flavor (required), Add-ons (optional)
- **Siomai**: Style (required - Steamed/Fried), Spice Level (required - Regular/Spicy)
- **Calamares**: Sauce (required), Add-ons (optional)

#### Pasta & Noodles
- **Spag Solo**: Add-ons (optional)
- **Spag & Chicken**: Add-ons (optional)
- **Ramyeon**: Serving Size (required - Solo/Overload), Spice Level (required), Add-ons (optional)
- **Samyang Carbonara**: Serving Size (required - Solo/Overload), Spice Level (required), Add-ons (optional)
- **Samyang Carbonara & Chicken**: Spice Level (required), Add-ons (optional)
- **Tteokbokki**: Serving Size (required - Solo/Overload), Spice Level (required), Add-ons (optional)

#### Chicken
- **Chicken Meal**: Flavor (required), Add-ons (optional)
- **Chicken Platter**: Flavor (required), Add-ons (optional)
- **Chicken Burger**: Flavor (required), Add-ons (optional)

#### Rice Meals
- **Silog**: Variety/Meat (required), Add-ons (optional)

#### Breakfast & Snacks
- **Waffles**: Variety (required)

#### Sandwiches
- **Clubhouse**: Add-ons (optional)
- **Footlong**: Spice Level (required - Regular/Spicy), Add-ons (optional, includes "No Veggies")

#### Items Without Variants
- **Spam Musubi**: Simple item, no variants
- **Sushi**: Simple item, no variants
- **Caesar Salad**: Simple item, no variants

## How to Run the Migration

### Option 1: Via Supabase Dashboard (Recommended)
1. Log in to your Supabase Dashboard
2. Navigate to the SQL Editor
3. Click "New Query"
4. Copy the entire contents of `complete_menu_variants_migration.sql`
5. Paste into the SQL Editor
6. Click "Run" or press `Ctrl+Enter`
7. Review the verification queries output to confirm all variants were created

### Option 2: Via Supabase CLI
```bash
# Make sure you're logged in to Supabase CLI
supabase login

# Link to your project (if not already linked)
supabase link --project-ref <your-project-ref>

# Run the migration
supabase db push --include-all < complete_menu_variants_migration.sql
```

### Option 3: Via psql (Direct Database Connection)
```bash
psql -h <your-supabase-db-host> -U postgres -d postgres -f complete_menu_variants_migration.sql
```

## Verification

After running the migration, verify the data was created correctly:

### Check Total Counts
```sql
SELECT 
  COUNT(*) as total_base_items,
  COUNT(CASE WHEN has_variants THEN 1 END) as items_with_variants
FROM menu_items_base;
```

Expected result:
- Total items: ~24 items
- Items with variants: ~21 items

### View All Items with Variant Counts
```sql
SELECT 
  mb.name,
  mb.category,
  mb.base_price,
  mb.has_variants,
  COUNT(DISTINCT vt.id) as variant_types_count,
  COUNT(vo.id) as total_options
FROM menu_items_base mb
LEFT JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
LEFT JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
GROUP BY mb.id, mb.name, mb.category, mb.base_price, mb.has_variants
ORDER BY mb.category, mb.name;
```

### View Full Variant Structure
```sql
SELECT 
  mb.name as item_name,
  mb.category,
  vt.variant_type_name,
  vt.is_required,
  vt.allow_multiple,
  vo.option_name,
  vo.price_modifier
FROM menu_items_base mb
JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
ORDER BY mb.name, vt.display_order, vo.display_order;
```

## Frontend Implementation

The frontend is already set up to handle variants:

### Components
- **VariantSelectionModal** (`components/VariantSelectionModal.js`): 
  - Displays variant options to users
  - Handles single and multiple selection
  - Validates required variants
  - Calculates prices with modifiers

### Customer Order Portal
- **Location**: `pages/customer/order-portal.js`
- **Functionality**:
  - Fetches menu items from `menu_items_base` table
  - Includes variant types and options in the query
  - Opens VariantSelectionModal when item with variants is clicked
  - Adds items with selected variants to cart

### Database Query
The order portal fetches menu items with this query:
```javascript
const { data: baseItems } = await supabase
  .from('menu_items_base')
  .select(`
    *,
    variant_types:menu_item_variant_types(
      *,
      options:menu_item_variant_options(*)
    )
  `)
  .eq('available', true)
  .order('category', { ascending: true })
  .order('name', { ascending: true });
```

## Testing

After running the migration, test the following:

1. **Navigate to Order Portal**: Go to `/customer/order-portal` as a customer
2. **Click on items with variants**: Click on items like "Milktea", "Fries", "Chicken Meal", etc.
3. **Verify variant modal opens**: The VariantSelectionModal should appear
4. **Check required variants**: Required variants should have a red asterisk (*)
5. **Test validation**: Try to add without selecting required variants (should be disabled)
6. **Test multiple selection**: Items like "Add-ons" should allow selecting multiple options
7. **Check price calculation**: Price should update based on selected variants with price modifiers
8. **Add to cart**: Verify items are added with correct variants and prices

## Rollback

If you need to rollback the migration:

```sql
-- Delete all variant options
DELETE FROM menu_item_variant_options;

-- Delete all variant types
DELETE FROM menu_item_variant_types;

-- Delete all base menu items
DELETE FROM menu_items_base;
```

**Warning**: This will delete all menu item data. Only use this if you need to start fresh.

## Troubleshooting

### Issue: "table menu_items_base does not exist"
**Solution**: Run `menu_variants_schema.sql` first to create the tables.

### Issue: "duplicate key value violates unique constraint"
**Solution**: The migration uses `ON CONFLICT DO NOTHING` to prevent duplicates. This is safe to ignore.

### Issue: Variants not showing in the UI
**Solutions**:
1. Check that `has_variants` is `true` for the item in `menu_items_base`
2. Verify variant types and options exist in the database
3. Check browser console for any JavaScript errors
4. Verify the Supabase query in `order-portal.js` includes variant data

### Issue: Prices not calculating correctly
**Solution**: Check that `price_modifier` values are set correctly in `menu_item_variant_options`

## Additional Notes

- The migration script is idempotent (can be run multiple times safely) thanks to `ON CONFLICT DO NOTHING`
- All price modifiers are in PHP (₱)
- Variant options can be enabled/disabled by updating the `available` field
- Display order can be adjusted using the `display_order` field in variant types and options

## Support

For issues or questions, please contact the development team or create an issue in the repository.
