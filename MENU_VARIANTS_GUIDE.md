# Menu Item Variants Implementation Guide

## Overview
This guide explains how to implement menu item variants (varieties, add-ons, sizes, etc.) so that customers can choose subcategories before adding items to their cart.

## Problem
Currently, each variant of an item (e.g., "Fries - Cheese", "Fries - Meaty Sauce") is stored as a separate menu item. This creates:
1. Cluttered menu display
2. Difficult inventory management
3. Poor user experience

## Solution
Implement a variant system where:
1. Base items are displayed (e.g., "Fries")
2. When customer clicks "Add to Cart", a modal appears to select variants
3. Variants can be required or optional
4. Price modifiers can be applied to variants

## Database Schema

### Tables Created (menu_variants_schema.sql)

1. **menu_items_base** - Base menu items without variants
   - Stores: name, category, base_price, has_variants
   
2. **menu_item_variant_types** - Types of variations
   - Stores: variant_type_name, is_required, allow_multiple
   - Examples: "Flavor", "Size", "Add-ons"
   
3. **menu_item_variant_options** - Specific options for each type
   - Stores: option_name, price_modifier
   - Examples: "Cheese" (+₱0), "Large" (+₱20)

## Migration Steps

### Step 1: Run the Schema
Execute `menu_variants_schema.sql` in your Supabase SQL editor.

### Step 2: Migrate Existing Items

For items with variants (like Fries, Chicken Meals, Burgers):

```sql
-- Example: Migrate Fries items
-- 1. Create base item
INSERT INTO menu_items_base (name, category, base_price, has_variants, description, image_url)
VALUES ('Fries', 'Appetizers', 89.00, true, 'Crispy fries with your choice of flavor', NULL);

-- 2. Get the base item ID and create variant type
WITH fries_item AS (
  SELECT id FROM menu_items_base WHERE name = 'Fries' LIMIT 1
)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple, display_order)
SELECT id, 'Flavor', true, false, 1 FROM fries_item;

-- 3. Add flavor options
WITH flavor_type AS (
  SELECT vt.id 
  FROM menu_item_variant_types vt
  JOIN menu_items_base mb ON vt.menu_item_id = mb.id
  WHERE mb.name = 'Fries' AND vt.variant_type_name = 'Flavor'
  LIMIT 1
)
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier, display_order)
SELECT id, 'Cheese', 0, 1 FROM flavor_type
UNION ALL
SELECT id, 'Meaty Sauce', 0, 2 FROM flavor_type
UNION ALL
SELECT id, 'Sour Cream', 0, 3 FROM flavor_type
UNION ALL
SELECT id, 'Barbecue', 0, 4 FROM flavor_type;
```

### Step 3: Update Frontend

The order-portal.js needs to be updated to:
1. Fetch items from `menu_items_base` with their variants
2. Show variant selection modal when adding to cart
3. Include selected variants in cart items

## Items That Need Migration

Based on `menu_items_insert.sql`, these items should use variants:

### 1. Fries
- **Base Item**: Fries (₱89)
- **Variant Type**: Flavor (required)
- **Options**: Cheese, Meaty Sauce, Sour Cream, Barbecue

### 2. Siomai
- **Base Item**: Siomai (₱69)
- **Variant Type**: Style (required)
- **Options**: Steamed, Fried

### 3. Calamares
- **Base Item**: Calamares (₱89)
- **Variant Type**: Sauce (required)
- **Options**: Meaty Sauce, Sinamak, Mayonnaise

### 4. Chicken Meals
- **Base Item**: Chicken Meal (₱79)
- **Variant Type**: Flavor (required)
- **Options**: Barbecue, Buffalo Wings, Honey Butter, Sweet & Sour, Sweet & Spicy, Soy Garlic, Teriyaki

### 5. Chicken Platter
- **Base Item**: Chicken Platter (₱249)
- **Variant Type**: Flavor (required)
- **Options**: Barbecue, Buffalo Wings, Honey Butter, Sweet & Sour, Sweet & Spicy, Soy Garlic, Teriyaki

### 6. Chicken Burger
- **Base Item**: Chicken Burger (₱99)
- **Variant Type**: Flavor (required)
- **Options**: Barbecue, Buffalo Wings, Honey Butter, Sweet & Sour, Sweet & Spicy, Soy Garlic, Teriyaki, Original

