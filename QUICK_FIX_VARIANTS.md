# Quick Fix Guide - Variant Selection Not Showing

## Problem
When clicking "Add to Cart" on menu items with variants (like Chicken Burger, Chicken Meals), the variant selection modal doesn't appear. Customers can't choose flavors, sizes, or add-ons.

## Quick Diagnosis

Run this diagnostic script in your Supabase SQL Editor:
```bash
# In Supabase: SQL Editor → New query → Paste and run:
```
Use: `diagnose_variant_system.sql`

## Most Likely Fixes

### Fix #1: has_variants Flag Not Set
If diagnostic shows "Items with MISMATCH", run:
```bash
# In Supabase SQL Editor:
```
Use: `fix_has_variants_flag.sql`

This updates all items that have variant types to set `has_variants = true`.

### Fix #2: No Data in menu_items_base
If diagnostic shows "menu_items_base table is empty", you need to migrate data.

**Option A: Run the complete migration (recommended)**
```bash
# In Supabase SQL Editor, run in order:
1. menu_variants_schema.sql (if not already run)
2. complete_menu_variants_migration.sql
```

**Option B: Use existing menu_items data**
If you have data in the old `menu_items` table, you'll need to either:
- Manually add items to `menu_items_base` with variants, OR
- Keep using the old table (no variants support)

## Verification Steps

After applying the fix:

1. **Check the database:**
   - Run `diagnose_variant_system.sql` again
   - Should show "SUCCESS: All items with variants have has_variants=true"

2. **Test in the UI:**
   - Go to Order Portal (`/customer/order-portal`)
   - Find items with variants (Chicken Burger, etc.)
   - Button should say "Customize & Add" (not just "Add to Cart")
   - Click the button
   - Variant selection modal should appear
   - Select options and add to cart
   - Cart should show variant details

## Expected Behavior

### Without Variants
- Item: Regular drinks or items without customization
- Button: "Add to Cart"
- Behavior: Immediately adds to cart
- Example: Items from screenshot that don't have variants

### With Variants
- Item: "Chicken Burger" (description: "Juicy chicken burger — choose your flavor")
- Button: "Customize & Add"
- Behavior: Opens modal to select flavor
- Modal shows: Flavor options (Barbecue, Buffalo Wings, Honey Butter, Sweet & Sour, Sweet & Spicy, Soy Garlic, Teriyaki, Original)
- After selection: Adds to cart with selected variant and correct price

### Another Example with Variants
- Item: "Chicken Meals" (description: "Choose your flavor — 7 variants available")
- Same variant selection flow as Chicken Burger

## File Reference

- `fix_has_variants_flag.sql` - Updates has_variants flag
- `diagnose_variant_system.sql` - Checks current state
- `complete_menu_variants_migration.sql` - Full menu data with variants
- `VARIANT_SELECTION_FIX.md` - Detailed technical documentation

## Still Not Working?

Check the browser console for errors:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for errors when clicking "Add to Cart"
4. Common issues:
   - Database query errors (check Supabase logs)
   - Missing RLS policies (check database policies)
   - Data structure mismatch (check diagnostic output)

## Need Help?

The variant system consists of:
- **Frontend**: `pages/customer/order-portal.js` + `components/VariantSelectionModal.js`
- **Backend**: 3 database tables (menu_items_base, menu_item_variant_types, menu_item_variant_options)
- **Logic**: Checks `item.has_variants && item.variant_types && item.variant_types.length > 0`

If the diagnostic shows everything is correct but it still doesn't work, the issue might be in the frontend code or API permissions.
