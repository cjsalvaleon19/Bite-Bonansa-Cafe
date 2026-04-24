# Fix: Variant Selection Modal Not Showing

## Problem
When customers click menu items, they should see a popup modal for:
- **Variants** (required) - like Flavor, Variety, Style
- **Size** (required for drinks) - 16oz, 22oz
- **Add-ons** (optional) - Extra toppings, Add-ons

**Current Issue:** Items are being added directly to cart without showing the variant selection modal.

## Root Cause Analysis

### 1. Data Structure Issue
The system has two possible data states:
- **OLD STRUCTURE:** Individual items in `menu_items` table (e.g., "Lemon Blueberry Juice", "Lemonade Juice" as separate items)
- **NEW STRUCTURE:** Base items in `menu_items_base` with variant_types and variant_options tables

### 2. Code Logic (Already Implemented)
The code in `pages/customer/order-portal.js` correctly checks:
```javascript
if (item.has_variants && item.variant_types && item.variant_types.length > 0) {
  setSelectedItem(item);
  setShowVariantModal(true);
} else {
  // Add directly to cart
}
```

### 3. Missing Flag
Items with variants need `has_variants=true` flag set in database.

## Solution: 3-Step Fix

### Step 1: Verify Migration Status

Run this query in Supabase SQL Editor to check current status:

```sql
-- Check table row counts
SELECT 'menu_items' as table_name, COUNT(*) as count FROM menu_items
UNION ALL
SELECT 'menu_items_base' as table_name, COUNT(*) as count FROM menu_items_base
UNION ALL
SELECT 'menu_item_variant_types' as table_name, COUNT(*) as count FROM menu_item_variant_types;

-- Check for mismatch: items with variants but has_variants=false
SELECT 
  mb.name,
  mb.has_variants,
  COUNT(DISTINCT vt.id) as variant_types_count
FROM menu_items_base mb
LEFT JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
GROUP BY mb.id, mb.name, mb.has_variants
HAVING COUNT(DISTINCT vt.id) > 0 AND (mb.has_variants = false OR mb.has_variants IS NULL);
```

### Step 2: Apply Migrations (If Needed)

If `menu_items_base` is empty or has fewer than 20 items:

**Run this migration:**
```bash
# In Supabase SQL Editor, paste and run:
supabase/migrations/012_Seed_Bite_Bonanza_Menu_Variants.sql
```

This creates:
- 24 base menu items
- Variant types (Flavor, Size, Style, Add-ons, etc.)
- Variant options with price modifiers

### Step 3: Fix has_variants Flag

Run this to ensure all items with variant_types have `has_variants=true`:

```sql
-- Update items that have variant types
UPDATE menu_items_base
SET has_variants = true
WHERE id IN (
  SELECT DISTINCT menu_item_id
  FROM menu_item_variant_types
)
AND (has_variants = false OR has_variants IS NULL);

-- Verify the fix
SELECT 
  mb.name,
  mb.category,
  mb.has_variants,
  COUNT(DISTINCT vt.id) as variant_types,
  STRING_AGG(DISTINCT vt.variant_type_name, ', ') as variant_type_names
FROM menu_items_base mb
LEFT JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
WHERE mb.available = true
GROUP BY mb.id, mb.name, mb.category, mb.has_variants
HAVING COUNT(DISTINCT vt.id) > 0
ORDER BY mb.category, mb.name;
```

## Additional Fix: Receipt Variant Display

The receipt currently does NOT show variant details. Fix this in `pages/cashier/pos.js`:

### Current Receipt Code (Line ~460):
```javascript
${order.items.map(item => `
  <div class="item">
    <span>${item.name} x${item.quantity}</span>
    <span>₱${(item.price * item.quantity).toFixed(2)}</span>
  </div>
`).join('')}
```

### Fixed Receipt Code:
```javascript
${order.items.map(item => `
  <div class="item">
    <span>
      ${item.name} x${item.quantity}
      ${item.variantDetails && Object.keys(item.variantDetails).length > 0 
        ? `<br><small style="padding-left: 10px; color: #666;">
            ${Object.entries(item.variantDetails).map(([type, value]) => 
              `${type}: ${value}`
            ).join(', ')}
          </small>`
        : ''
      }
    </span>
    <span>₱${(item.price * item.quantity).toFixed(2)}</span>
  </div>
`).join('')}
```

## Testing Checklist

After applying fixes, test:

- [ ] Click on beverage item → Should show Size selection (Required)
- [ ] Click on beverage item → Should show Add-ons (Optional)
- [ ] Click on food item → Should show Flavor/Variety selection (Required)
- [ ] Click on food item → Should show Add-ons (Optional)
- [ ] Select variants and add to cart → Cart shows variant details
- [ ] Proceed to checkout → Checkout shows variant details
- [ ] Complete order → Receipt prints with variant details

## Example: How Drinks Should Work

**Item:** "Fruit Soda & Lemonade" (₱49 base price)

**Clicking the item shows modal with:**

1. **Size** (Required, single selection)
   - 16oz (Regular) - ₱0
   - 22oz (Large) - +₱15

2. **Flavor** (Required, single selection)
   - Lemon
   - Blueberry
   - Strawberry
   - etc.

3. **Add-ons** (Optional, multiple selection)
   - Extra Fruit - +₱15
   - Nata de Coco - +₱10

**Result in Cart:**
```
Fruit Soda & Lemonade           ₱64.00
Size: 22oz (Large), Flavor: Lemon Blueberry, Add-ons: Nata de Coco
```

**Result in Receipt:**
```
Fruit Soda & Lemonade x1        ₱64.00
  Size: 22oz (Large), Flavor: Lemon Blueberry, Add-ons: Nata de Coco
```

## Files Modified

1. `pages/customer/order-portal.js` - ✅ Already implemented (no changes needed)
2. `components/VariantSelectionModal.js` - ✅ Already implemented (no changes needed)
3. `pages/customer/checkout.js` - ✅ Already shows variant details
4. `pages/cashier/pos.js` - ❌ Needs update for receipt printing

## Quick Diagnosis Commands

```sql
-- 1. Count items with variants
SELECT COUNT(*) FROM menu_items_base WHERE has_variants = true;

-- 2. List all variant types
SELECT DISTINCT variant_type_name FROM menu_item_variant_types;

-- 3. Check specific drink setup
SELECT 
  mb.name,
  mb.base_price,
  vt.variant_type_name,
  vt.is_required,
  vo.option_name,
  vo.price_modifier
FROM menu_items_base mb
JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
WHERE mb.category = 'Beverages'
ORDER BY mb.name, vt.display_order, vo.display_order;
```

## Expected Results

After fixing:
- **21 items** should have `has_variants=true`
- **3 items** (Spam Musubi, Sushi, Caesar Salad) have `has_variants=false` (no variants)
- **Clicking any item with variants** triggers the variant selection modal
- **Cart and Receipt** show complete variant details

---

**Created:** 2026-04-24  
**Status:** Ready for implementation  
**Priority:** HIGH - Affects customer ordering experience
