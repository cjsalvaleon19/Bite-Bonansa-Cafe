# Migration Scripts

This directory contains scripts to help apply the menu variants migration to your Supabase database.

## Available Scripts

### 1. `apply-menu-variants-migration.js`
**Purpose:** Generates instructions for running the SQL migration via Supabase Dashboard.

**Usage:**
```bash
node scripts/apply-menu-variants-migration.js
```

**Output:**
- Displays step-by-step instructions in the terminal
- Creates `APPLY_MIGRATION_NOW.md` with detailed guide

**When to use:**
- First time setup
- When you need clear instructions for manual migration
- When you want to ensure you understand each step

---

### 2. `seed-menu-variants.js`
**Purpose:** Programmatically seeds menu items with variants using Supabase JavaScript client.

**Usage:**
```bash
# Make sure dependencies are installed first
npm install

# Run the seeder
node scripts/seed-menu-variants.js
```

**Features:**
- Uses Supabase JavaScript client to insert data
- Automatically handles duplicates with upsert
- Shows progress for each item
- Provides summary of changes

**Note:** Currently seeds only 2 sample items (Milktea and Fries) as a proof of concept.

**When to use:**
- Automated deployment pipelines
- Testing environments
- When you prefer programmatic approach

---

## Recommended Approach

### ✅ **Best Practice: Use Supabase Dashboard SQL Editor**

1. Run the helper script to get instructions:
   ```bash
   node scripts/apply-menu-variants-migration.js
   ```

2. Follow the generated instructions in `APPLY_MIGRATION_NOW.md`

3. Execute the complete migration SQL file in Supabase Dashboard:
   - File: `complete_menu_variants_migration.sql`
   - Contains: All 24 menu items with complete variants

**Why this is recommended:**
- ✅ Runs the complete migration (all 24 items)
- ✅ Fastest execution (single SQL transaction)
- ✅ Most reliable (native PostgreSQL)
- ✅ Easiest to verify and troubleshoot
- ✅ Tested and proven approach

---

## What Gets Migrated

The complete migration includes **24 menu items**:

### Beverages (4 items)
- Milktea: Size + Add-ons
- Hot/Iced Drinks: Size + Add-ons
- Frappe: Size + Add-ons
- Fruit Soda & Lemonade: Size + Add-ons

### Appetizers (4 items)
- Nachos: Dip Sauce + Add-ons
- Fries: Flavor + Add-ons
- Siomai: Style + Spice Level
- Calamares: Sauce + Add-ons

### Pasta & Noodles (6 items)
- Spag Solo: Add-ons
- Spag & Chicken: Add-ons
- Ramyeon: Serving + Spice + Add-ons
- Samyang Carbonara: Serving + Spice + Add-ons
- Samyang Carbonara & Chicken: Spice + Add-ons
- Tteokbokki: Serving + Spice + Add-ons

### Chicken (3 items)
- Chicken Meal: Flavor + Add-ons
- Chicken Platter: Flavor + Add-ons
- Chicken Burger: Flavor + Add-ons

### Rice Meals (1 item)
- Silog: Variety + Add-ons

### Breakfast & Snacks (1 item)
- Waffles: Variety

### Sandwiches (2 items)
- Clubhouse: Add-ons
- Footlong: Spice + Add-ons

### Simple Items (3 items)
- Spam Musubi
- Sushi
- Caesar Salad

---

## Verification

After running any migration, verify success with:

```sql
-- Check total items
SELECT COUNT(*) as total_items,
       COUNT(CASE WHEN has_variants THEN 1 END) as items_with_variants
FROM menu_items_base;
```

**Expected Results:**
- Total items: 24 (or more if you have existing items)
- Items with variants: 21

```sql
-- View all items with variant details
SELECT 
  mb.name,
  mb.category,
  mb.has_variants,
  COUNT(DISTINCT vt.id) as variant_types,
  COUNT(vo.id) as total_options
FROM menu_items_base mb
LEFT JOIN menu_item_variant_types vt ON mb.id = vt.menu_item_id
LEFT JOIN menu_item_variant_options vo ON vt.id = vo.variant_type_id
GROUP BY mb.id, mb.name, mb.category, mb.has_variants
ORDER BY mb.category, mb.name;
```

---

## Troubleshooting

### Error: "Cannot find module '@supabase/supabase-js'"
**Solution:**
```bash
npm install
```

### Error: ".env.local file not found"
**Solution:** Make sure you have `.env.local` file in the project root with:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Error: "table menu_items_base does not exist"
**Solution:** Run `menu_variants_schema.sql` first to create the required tables.

### Migration completes but items not showing in UI
**Check:**
1. Clear browser cache
2. Verify you're logged in as a customer
3. Check browser console for errors
4. Run verification queries above

---

## Related Files

- `complete_menu_variants_migration.sql` - Complete SQL migration (960 lines)
- `menu_variants_schema.sql` - Database schema for variants tables
- `APPLY_MIGRATION_NOW.md` - Step-by-step migration instructions
- `MENU_VARIANTS_MIGRATION_GUIDE.md` - Comprehensive migration guide
- `MENU_VARIANTS_IMPLEMENTATION.md` - Implementation details

---

## Support

For issues or questions:
1. Check `APPLY_MIGRATION_NOW.md` for quick start
2. See `MENU_VARIANTS_MIGRATION_GUIDE.md` for detailed guide
3. Review `MENU_VARIANTS_IMPLEMENTATION.md` for technical details

---

**Last Updated:** 2026-04-24
