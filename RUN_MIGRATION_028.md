# Migration 028: Cleanup Duplicate Menu Items and Variants

## Quick Start

**IMPORTANT: Run this migration to fix duplicate menu items and variants!**

### Symptoms You're Experiencing
- Menu items showing both old and new prices
- Chicken Platter showing duplicate add-ons/variants
- Confusing options in the menu customization

### What This Migration Does
This migration removes duplicate menu items and variants, keeping only the newest/updated data.

### How to Run

#### Step 1: Backup (Recommended)
Backup your database before running any migration.

#### Step 2: Run the Migration

**Via Supabase Dashboard:**
1. Open Supabase Dashboard → SQL Editor
2. Copy and paste: `supabase/migrations/028_cleanup_duplicate_menu_items_and_variants.sql`
3. Click "Run"
4. Check the output messages for success

**Via Supabase CLI:**
```bash
cd /path/to/Bite-Bonansa-Cafe
supabase db push
```

#### Step 3: Verify
Run this query to confirm no duplicates remain:
```sql
-- Should return 0 rows
SELECT name, category, COUNT(*) as count
FROM menu_items_base
WHERE available = true
GROUP BY name, category
HAVING COUNT(*) > 1;
```

### What Gets Deleted

#### Chicken Platter - Old Version (₱249)
- Old menu item entry with ₱249 price
- Old "Add-ons" variant type (lowercase 'ons')
- Old add-on options: Extra Rice, Gravy, Coleslaw
- Old Flavor variant options

#### Other Duplicate Menu Items
Any other menu items with duplicates will have their older versions removed.

### What Gets Kept

#### Chicken Platter - New Version (₱254)
- Menu item at ₱254
- **Flavor** variant: Honey Butter, Soy Garlic, Sweet & Sour, Sweet & Spicy, Teriyaki, Buffalo, Barbecue
- **Add Ons** variant: No Add Ons, Rice (+₱15)

#### Other Menu Items
The newest version of each menu item (highest price, latest created_at)

## Expected Output

```
================================================================
CLEANUP MIGRATION 028 - Starting
================================================================
Duplicate menu item groups found: X
Chicken Platter entries found: X
================================================================
Deleting old Chicken Platter variant options...
Deleting old Chicken Platter variant types...
Deleting old Chicken Platter menu item...
Deleting other duplicate menu items...
================================================================
CLEANUP MIGRATION 028 - Complete
================================================================
Total available menu items: X
Remaining duplicate menu items: 0 (should be 0)
Chicken Platter entries: 1 (should be 1)
✓ All duplicates successfully removed
✓ Only updated menu items and variants remain
================================================================
```

## Troubleshooting

### Error: Foreign key constraint violation
- This shouldn't happen as the migration deletes in the correct order
- If it does, ensure no orders are being placed while running the migration

### Duplicates still showing in UI
- Clear your browser cache
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Check the database directly to confirm duplicates are gone

### Migration already run?
- Safe to run multiple times (idempotent)
- If no duplicates exist, it will do nothing

## Need Help?

See `DUPLICATE_MENU_CLEANUP_GUIDE.md` for detailed documentation.

## Quick Verification Commands

```sql
-- Check Chicken Platter count (should be 1)
SELECT COUNT(*) FROM menu_items_base WHERE name = 'Chicken Platter';

-- Check Chicken Platter price (should be 254.00)
SELECT base_price FROM menu_items_base WHERE name = 'Chicken Platter';

-- View all Chicken Platter variants
SELECT vt.variant_type_name, vo.option_name, vo.price_modifier
FROM menu_items_base mb
JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
WHERE mb.name = 'Chicken Platter'
ORDER BY vt.variant_type_name, vo.option_name;
```

Expected Chicken Platter variants:
- 2 variant types: "Flavor" and "Add Ons"
- 9 total options (7 flavors + 2 add-ons)
