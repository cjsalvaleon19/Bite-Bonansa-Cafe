# Variant Details Receipt Display Fix

## Issue
Receipts from the POS system were showing variant details in the old format (concatenated with item name like "Biscoff Cafe Latte (Size & Type: 12oz Hot)") instead of displaying them separately below the item name.

## Root Cause
Two problems were identified:

1. **Missing variantDetails in order.items array**: In the POS checkout flow (`pages/cashier/pos.js` line 387), the `items` array passed to the `printReceipt()` function was not including the `variantDetails` field. Only `{id, name, price, quantity}` were being passed.

2. **Removed variant display code**: In PR #130 (commit d657a65), the code that displayed variant details on receipts was accidentally removed. The receipt template was showing item name and quantity, but the variant details display logic was deleted.

## Changes Made

### 1. Include variantDetails in order.items (line 387-392)
```javascript
// BEFORE:
items: items.map(({ id, name, price, quantity }) => ({
  id,
  name,
  price,
  quantity,
}))

// AFTER:
items: items.map(({ id, name, price, quantity, variantDetails }) => ({
  id,
  name,
  price,
  quantity,
  variantDetails,  // ← Added
}))
```

### 2. Restore variant details display in receipt template (line 574-589)
```javascript
${order.items.map(item => `
  <div class="item">
    <span>
      ${item.name} x${item.quantity}
      ${item.variantDetails && Object.keys(item.variantDetails).length > 0 
        ? `<br><small style="padding-left: 10px; color: #666; font-size: 10px;">
            (${Object.entries(item.variantDetails).map(([type, value]) => 
              `${type}: ${value}`
            ).join(', ')})
          </small>`
        : ''
      }
    </span>
    <span>₱${(item.price * item.quantity).toFixed(2)}</span>
  </div>
`).join('')}
```

## Expected Receipt Format (After Fix)

```
ITEMS ORDERED

Item                           Qty    Price
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Biscoff Cafe Latte             x1    ₱104.00
  (Size: 12oz, Type: Hot)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Variant details now appear:
- On a separate line below the item name
- In smaller font (10px)
- Indented with left padding
- In gray color (#666)
- Formatted as "(Key: Value, Key: Value)"

## Verification Status

✅ Code changes complete
✅ variantDetails included in order.items array  
✅ Receipt template updated to display variant details
✅ Format matches specification (inline, below item name)
✅ Database storage remains correct (variant_details JSONB column)

## Other Receipt Functions

These functions were verified and are **already working correctly**:
- `pages/cashier/dashboard.js` - Uses `order.order_items` from database with `variant_details`
- `pages/cashier/eod-report.js` - Uses `order.order_items` from database with `variant_details`

Only the POS receipt printing needed to be fixed because it was using the in-memory `order.items` array instead of fetching from the database.

## Testing

To test the fix:
1. Go to POS (`/cashier/pos`)
2. Add an item with variants (e.g., Biscoff Cafe Latte)
3. Select variant options (e.g., Size: 12oz, Type: Hot)
4. Complete the checkout
5. Verify the printed receipt shows variant details on a separate line below the item name

## Files Modified
- `pages/cashier/pos.js` (2 changes)
  - Line 387-392: Include variantDetails in order.items
  - Line 574-589: Display variant details in receipt template
