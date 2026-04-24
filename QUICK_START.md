# 🎯 QUICK START: Fix Menu Subcategories Issue

## The Problem
Menu subcategories (variants) are not showing for customers to choose from in the order portal.

## The Solution
Run 2 SQL migration files in your Supabase database.

---

## ⚡ 5-Minute Fix

### 1️⃣ Open Supabase Dashboard
Go to: https://supabase.com/dashboard → Select your project → SQL Editor

### 2️⃣ Run First Migration
- Click: "New Query"
- Open file: `migrate_menu_variants.sql`
- Copy ALL → Paste → Click "Run" ✅

### 3️⃣ Run Second Migration
- Click: "New Query" again
- Open file: `complete_menu_variants_migration.sql`
- Copy ALL → Paste → Click "Run" ✅

### 4️⃣ Test
Go to `/customer/order-portal` and click any menu item.
**Variant selection modal should now appear!** 🎉

---

## 📋 What You'll Get

After running both migrations, customers can choose:

**Milktea** → Size + Add-ons  
**Fries** → Flavor + Add-ons  
**Chicken Meal** → Flavor + Add-ons  
**Ramyeon** → Solo/Overload + Spicy Level + Add-ons  
**Silog** → Variety (8 choices) + Add-ons  
**And 19 more items...**

**Total: 24 menu items** (21 with variants, 3 simple items)

---

## ✅ Verify It Worked

Run this in SQL Editor:
```sql
SELECT COUNT(*) FROM menu_items_base;
```
**Should see:** 24 items

---

## 📚 Need More Help?

| Document | When to Read |
|----------|-------------|
| `APPLY_MIGRATION_NOW.md` | Detailed step-by-step guide |
| `MENU_SUBCATEGORIES_FIX_SUMMARY.md` | Complete technical overview |
| `scripts/README.md` | Alternative approaches |
| `MENU_VARIANTS_MIGRATION_GUIDE.md` | Full migration reference |

---

## 🆘 Troubleshooting

**Q: Error "table menu_items_base does not exist"**  
A: Run `menu_variants_schema.sql` first to create tables

**Q: Variants still not showing**  
A: Clear browser cache, refresh page, check console for errors

**Q: "duplicate key value" error**  
A: This is safe to ignore (migrations use ON CONFLICT DO NOTHING)

---

## 📂 Files You Need

✅ `migrate_menu_variants.sql` - First migration (base items)  
✅ `complete_menu_variants_migration.sql` - Second migration (complete variants)  
✅ Both files already exist in your repository

---

## ⏱️ Time Required
**5 minutes** to apply both migrations

## 🎯 Risk Level
**🟢 LOW** - Safe, idempotent, tested

## 💡 Key Point
**Run BOTH files in order for complete menu coverage!**

---

**Created:** 2026-04-24  
**Status:** ✅ Ready to deploy  
**Action:** Run the 2 SQL files via Supabase Dashboard
