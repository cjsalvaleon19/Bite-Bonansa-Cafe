# Menu Variants Implementation Guide

## Overview
This document explains the menu variants feature that allows customers to customize their orders by selecting add-ons, sizes, varieties, and other options before adding items to their cart.

## Features Implemented

### 1. Variant Selection Modal
- **Component**: `components/VariantSelectionModal.js`
- **Purpose**: Allows customers to customize menu items with various options
- **Features**:
  - Display variant types (e.g., Flavor, Size, Add-ons)
  - Required and optional variant selection
  - Single or multiple selection modes
  - Price modifiers for each option
  - Real-time price calculation
  - Quantity selection within modal
  - Visual feedback for selected options

### 2. Enhanced Order Portal
- **File**: `pages/customer/order-portal.js`
- **Changes**:
  - Fetches menu items from `menu_items_base` with variant relationships
  - Displays "Customizable options available" for items with variants
  - Opens variant modal when clicking "Customize & Add" button
  - Falls back to `menu_items` table for backward compatibility
  - Enhanced cart display showing variant details
  - Unique cart item IDs for items with different variant combinations

### 3. Checkout Page Updates
- **File**: `pages/customer/checkout.js`
- **Changes**:
  - Displays variant details in order summary
  - Calculates total price including variant modifiers
  - Shows "Points You'll Earn" based on subtotal
  - No percentage display (only total points amount)

### 4. Customer Dashboard Updates
- **File**: `pages/customer/dashboard.js`
- **Changes**:
  - Removed percentage information (2% and 5%)
  - Shows only total points earned and available balance

## Database Schema

### Required Tables
The system uses three main tables for variants:

1. **menu_items_base** - Base menu items
   - `id` - UUID primary key
   - `name` - Item name
   - `category` - Item category
   - `base_price` - Base price without variants
   - `has_variants` - Boolean flag
   - `available` - Availability status
   - `description` - Item description

2. **menu_item_variant_types** - Types of variations
   - `id` - UUID primary key
   - `menu_item_id` - References menu_items_base
   - `variant_type_name` - e.g., "Flavor", "Size", "Add-ons"
   - `is_required` - Must customer select this type?
   - `allow_multiple` - Can select multiple options?
   - `display_order` - Order of display

3. **menu_item_variant_options** - Specific options
   - `id` - UUID primary key
   - `variant_type_id` - References menu_item_variant_types
   - `option_name` - e.g., "Cheese", "Large", "Extra Sauce"
   - `price_modifier` - Additional cost (₱0 for same price)
   - `available` - Availability status
   - `display_order` - Order of display

### Example Data Structure
```sql
-- Base item: Fries
INSERT INTO menu_items_base (name, category, base_price, has_variants, description)
VALUES ('Fries', 'Appetizers', 89.00, true, 'Crispy fries with your choice of flavor');

-- Variant type: Flavor (required, single selection)
INSERT INTO menu_item_variant_types (menu_item_id, variant_type_name, is_required, allow_multiple)
VALUES ('<fries_id>', 'Flavor', true, false);

-- Variant options
INSERT INTO menu_item_variant_options (variant_type_id, option_name, price_modifier)
VALUES 
  ('<flavor_type_id>', 'Cheese', 0),
  ('<flavor_type_id>', 'Meaty Sauce', 0),
  ('<flavor_type_id>', 'Sour Cream', 0),
  ('<flavor_type_id>', 'Barbecue', 0);
```

## Loyalty Points Calculation

### Points Formula
- **0.2% (0.002)** for purchases ₱0–₱499.99
- **0.5% (0.005)** for purchases ₱500 and above
- Calculation is done in `utils/loyaltyUtils.js`

### Customer Display
- **Checkout Page**: Shows "💰 Points You'll Earn: ₱XX.XX"
- **Dashboard**: Shows "Total Points Earned" and "Available Balance"
- **No percentage is shown** to customers

### Example Calculations
- Purchase of ₱450: Earns ₱0.90 (450 × 0.002)
- Purchase of ₱600: Earns ₱3.00 (600 × 0.005)

## Cart System

### Cart Item Structure (with variants)
```javascript
{
  id: "uuid-of-base-item",
  name: "Fries",
  base_price: 89.00,
  finalPrice: 89.00, // base_price + sum of price_modifiers
  quantity: 2,
  cartItemId: "uuid-of-base-item-{sorted-variants-json}",
  selectedVariants: {
    "variant-type-id": [
      {
        optionId: "option-id",
        optionName: "Cheese",
        priceModifier: 0
      }
    ]
  },
  variantDetails: {
    "Flavor": "Cheese"
  }
}
```

### Cart Item Structure (without variants)
```javascript
{
  id: "uuid-of-item",
  name: "Bottled Water",
  price: 20.00,
  finalPrice: 20.00,
  quantity: 1
}
```

## Usage Flow

### For Menu Items WITHOUT Variants
1. Customer clicks "Add to Cart" button
2. Item is added directly to cart with quantity 1
3. Can adjust quantity in cart sidebar

### For Menu Items WITH Variants
1. Customer clicks "Customize & Add" button
2. Variant selection modal appears
3. Customer selects required options (marked with *)
4. Customer can select optional variants
5. Customer sets quantity (default 1)
6. Price updates in real-time
7. Customer clicks "Add to Cart"
8. Item with selected variants is added to cart
9. Same item with different variants appears as separate cart entry

## Backward Compatibility

The system maintains backward compatibility:
- If `menu_items_base` table doesn't exist, falls back to `menu_items`
- Existing cart items without variants continue to work
- Old menu items display normally without customization options

## Testing Checklist

- [x] Items with variants show "Customizable options available"
- [x] Variant modal opens correctly
- [x] Required variants must be selected before adding to cart
- [x] Optional variants can be skipped
- [x] Price modifiers are applied correctly
- [x] Multiple items with same base but different variants tracked separately
- [x] Cart displays variant details
- [x] Checkout shows variant details in order summary
- [x] Points earned calculation includes variant prices
- [x] No percentage shown to customers
- [x] Build passes successfully

## Code Review Improvements

The following improvements were made based on code review:
1. **Deterministic cart item IDs**: Sorted variant objects before JSON.stringify to ensure consistent IDs
2. **Stable React keys**: Replaced index-based keys with generated unique keys
3. **Performance optimization**: Used Map for variant type lookup instead of repeated find operations

## Future Enhancements

Potential improvements for future iterations:
1. Add images to variant options
2. Support for variant groups (e.g., "Choose 2 toppings")
3. Variant-specific inventory tracking
4. Special pricing rules (e.g., combo discounts)
5. Save customer's favorite variant combinations
6. Admin interface for managing variants
