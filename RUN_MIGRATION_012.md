# 🚀 Run the 012_Seed Bite Bonanza Menu Variants Migration

## Quick Instructions

### ✅ Step 1: Open Supabase Dashboard
1. Go to: https://supabase.com/dashboard
2. Select your **Bite Bonanza Cafe** project
3. Click **"SQL Editor"** in the left sidebar

### ✅ Step 2: Create New Query
- Click **"New Query"** button in SQL Editor

### ✅ Step 3: Copy Migration SQL
- Open file: `supabase/migrations/012_Seed_Bite_Bonanza_Menu_Variants.sql`
- Select ALL (Ctrl+A / Cmd+A)
- Copy (Ctrl+C / Cmd+C)

### ✅ Step 4: Run Migration
- Paste into SQL Editor (Ctrl+V / Cmd+V)
- Click **"Run"** button (or Ctrl+Enter / Cmd+Enter)
- Wait 5-10 seconds for completion

### ✅ Step 5: Verify Success
Run this verification query in SQL Editor:

\`\`\`sql
SELECT COUNT(*) as total_items FROM menu_items_base;
\`\`\`

**Expected Result:** 24 items

---

## What This Migration Does

Creates **24 menu items** with full subcategory support:

### Beverages (4 items)
- ☕ **Milktea** - Size (16oz/22oz) + Add-ons (Pearls, Cream Cheese, Nata, Pudding)
- ☕ **Hot/Iced Drinks** - Size (12oz/16oz/22oz) + Add-ons
- ☕ **Frappe** - Size + Add-ons
- ☕ **Fruit Soda & Lemonade** - Size + Add-ons

### Appetizers (4 items)
- 🍟 **Nachos** - Dip Sauce (Cheese/Salsa/Sour Cream) + Add-ons
- 🍟 **Fries** - Flavor (Cheese/Meaty/Sour Cream/BBQ) + Add-ons
- 🥟 **Siomai** - Style (Steamed/Fried) + Spice Level (Regular/Spicy)
- 🦑 **Calamares** - Sauce + Add-ons

### Pasta & Noodles (6 items)
- 🍝 **Spag Solo** - Add-ons
- 🍝 **Spag & Chicken** - Add-ons
- 🍜 **Ramyeon** - Serving (Solo/Overload) + Spice Level + Add-ons
- 🍜 **Samyang Carbonara** - Serving + Spice Level + Add-ons
- 🍜 **Samyang Carbonara & Chicken** - Spice Level + Add-ons
- 🍜 **Tteokbokki** - Serving + Spice Level + Add-ons

### Chicken (3 items)
- 🍗 **Chicken Meal** - Flavor (BBQ/Buffalo/Honey Butter/etc.) + Add-ons
- 🍗 **Chicken Platter** - Flavor + Add-ons
- 🍗 **Chicken Burger** - Flavor + Add-ons

### Rice Meals, Breakfast, Sandwiches (4 items)
- 🍚 **Silog** - Variety (8 options: Tapsilog, Tocilog, etc.) + Add-ons
- 🧇 **Waffles** - Variety (Plain/Chocolate/Strawberry/Blueberry/Nutella)
- 🥪 **Clubhouse** - Add-ons
- 🌭 **Footlong** - Spice Level + Add-ons (No Veggies option)

### Simple Items (3 items)
- 🍙 **Spam Musubi** - No variants
- 🍱 **Sushi** - No variants
- 🥗 **Caesar Salad** - No variants

---

## After Migration: Test the System

1. **Go to Order Portal**
   - Navigate to: `/customer/order-portal`
   - Login as customer

2. **Click on any menu item**
   - Example: Click "Milktea"
   - **Variant selection modal should appear!** ✨
   - You'll see Size options and Add-ons

3. **Test selecting variants**
   - Required fields marked with red asterisk (*)
   - Can select multiple add-ons
   - Price updates automatically
   - Add to cart shows variants

4. **Verify in cart and checkout**
   - Cart displays selected variants
   - Checkout shows variant details
   - Prices include modifiers

---

## Migration File Details

**Location:** `supabase/migrations/012_Seed_Bite_Bonanza_Menu_Variants.sql`

**Size:** ~60 KB  
**Lines:** 1,437 lines  
**Safe to rerun:** ✅ Yes (uses `IF NOT EXISTS` and `ON CONFLICT DO NOTHING`)

**What it creates:**
1. `menu_items_base` table - Base menu items
2. `menu_item_variant_types` table - Variant categories
3. `menu_item_variant_options` table - Specific options
4. Indexes for performance
5. Row Level Security (RLS) policies
6. All 24 menu items with complete variants

---

## Troubleshooting

### ❌ Error: "relation 'users' does not exist"
**Fix:** Run your base database schema migrations first (users table must exist)

### ❌ Error: "duplicate key value"
**Fix:** Items already exist - this is safe, migration uses `ON CONFLICT DO NOTHING`

### ❌ Variants not showing in UI after migration
**Check:**
1. Migration completed successfully
2. Clear browser cache (Ctrl+Shift+Delete)
3. Hard reload page (Ctrl+Shift+R / Cmd+Shift+R)
4. Check browser console for errors (F12)

### ❌ Can't add items to cart
**Check:**
1. Verify `has_variants` flag is true: `SELECT name, has_variants FROM menu_items_base;`
2. Verify variants exist: `SELECT COUNT(*) FROM menu_item_variant_types;` (should be > 0)
3. Check JavaScript console for errors

---

## Next Steps

After successful migration:

1. ✅ Test all menu items in order portal
2. ✅ Verify variant selection works
3. ✅ Test cart and checkout flow
4. ✅ Adjust prices if needed (update `base_price` or `price_modifier`)
5. ✅ Add menu item images (upload to Supabase Storage)
6. ✅ Customize variants as needed

---

## Need More Help?

See these files:
- `supabase/migrations/README.md` - Detailed migration guide
- `QUICK_START.md` - 5-minute overview
- `APPLY_MIGRATION_NOW.md` - Step-by-step instructions
- `MENU_VARIANTS_IMPLEMENTATION.md` - Technical details

---

**Status:** ✅ Ready to run  
**Time Required:** ~5 minutes  
**Risk:** 🟢 Low (idempotent, tested)

**Created:** 2026-04-24  
**File:** `supabase/migrations/012_Seed_Bite_Bonanza_Menu_Variants.sql`
