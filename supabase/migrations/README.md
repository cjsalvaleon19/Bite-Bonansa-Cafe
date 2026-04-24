# Supabase Migrations

This directory contains SQL migration files for the Bite Bonanza Cafe database.

## Available Migrations

### 012_Seed_Bite_Bonanza_Menu_Variants.sql
**Purpose:** Create menu variants schema and seed all menu items with subcategories

**What it does:**
- Creates `menu_items_base`, `menu_item_variant_types`, and `menu_item_variant_options` tables
- Sets up Row Level Security (RLS) policies
- Seeds 24 menu items with complete variant configurations

**Menu items included:**
- **Beverages** (4): Milktea, Hot/Iced Drinks, Frappe, Fruit Soda & Lemonade
- **Appetizers** (4): Nachos, Fries, Siomai, Calamares  
- **Pasta & Noodles** (6): Spag Solo, Spag & Chicken, Ramyeon, Samyang Carbonara, Samyang Carbonara & Chicken, Tteokbokki
- **Chicken** (3): Chicken Meal, Chicken Platter, Chicken Burger
- **Rice Meals** (1): Silog
- **Breakfast** (1): Waffles
- **Sandwiches** (2): Clubhouse, Footlong
- **Simple Items** (3): Spam Musubi, Sushi, Caesar Salad

---

## How to Run Migrations

### Method 1: Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New Query"

3. **Run Migration**
   - Open: `supabase/migrations/012_Seed_Bite_Bonanza_Menu_Variants.sql`
   - Copy ALL contents
   - Paste into SQL Editor
   - Click "Run" (or Ctrl+Enter / Cmd+Enter)

4. **Wait for Completion**
   - Migration should complete in a few seconds
   - Check for success messages

### Method 2: Supabase CLI

```bash
# Make sure you're logged in
supabase login

# Link to your project (if not already linked)
supabase link --project-ref <your-project-ref>

# Run the migration
supabase db push
```

### Method 3: Direct PostgreSQL Connection

```bash
psql -h <your-db-host> -U postgres -d postgres -f supabase/migrations/012_Seed_Bite_Bonanza_Menu_Variants.sql
```

---

## Verification

After running the migration, verify it worked:

```sql
-- Check total items created
SELECT COUNT(*) as total_items,
       COUNT(CASE WHEN has_variants THEN 1 END) as items_with_variants
FROM menu_items_base;
```

**Expected Results:**
- Total items: 24
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

## Testing in Application

After migration:

1. **Navigate to Order Portal**
   - Go to: `/customer/order-portal`
   - Login as a customer

2. **Test Variant Selection**
   - Click on items like "Milktea", "Fries", "Chicken Meal"
   - Variant selection modal should appear
   - Required variants marked with red asterisk (*)
   - Can select multiple add-ons

3. **Verify Functionality**
   - Select variants and add to cart
   - Check that variants show in cart
   - Verify prices update with modifiers
   - Complete checkout with variant items

---

## Rollback

If you need to rollback the migration:

```sql
-- WARNING: This will delete all menu item data

-- Delete all variant options
DELETE FROM menu_item_variant_options;

-- Delete all variant types  
DELETE FROM menu_item_variant_types;

-- Delete all base menu items
DELETE FROM menu_items_base;

-- Drop tables (optional)
DROP TABLE IF EXISTS menu_item_variant_options CASCADE;
DROP TABLE IF EXISTS menu_item_variant_types CASCADE;
DROP TABLE IF EXISTS menu_items_base CASCADE;
```

---

## Troubleshooting

### Error: "table already exists"
**Solution:** This is fine. The migration uses `CREATE TABLE IF NOT EXISTS` which is safe.

### Error: "duplicate key value"
**Solution:** Items already exist. The migration uses `ON CONFLICT DO NOTHING` which is safe.

### Variants not showing in UI
**Check:**
1. Migration completed successfully (run verification queries)
2. Browser cache cleared
3. Logged in as customer role
4. No JavaScript errors in browser console

---

## Migration Details

**File:** `012_Seed_Bite_Bonanza_Menu_Variants.sql`
**Size:** ~60KB
**Lines:** ~1,000+
**Safe to rerun:** Yes (idempotent)
**Dependencies:** Requires `users` table to exist for RLS policies

---

## Support

For additional help, see:
- `../QUICK_START.md` - Quick migration guide
- `../APPLY_MIGRATION_NOW.md` - Detailed step-by-step instructions
- `../MENU_VARIANTS_IMPLEMENTATION.md` - Technical implementation details
- `../scripts/README.md` - Alternative migration methods

---

**Last Updated:** 2026-04-24
