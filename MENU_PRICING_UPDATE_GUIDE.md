# Menu Pricing Update Guide

## Overview
This guide explains the menu pricing update migration (`013_Update_Menu_Pricing_Complete.sql`) that updates all menu items, prices, and variants according to the latest pricing spreadsheet.

## What's Updated

### Summary
- **Total Items**: 21 menu items
- **Categories**: 4 (Snacks & Bites, Noodles, Chicken, Rice & More)
- **Pricing**: All prices updated to match current pricing structure
- **Variants**: Complete variant system with sizes, flavors, spice levels, add-ons

### Menu Items by Category

#### Snacks & Bites (4 items)
1. **Nachos** - ₱94
   - Variants: Sauce (Sinamak, Meaty Sauce, Mayonnaise)
   
2. **Fries** - ₱94
   - Variants: Flavor (Cheese, Meaty Sauce, Sour Cream, Barbeque)
   
3. **Siomai** - ₱74
   - Variants: Variety (Steamed, Fried) + Spice Level (Spicy, Regular)
   
4. **Calamares** - ₱94
   - Variants: Sauce (Meaty Sauce, Sinamak, Mayonnaise)

#### Noodles (9 items)
5. **Spag Solo** - ₱94
   - Add Ons: Meaty Sauce (+₱15)
   
6. **Spag & Chicken** - ₱134
   - Add Ons: Meaty Sauce (+₱15)
   
7. **Ramyeon Solo** - ₱104
   - Variants: Spice Level (Mild, Spicy)
   - Add Ons: Spam (+₱20), Egg (+₱15), Cheese (+₱20)
   
8. **Ramyeon Overload** - ₱139
   - Variants: Spice Level (Mild, Spicy)
   - Add Ons: Spam (+₱20), Egg (+₱15), Cheese (+₱20)
   
9. **Samyang Carbonara Solo** - ₱134-139
   - Variants: Spice Level (Mild, Spicy)
   - Add Ons: Spam (+₱20), Egg (+₱15), Cheese (+₱20)
   
10. **Samyang Carbonara Overload** - ₱174
    - Variants: Spice Level (Mild, Spicy)
    - Add Ons: Spam (+₱20), Egg (+₱15), Cheese (+₱20)
    
11. **Samyang Carbonara & Chicken** - ₱174
    - Variants: Spice Level (Mild, Spicy)
    - Add Ons: Spam (+₱20), Egg (+₱15), Cheese (+₱20)
    
12. **Tteokbokki Solo** - ₱144
    - Variants: Spice Level (Mild, Spicy)
    - Add Ons: Spam (+₱20), Egg (+₱15), Cheese (+₱20)
    
13. **Tteokbokki Overload** - ₱179
    - Variants: Spice Level (Mild, Spicy)
    - Add Ons: Spam (+₱20), Egg (+₱15), Cheese (+₱20)

#### Chicken (3 items)
14. **Chicken Meals** - ₱84
    - Variants: Flavor (Honey Butter, Soy Garlic, Sweet & Sour, Sweet & Spicy, Teriyaki, Buffalo, Barbecue)
    - Add Ons: Rice (+₱15)
    
15. **Chicken Platter** - ₱254
    - Variants: Flavor (Honey Butter, Soy Garlic, Sweet & Sour, Sweet & Spicy, Teriyaki, Buffalo, Barbecue)
    - Add Ons: Rice (+₱15)
    
16. **Chicken Burger** - ₱104
    - Variants: Flavor (Honey Butter, Soy Garlic, Sweet & Sour, Sweet & Spicy, Teriyaki, Buffalo, Barbecue, Original)

#### Rice & More (5 items)
17. **Silog Meals** - ₱114
    - Variants: Variety (Luncheonsilog, Tapsilog, Tocilog, Cornsilog, Chicsilog, Hotsilog, Siomaisilog)
    
18. **Waffles** - ₱104
    - Variants: Variety (Biscoff, Strawberry, Oreo, Mallows)
    
19. **Clubhouse** - ₱104
    - Add Ons: No vegies, Spam (+₱15)
    
20. **Footlong** - ₱94
    - Variants: Spice Level (Regular, Spicy)
    - Add Ons: No vegies
    
21. **Spam Musubi** - ₱104
    - No variants

## How to Apply This Migration

### Option 1: Using Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy the contents of `supabase/migrations/013_Update_Menu_Pricing_Complete.sql`
4. Paste into the SQL Editor
5. Click "Run" to execute

### Option 2: Using Supabase CLI
```bash
# Make sure you're in the project directory
cd /path/to/Bite-Bonansa-Cafe

# Run the migration
supabase db push

# Or apply specific migration
supabase migration up
```

### Option 3: Manual SQL Execution
```bash
psql -h <your-db-host> -U <your-db-user> -d <your-database> -f supabase/migrations/013_Update_Menu_Pricing_Complete.sql
```

## Important Notes

⚠️ **WARNING**: This migration will:
- **DELETE all existing menu items** and their variants
- **Recreate the entire menu** with new pricing
- This is a destructive operation - make sure to backup your data first

### Pre-Migration Checklist
- [ ] Backup your database
- [ ] Ensure no active orders are in progress
- [ ] Notify staff of menu changes
- [ ] Test in a development environment first

### Post-Migration Verification
1. Verify all 21 items are in the database
2. Check that variant types are correctly assigned
3. Test variant selection in the customer portal
4. Verify pricing calculations include add-ons correctly

## Database Schema

The migration works with three tables:

1. **menu_items_base** - Base menu items with `has_variants` flag
2. **menu_item_variant_types** - Types of variants (Flavor, Size, Add Ons, etc.)
3. **menu_item_variant_options** - Specific options with price modifiers

## Kitchen Department Assignment

Based on the spreadsheet:
- **Fryer 1**: Nachos, Fries, Calamares, Spag, Ramyeon, Samyang, Tteokbokki, Chicken items
- **Fryer 2**: Siomai, Clubhouse, Footlong, Spam Musubi
- **Pastries**: Waffles

Note: Kitchen department tracking may require additional implementation beyond this migration.

## Troubleshooting

### Common Issues

**Issue**: "relation menu_items_base does not exist"
- **Solution**: Run the schema creation migration first (`012_Seed_Bite_Bonanza_Menu_Variants.sql` or `menu_variants_schema.sql`)

**Issue**: "duplicate key value violates unique constraint"
- **Solution**: The migration should handle this with `ON CONFLICT DO NOTHING`, but if issues persist, manually delete existing data first

**Issue**: Variants not showing in UI
- **Solution**: Ensure `has_variants` is set to `true` and at least one variant type exists

## Contact
For issues or questions, contact the development team or create an issue in the repository.
