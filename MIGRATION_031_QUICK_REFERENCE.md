# Migration 031 - Quick Reference

## Summary
Migration 031 fixes remaining menu item variant errors across 9 different menu items.

## Quick Changes Overview

| Menu Item | Change Type | Before | After |
|-----------|------------|--------|-------|
| **Fries** | Fix duplicate | 2 Barbeque flavors | 1 Barbeque flavor |
| **Spag Solo** | Simplify add-ons | Garlic Bread, Extra Cheese, Meatballs, Meaty Sauce | Meaty Sauce only |
| **Samyang Carbonara & Chicken** | Simplify add-ons | Extra Egg, Extra Cheese, Spam, Egg, Cheese | Spam, Egg, Cheese only |
| **Chicken Burger** | Change flavor | Korean BBQ flavor | Original flavor |
| **Chicken Meal** | Delete item | Menu item exists | Completely deleted |
| **Footlong** | Simplify add-ons | Multiple add-ons | No Vegies only |
| **Clubhouse** | Simplify add-ons | Multiple add-ons | No Vegies, Spam only |
| **Waffles** | Replace varieties | Plain, Nutella, others | Lotus Biscoff, Oreo, Mallows |
| **All Frappe Series** | Add variants | No Size/Add Ons | Size (16oz/22oz) + Add Ons (Coffee Jelly, Pearls, Cream Cheese) |

## Files Created

1. **Migration File:** `supabase/migrations/031_fix_remaining_menu_variant_errors.sql`
   - 772 lines of SQL
   - 11 steps with verification
   - Idempotent and safe to rerun

2. **Documentation:** `RUN_MIGRATION_031.md`
   - Detailed instructions
   - Verification queries
   - Testing checklist

3. **Updated:** `supabase/migrations/README.md`
   - Added migration 031 to the list
   - Updated migration count

## How to Apply

### Quick Steps
1. Open Supabase Dashboard → SQL Editor
2. Copy contents of `031_fix_remaining_menu_variant_errors.sql`
3. Paste and run
4. Check output for "✓ All menu variant errors have been fixed successfully!"

### Verification After Running
Run this quick query:
```sql
-- Quick verification
SELECT 
  'Fries Barbeque' as check_name,
  (SELECT COUNT(*) FROM menu_items_base mb
   JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
   JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
   WHERE mb.name = 'Fries' AND vt.variant_type_name = 'Flavor' 
   AND vo.option_name = 'Barbeque') as actual,
  1 as expected
UNION ALL
SELECT 'Chicken Meal deleted', 
  (SELECT COUNT(*) FROM menu_items_base WHERE name = 'Chicken Meal'),
  0
UNION ALL
SELECT 'Frappe with Size',
  (SELECT COUNT(DISTINCT mb.id) FROM menu_items_base mb
   JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
   WHERE mb.category = 'Frappe Series' AND vt.variant_type_name = 'Size'),
  (SELECT COUNT(*) FROM menu_items_base WHERE category = 'Frappe Series');
```

Expected output:
- Fries Barbeque: actual = 1, expected = 1 ✓
- Chicken Meal deleted: actual = 0, expected = 0 ✓
- Frappe with Size: actual = total Frappe count ✓

## Impact Analysis

### Items Modified
- 8 menu items modified
- 1 menu item deleted (Chicken Meal)
- All Frappe Series items enhanced (~11 items)

### Variant Changes
- **Deleted:** ~20-30 incorrect variant options
- **Added:** ~3-4 new Waffles varieties
- **Added:** Size + Add Ons variants for all Frappes (~44 new options)

### User-Facing Changes
Customers will see:
1. Cleaner, more accurate menu options
2. Proper flavor choices for Chicken Burger
3. Frappe items now have size selection
4. Waffles have new variety options
5. Simplified add-ons for sandwiches and pasta

## Rollback Plan
If needed, rollback requires:
1. Re-add deleted variant options
2. Re-create Chicken Meal item
3. Remove new Waffles varieties
4. Remove Frappe variants

**Note:** Not recommended - changes fix data quality issues

## Testing Checklist
After migration:
- [ ] Test Fries ordering (should see 1 Barbeque)
- [ ] Test Spag Solo (should see only Meaty Sauce add-on)
- [ ] Test Chicken Burger (should have Original, not Korean BBQ)
- [ ] Verify Chicken Meal is gone from menu
- [ ] Test Waffles (should see Lotus Biscoff, Oreo, Mallows)
- [ ] Test any Frappe item (should have Size and Add Ons options)
- [ ] Test Footlong (should have only No Vegies)
- [ ] Test Clubhouse (should have No Vegies and Spam only)

## Migration Stats
- **Lines of code:** 772
- **DO blocks:** 11 (all properly closed)
- **Steps:** 11 (including verification)
- **Estimated run time:** 1-3 seconds
- **Safety:** Idempotent, safe to rerun

## Support
For issues or questions:
1. Check `RUN_MIGRATION_031.md` for detailed guide
2. Review migration output logs
3. Run verification queries
4. Check browser console for frontend issues

## Related Files
- Migration: `supabase/migrations/031_fix_remaining_menu_variant_errors.sql`
- Guide: `RUN_MIGRATION_031.md`
- README: `supabase/migrations/README.md`

---
**Created:** 2026-04-28  
**Status:** Ready to deploy  
**Priority:** High (fixes data quality issues)
