# Cashier Interface Fix - Migration Guide

## Summary
This document describes the fixes applied to resolve the cashier interface issues including menu items not loading, database errors, and missing features.

## Issues Fixed

### 1. Menu Items Not Visible in Cashier's Interface
**Problem**: The code was querying `menu_items` table but the database had `menu_items_base` table.

**Solution**: Created database views to map old table names to new schema:
- `menu_items` view → maps to `menu_items_base` table
- `menu_item_variants` view → maps to `menu_item_variant_types` table

### 2. Duplicate Key Constraint Violation (409 Error)
**Problem**: `cashier_settings` table was getting duplicate key errors when toggling delivery service.

**Error Message**:
```
duplicate key value violates unique constraint "cashier_settings_setting_key_key"
```

**Solution**: 
- Updated RLS policy to properly handle upserts
- Ensured unique index exists on `setting_key`
- Used `ON CONFLICT DO NOTHING` when inserting default settings

### 3. Infinite Recursion in RLS Policies (500 Error)
**Problem**: RLS policies had circular dependencies causing infinite recursion.

**Error Message**:
```
infinite recursion detected in policy for relation "profiles"
```

**Solution**: Simplified RLS policies to avoid circular references in the `users` table join.

### 4. Menu Items Query Returning 400 Error
**Problem**: The query included nested relationships that didn't match the database schema.

**Solution**: Created views with INSTEAD OF triggers to make them fully updatable and compatible with the existing query structure.

## Migration Steps

### Step 1: Run the Migration SQL
Execute the migration file in your Supabase SQL Editor:

```bash
# File: supabase/migrations/023_fix_cashier_interface_issues.sql
```

The migration will:
1. Create `menu_items` and `menu_item_variants` views
2. Add INSTEAD OF triggers to make views updatable
3. Fix RLS policies for `cashier_settings`
4. Fix RLS policies to prevent infinite recursion
5. Grant necessary permissions
6. Initialize default cashier settings

### Step 2: Verify the Migration

#### Check Views
Run this query to verify views were created:
```sql
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('menu_items', 'menu_item_variants');
```

Expected output:
```
table_name          | table_type
--------------------|------------
menu_items          | VIEW
menu_item_variants  | VIEW
```

#### Check Triggers
Verify triggers were created:
```sql
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE event_object_table IN ('menu_items');
```

Expected output:
```
trigger_name                  | event_object_table
------------------------------|-------------------
menu_items_insert_trigger     | menu_items
menu_items_update_trigger     | menu_items
menu_items_delete_trigger     | menu_items
```

#### Check Cashier Settings
Verify default settings exist:
```sql
SELECT * FROM cashier_settings;
```

Expected output:
```
id | setting_key      | setting_value | description
---|------------------|---------------|----------------------------------
...| delivery_enabled | true          | Whether delivery orders are...
...| sold_out_items   | []            | JSON array of menu item IDs...
```

### Step 3: Test the Features

#### Test 1: Menu Loading in POS
1. Login as cashier
2. Navigate to `/cashier/pos`
3. Verify menu items are visible
4. Check console for no errors

#### Test 2: Delivery Service Toggle
1. Navigate to `/cashier/settings`
2. Toggle "Delivery is ENABLED/DISABLED" switch
3. Verify no 409 errors in console
4. Verify the toggle state persists after refresh

#### Test 3: Sold Out Toggle
1. Navigate to `/cashier/settings`
2. Click "Sold Out" button on any menu item
3. Verify item shows "SOLD OUT" badge
4. Verify no 500 errors in console
5. Go to POS and verify sold out items:
   - Show as grayed out
   - Display "SOLD OUT" badge
   - Cannot be added to cart (alert shown)

#### Test 4: Customer Portal
1. Navigate to `/customer/order`
2. Verify sold out items are NOT shown in menu
3. Verify only available items can be ordered

## New Features Added

### 1. Delivery Service Toggle
**Location**: Cashier Settings (`/cashier/settings`)

**Description**: Allows cashiers to enable/disable delivery service when no riders are available.

**Usage**:
- Toggle switch shows current state: "Delivery is ENABLED" or "Delivery is DISABLED"
- Changes are saved immediately to database
- All users see updated delivery availability

### 2. Sold Out Item Management
**Location**: Cashier Settings (`/cashier/settings`)

**Description**: Allows cashiers to mark items as sold out temporarily.