### 7. Rice Meals (Silog)
- **Base Item**: Silog (₱109)
- **Variant Type**: Meat (required)
- **Options**: Bangus, Corned Beef, Tocino, Chicken, Tapa, Hotdog, Siomai, Luncheon

### 8. Pasta Combos (if sizes exist)
- Could add **Variant Type**: Size (Solo, Overload)
- With appropriate price modifiers

## Frontend Implementation

### Component: VariantSelectionModal

Create a new component `components/VariantSelectionModal.js`:

```jsx
import React, { useState } from 'react';

export default function VariantSelectionModal({ item, onConfirm, onCancel }) {
  const [selectedVariants, setSelectedVariants] = useState({});
  
  // Handle variant selection
  const handleVariantSelect = (typeId, optionId, optionName, priceModifier) => {
    setSelectedVariants(prev => ({
      ...prev,
      [typeId]: { optionId, optionName, priceModifier }
    }));
  };
  
  // Calculate total price
  const calculatePrice = () => {
    let price = item.base_price;
    Object.values(selectedVariants).forEach(variant => {
      price += variant.priceModifier;
    });
    return price;
  };
  
  // Validate all required variants are selected
  const isValid = () => {
    return item.variant_types.every(type => {
      if (type.is_required) {
        return selectedVariants[type.id] !== undefined;
      }
      return true;
    });
  };
  
  const handleConfirm = () => {
    if (isValid()) {
      onConfirm({
        ...item,
        selectedVariants,
        finalPrice: calculatePrice()
      });
    }
  };
  
  return (
    <div style={styles.modal}>
      <div style={styles.modalContent}>
        <h3>{item.name}</h3>
        {item.variant_types.map(type => (
          <div key={type.id} style={styles.variantSection}>
            <h4>{type.variant_type_name} {type.is_required && '*'}</h4>
            {type.options.map(option => (
              <button
                key={option.id}
                style={{
                  ...styles.optionBtn,
                  ...(selectedVariants[type.id]?.optionId === option.id ? styles.optionBtnActive : {})
                }}
                onClick={() => handleVariantSelect(type.id, option.id, option.option_name, option.price_modifier)}
              >
                {option.option_name}
                {option.price_modifier > 0 && ` (+₱${option.price_modifier.toFixed(2)})`}
              </button>
            ))}
          </div>
        ))}
        <div style={styles.priceDisplay}>
          Total: ₱{calculatePrice().toFixed(2)}
        </div>
        <div style={styles.modalActions}>
          <button onClick={onCancel} style={styles.cancelBtn}>Cancel</button>
          <button 
            onClick={handleConfirm} 
            disabled={!isValid()}
            style={{
              ...styles.confirmBtn,
              ...(isValid() ? {} : styles.confirmBtnDisabled)
            }}
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Update order-portal.js

Modify the fetch query to get variants:

```javascript
const { data, error } = await supabase
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

Update the addToCart function to show modal for items with variants:

```javascript
const addToCart = (item) => {
  if (item.has_variants) {
    setSelectedItem(item);
    setShowVariantModal(true);
  } else {
    // Add directly for items without variants
    const updatedCart = [...cart, { ...item, quantity: 1 }];
    setCart(updatedCart);
    localStorage.setItem('cart', JSON.stringify(updatedCart));
  }
};
```

## Testing Checklist

- [ ] Menu displays base items only (no duplicate variants)
- [ ] Clicking "Add to Cart" on variant items opens modal
- [ ] All variant types are displayed in modal
- [ ] Required variants must be selected before confirming
- [ ] Price updates correctly based on selected variants
- [ ] Cart shows item with selected variant details
- [ ] Checkout preserves variant information
- [ ] Order database stores variant selections

## Benefits

1. **Cleaner Menu**: Shows "Fries" once instead of 4 separate items
2. **Better UX**: Customer makes one selection instead of scanning many items
3. **Easier Management**: Update price once for all variants
4. **Flexibility**: Easy to add/remove variants without touching menu items
5. **Accurate Inventory**: Track base items and variants separately

## Notes

- Keep the existing `menu_items` table for backward compatibility during migration
- Gradually migrate items to the new system
- Test thoroughly before removing old menu items
- Consider adding images to variant options in the future
