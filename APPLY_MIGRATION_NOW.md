# 🚀 Apply Menu Variants Migration NOW

## Quick Start

You need to run the SQL migration file through the Supabase Dashboard.

### Step 1: Open Supabase Dashboard
1. Go to: [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: **Bite Bonansa Cafe**

### Step 2: Open SQL Editor
1. Click **"SQL Editor"** in the left sidebar
2. Click **"New Query"** button

### Step 3: Run Migration
1. Open the file: `complete_menu_variants_migration.sql`
2. Copy **ALL** contents (960 lines)
3. Paste into the SQL Editor
4. Click **"Run"** button (or press Ctrl+Enter)

### Step 4: Wait for Completion
- The migration should complete in a few seconds
- You'll see success messages in the output

### Step 5: Verify Success
Run this query in the SQL Editor:

```sql
SELECT 
  COUNT(*) as total_items,
  COUNT(CASE WHEN has_variants THEN 1 END) as items_with_variants
FROM menu_items_base;
```

**Expected Results:**
- Total items: 24 (or more)
- Items with variants: 21

## What This Migration Does

### Creates 24 Menu Items with Variants:

**Beverages (4 items)**
- ✅ Milktea: Size + Add-ons
- ✅ Hot/Iced Drinks: Size + Add-ons
- ✅ Frappe: Size + Add-ons
- ✅ Fruit Soda & Lemonade: Size + Add-ons

**Appetizers (4 items)**
- ✅ Nachos: Dip Sauce + Add-ons
- ✅ Fries: Flavor + Add-ons
- ✅ Siomai: Style + Spice Level
- ✅ Calamares: Sauce + Add-ons

**Pasta & Noodles (6 items)**
- ✅ Spag Solo: Add-ons
- ✅ Spag & Chicken: Add-ons
- ✅ Ramyeon: Serving + Spice + Add-ons
- ✅ Samyang Carbonara: Serving + Spice + Add-ons
- ✅ Samyang Carbonara & Chicken: Spice + Add-ons
- ✅ Tteokbokki: Serving + Spice + Add-ons

**Chicken (3 items)**
- ✅ Chicken Meal: Flavor + Add-ons
- ✅ Chicken Platter: Flavor + Add-ons
- ✅ Chicken Burger: Flavor + Add-ons

**Rice Meals (1 item)**
- ✅ Silog: Variety + Add-ons

**Breakfast (1 item)**
- ✅ Waffles: Variety

**Sandwiches (2 items)**
- ✅ Clubhouse: Add-ons
- ✅ Footlong: Spice + Add-ons

**Simple Items (3 items)**
- ✅ Spam Musubi
- ✅ Sushi
- ✅ Caesar Salad

## After Migration

### Test the System
1. Go to: `/customer/order-portal`
2. Click on items like "Milktea", "Fries", "Chicken Meal"
3. **The variant selection modal should now appear!**
4. Select options and add to cart
5. Verify variants show in cart with correct prices

### Expected Behavior
- Items with variants show "Customizable options available"
- Clicking opens a modal with all variant choices
- Required variants are marked with red asterisk (*)
- Prices update based on selected options
- Cart shows selected variants for each item

## Troubleshooting

### ❌ Error: "table menu_items_base does not exist"
**Fix:** Run `menu_variants_schema.sql` first to create tables

### ❌ Error: "duplicate key value"
**Fix:** This is OK! The migration uses `ON CONFLICT DO NOTHING` - it's safe

### ❌ Variants still not showing after migration
**Check:**
1. Did the migration complete successfully?
2. Run the verification query above
3. Clear browser cache and reload
4. Check browser console for errors

## Need Help?

See these files for more details:
- `MENU_VARIANTS_MIGRATION_GUIDE.md` - Full migration guide
- `MENU_VARIANTS_IMPLEMENTATION.md` - Implementation details
- `complete_menu_variants_migration.sql` - The SQL file to run

---

**Status:** Ready to apply ✅  
**Time Required:** ~5 minutes  
**Risk Level:** Low (migration is idempotent - safe to run multiple times)
