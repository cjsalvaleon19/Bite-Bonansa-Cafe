# Quick Start - Apply Menu Update

## What This Does

✅ Enables customers to select **multiple add-ons** (e.g., Coffee Jelly + Pearls + Cream Cheese)  
✅ Removes the "No Add Ons" option (customers just don't select if they don't want)  
✅ Adds "Extra Rice" (₱10) to Silog Meals  
✅ Removes add-ons from Nachos  
✅ Adds **7 new Frappe items** (Red Velvet, Ube Taro, Dark Chocolate, Mocha, etc.)  
✅ Adds **11 new Fruit Soda & Lemonade items**

**Total Menu Items After:** 80 (was 62)

---

## How to Apply (Choose One Method)

### Method 1: Supabase Dashboard (Easiest)

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor" → "New Query"
4. Open `supabase/migrations/016_Update_Menu_Multiple_Addons_And_New_Items.sql`
5. Copy ALL contents and paste into SQL Editor
6. Click **"Run"** (or Ctrl+Enter)
7. Wait for "Success" message

### Method 2: Supabase CLI

```bash
supabase db push
```

---

## Verify It Worked

Run this in SQL Editor:

```sql
-- Should return 80
SELECT COUNT(*) FROM menu_items_base;

-- Should return 0 (No Add Ons removed)
SELECT COUNT(*) FROM menu_item_variant_options WHERE option_name = 'No Add Ons';

-- Should show new Frappe items
SELECT name, base_price FROM menu_items_base WHERE category = 'Frappe Series' ORDER BY name;

-- Should show new Fruit Soda items
SELECT name, base_price FROM menu_items_base WHERE category = 'Fruit Soda & Lemonade' ORDER BY name;
```

Or run the full test:

```bash
psql -h <host> -U postgres -d postgres -f test_migration_016.sql
```

---

## Test in the App

1. Login as customer
2. Go to Order Portal
3. Click on a Frappe item
4. Try selecting **multiple add-ons** (Coffee Jelly + Pearls + Cream Cheese)
5. All should be highlighted and prices add up
6. Add to cart and verify all add-ons show in cart

---

## Need Help?

- **Full Guide**: See `MENU_UPDATE_MULTIPLE_ADDONS_GUIDE.md`
- **Migration Details**: See `supabase/migrations/README.md`
- **Test Script**: Run `test_migration_016.sql`

---

## Rollback (If Needed)

```sql
-- Revert to single add-on selection
UPDATE menu_item_variant_types
SET allow_multiple = false
WHERE variant_type_name = 'Add Ons';

-- Remove new items (if needed)
DELETE FROM menu_items_base 
WHERE category IN ('Frappe Series', 'Fruit Soda & Lemonade')
AND created_at > '2026-04-24';
```

---

**Created:** 2026-04-24  
**Migration File:** `016_Update_Menu_Multiple_Addons_And_New_Items.sql`