**Usage**:
- Each menu item has an "Available" or "Sold Out" button
- Click to toggle between states
- Sold out items:
  - Show "SOLD OUT" badge in POS (grayed out)
  - Cannot be added to cart in POS
  - Are hidden from customer order portal
- Changes take effect immediately

## Database Schema Changes

### New Columns
```sql
-- Added to menu_items_base table
ALTER TABLE menu_items_base ADD COLUMN is_sold_out BOOLEAN DEFAULT FALSE;
```

### New Tables
```sql
-- Already existed, but documented here for reference
CREATE TABLE cashier_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### New Views
```sql
-- View for backward compatibility
CREATE VIEW menu_items AS
SELECT 
  id, name, category, base_price AS price, base_price,
  image_url, description, available, has_variants, is_sold_out,
  created_at, updated_at
FROM menu_items_base;

-- View for variant types
CREATE VIEW menu_item_variants AS
SELECT 
  id, menu_item_id, variant_type_name, is_required,
  allow_multiple, display_order, created_at
FROM menu_item_variant_types;
```

## Code Changes

### Files Modified

1. **supabase/migrations/023_fix_cashier_interface_issues.sql**
   - New migration file with all database fixes

2. **pages/cashier/pos.js**
   - Added `is_sold_out` to menu items query
   - Added sold out check in `handleAddItem()`
   - Added sold out badge and styling
   - Disabled sold out items visually

3. **app/customer/order/page.tsx**
   - Added `.eq('is_sold_out', false)` filter to hide sold out items from customers

4. **pages/cashier/settings.js**
   - Already had the sold out toggle functionality
   - Now works correctly with fixed database schema

## Troubleshooting

### Issue: Menu items still not showing
**Solution**: 
1. Check if migration ran successfully
2. Verify views exist: `SELECT * FROM menu_items LIMIT 1;`
3. Check RLS policies allow viewing

### Issue: Still getting 409 errors on delivery toggle
**Solution**:
1. Check if unique index exists: `\d cashier_settings`
2. Verify RLS policy was updated
3. Clear any duplicate rows: 
   ```sql
   DELETE FROM cashier_settings 
   WHERE id NOT IN (
     SELECT MIN(id) FROM cashier_settings GROUP BY setting_key
   );
   ```

### Issue: Sold out toggle returns 500 error
**Solution**:
1. Check RLS policies don't have circular references
2. Verify `is_sold_out` column exists in `menu_items_base`
3. Check if user has proper role (admin or cashier)

### Issue: Customer still sees sold out items
**Solution**:
1. Clear browser cache
2. Verify query includes `.eq('is_sold_out', false)`
3. Check database values: `SELECT id, name, is_sold_out FROM menu_items_base;`

## Rollback Plan

If issues occur, you can rollback the changes:

```sql
-- Drop views
DROP VIEW IF EXISTS menu_items CASCADE;
DROP VIEW IF EXISTS menu_item_variants CASCADE;

-- Drop trigger functions
DROP FUNCTION IF EXISTS menu_items_insert() CASCADE;
DROP FUNCTION IF EXISTS menu_items_update() CASCADE;
DROP FUNCTION IF EXISTS menu_items_delete() CASCADE;

-- Remove column (optional - only if causing issues)
ALTER TABLE menu_items_base DROP COLUMN IF EXISTS is_sold_out;

-- Revert RLS policies (restore original policies from previous migration)
```

## Success Criteria

All of the following should be true after migration:

- ✅ Cashier POS shows menu items (no "No menu items available")
- ✅ No 400 errors for menu items query
- ✅ No 409 errors when toggling delivery service
- ✅ No 500 errors when toggling sold out status
- ✅ Delivery toggle saves and persists state
- ✅ Sold out items show badge in POS
- ✅ Sold out items cannot be added to cart in POS
- ✅ Sold out items are hidden from customer portal
- ✅ No console errors in browser developer tools

## Support

If you encounter any issues not covered in this guide:

1. Check browser console for detailed error messages
2. Check Supabase logs for database errors
3. Verify all migration steps were completed
4. Review the RLS policies for your user role
5. Ensure your user has 'cashier' or 'admin' role in the users table

---

**Migration File**: `supabase/migrations/023_fix_cashier_interface_issues.sql`  
**Date**: 2026-04-27  
**Author**: GitHub Copilot Cloud Agent
