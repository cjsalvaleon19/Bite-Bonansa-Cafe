# Customer Order Portal Implementation

## Overview
This document describes the implementation of the Customer Order Portal with subvariant selection functionality and cashier's color scheme.

## Changes Made

### 1. Created New Customer Order Portal Page
**File**: `pages/customer/order.js`

The Order Portal is a complete menu ordering interface for customers with the following features:

#### Features Implemented:
- **Menu Display**: Shows all available menu items filtered by `available=true`
- **Category Filtering**: Browse items by category (All, Snacks & Bites, Noodles, etc.)
- **Search Functionality**: Search items by name or category
- **Subvariant Selection**: 
  - Clicking on items with variants opens a modal
  - Only shows **available** variant options (`available !== false`)
  - Filters out deleted/unavailable items from display
  - Supports required and optional variants
  - Supports single and multiple selection variants
- **Shopping Cart**: 
  - Add items with selected variants
  - Update quantities
  - Remove items
  - Clear entire cart
- **Order Modes**: 
  - Delivery (requires address, shows delivery fee)
  - Pick-up (requires contact number)
- **Checkout**: Places order with status 'pending' for cashier to accept

### 2. Applied Cashier's Color Scheme
**Color Palette (matching POS interface)**:
- **Primary Color**: `#ffc107` (Yellow/Gold) - Used for:
  - Headers and section titles
  - Prices
  - Borders on menu cards
  - Active category tabs
  - Buttons (checkout, quantity controls)
  - Variant badges
  
- **Background**: 
  - Main gradient: `linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)`
  - Panel background: `#1a1a1a`
  - Input/card backgrounds: `#2a2a2a`

- **Text Colors**:
  - Primary text: `#fff` (white)
  - Secondary text: `#ccc` (light gray)
  - Muted text: `#888` and `#aaa` (gray)

### 3. Variant Filtering Implementation

The implementation ensures deleted/unavailable items are excluded at multiple levels:

```javascript
// 1. Menu items query filters available items
.eq('available', true)

// 2. Variant options are filtered to only show available
const filteredVariantTypes = (variantTypes || []).map(vt => ({
  ...vt,
  options: (vt.options || []).filter(opt => opt.available !== false)
})).filter(vt => vt.options.length > 0);

// 3. VariantSelectionModal also filters unavailable options
.filter(option => option.available !== false)
```

### 4. Database Schema Used

**Tables**:
- `menu_items` (view) - Contains menu items with base prices
- `menu_item_variant_types` - Variant types (Size, Flavor, Add Ons, etc.)
- `menu_item_variant_options` - Specific options with price modifiers
- `orders` - Stores customer orders

**Order Fields Used**:
- `customer_id` - References user ID
- `items` - JSONB array with item details and variants
- `order_mode` - 'delivery' or 'pick-up'
- `delivery_address` - Customer address
- `contact_number` - Customer phone
- `special_request` - Special instructions
- `delivery_fee` - Fee for delivery orders
- `delivery_fee_pending` - Flag for cashier to calculate exact fee
- `subtotal`, `total_amount` - Order amounts
- `status` - Starts as 'pending'

### 5. User Flow

1. **Browse Menu**: 
   - Customer views all available menu items
   - Can search or filter by category
   - Sees variant information on item cards

2. **Select Item**:
   - Click item to add to cart
   - If item has variants, modal opens
   - Customer selects required variants (marked with *)
   - Can select optional variants
   - Sees price updated with modifiers
   - Adjusts quantity if needed

3. **Add to Cart**:
   - Item added with unique cart key based on variant selections
   - Same item with different variants = separate cart entries
   - Cart shows all items with variant details

4. **Checkout**:
   - Select order mode (Delivery or Pick-up)
   - Enter required information
   - Review total (includes delivery fee if applicable)
   - Place order

5. **Order Placed**:
   - Order saved with status 'pending'
   - Redirects to Order Tracking page
   - Cashier sees order in their Pending Orders queue

## Navigation

The Order Portal is accessible from:
- Customer Dashboard → "Order Portal"
- Direct URL: `/customer/order`

## Styling Consistency

All styles match the cashier's POS interface:
- Same font family: `'Poppins', sans-serif`
- Same header font: `'Playfair Display', serif`
- Same color scheme throughout
- Same button styles
- Same card/panel styling
- Same form input styling

## Testing Checklist

- [x] Page loads without errors
- [x] Menu items display correctly
- [x] Category filtering works
- [x] Search functionality works
- [x] Items with variants open modal
- [x] Items without variants add directly to cart
- [x] Variant selection modal shows only available options
- [x] Required variants are enforced
- [x] Price calculation includes modifiers
- [x] Cart updates correctly
- [x] Quantity adjustments work
- [x] Checkout validates required fields
- [x] Order placement saves to database
- [x] Sold out items are disabled

## Future Enhancements

Potential improvements for future iterations:
1. Add image support for menu items
2. Implement GPS-based delivery fee calculation
3. Add payment method selection (GCash)
4. Add loyalty points integration
5. Add order history quick reorder
6. Add favorites/saved items
7. Add estimated delivery time
8. Add real-time order status updates

## Related Files

- `pages/customer/order.js` - Main Order Portal page
- `components/VariantSelectionModal.js` - Variant selection modal (shared with POS)
- `pages/cashier/pos.js` - Reference for color scheme
- `supabase/migrations/012_Seed_Bite_Bonanza_Menu_Variants.sql` - Variant schema
- `database_schema.sql` - Complete database schema

## Notes

- The delivery fee is set to a default ₱30 but marked as `delivery_fee_pending: true` so cashier can calculate exact fee based on GPS coordinates
- All orders start with status 'pending' and require cashier acceptance
- The variant filtering ensures compliance with migration 027 which removes unavailable variant options
- Uses the same VariantSelectionModal component as the POS for consistency
