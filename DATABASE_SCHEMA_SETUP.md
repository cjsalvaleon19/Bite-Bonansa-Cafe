# Database Schema Setup Guide

This guide explains how to set up the Bite Bonansa Cafe database schema in Supabase.

## Quick Start

If you're setting up a fresh database, run these SQL files in order:

1. `database_schema.sql` - Base schema (users, orders, menu items, etc.)
2. `database_complete_schema.sql` - Customer portal tables (loyalty, purchases, reviews)
3. `database_schema_updates.sql` - Additional columns and features
4. `menu_items_insert.sql` - Sample menu items (optional)

## Schema Files Overview

### Core Schema Files

#### 1. `database_schema.sql` (21KB)
**Purpose:** Base database schema with all essential tables

**Contains:**
- `users` table - User accounts and profiles
- `orders` table - Customer orders
- `menu_items` table - Restaurant menu
- `riders` table - Delivery rider profiles
- `deliveries` table - Delivery assignments
- Row Level Security (RLS) policies

**When to use:** Initial database setup or complete reset

---

#### 2. `database_complete_schema.sql` (12KB)
**Purpose:** Customer portal tables and delivery fee functions

**Contains:**
- `loyalty_transactions` table - Points tracking
- `customer_item_purchases` table - Purchase history
- `customer_reviews` table - Customer reviews
- `calculate_distance_meters()` function - Haversine distance
- `calculate_delivery_fee()` function - Fee calculation
- `calculate_delivery_fee_from_store()` function - Convenience wrapper
- Automatic triggers for purchase/loyalty tracking
- RLS policies for all tables

**When to use:** After base schema is set up, to enable customer portal features

**Important:** This file is required to fix the following errors:
- `Could not find the table 'public.loyalty_transactions'`
- `Could not find the table 'public.customer_item_purchases'`

---

#### 3. `database_schema_updates.sql` (19KB)
**Purpose:** Additional columns and features for all portals

**Contains:**
- Orders table additions:
  - `order_mode` - 'delivery', 'dine-in', 'take-out', 'pick-up'
  - `order_number` - Unique order number
  - `customer_name` - Customer full name
  - `contact_number` - Contact number
  - `delivery_latitude` - GPS latitude
  - `delivery_longitude` - GPS longitude
- `cash_drawer_transactions` table - Cashier cash management
- `delivery_billing_notifications` table - Rider billing
- `delivery_reports` table - Daily delivery reports
- Users table additions:
  - `cashier_id` - Cashier identification

**When to use:** After base schema, to add enhanced features for cashier and rider portals

---

### Utility Files

#### 4. `database_role_and_schema_fixes.sql` (8.7KB)
**Purpose:** Permission fixes and role-based policies

**When to use:** If you encounter permission errors or need to reset RLS policies

---

#### 5. `delivery_fee_calculator_test.sql` (3.8KB)
**Purpose:** Test queries for delivery fee calculation

**When to use:** To verify delivery fee functions work correctly

---

#### 6. `menu_items_insert.sql` (20KB)
**Purpose:** Sample menu items with prices and descriptions

**When to use:** For testing or to populate initial menu

---

## Step-by-Step Setup Instructions

### For a New Database

1. **Login to Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

3. **Run Schema Files in Order**

   **Step 1:** Copy and paste contents of `database_schema.sql`
   - Click "Run" or press Ctrl+Enter
   - Wait for "Success" message
   
   **Step 2:** Copy and paste contents of `database_complete_schema.sql`
   - Click "Run" or press Ctrl+Enter
   - Wait for "Success" message
   
   **Step 3:** Copy and paste contents of `database_schema_updates.sql`
   - Click "Run" or press Ctrl+Enter
   - Wait for "Success" message
   
   **Step 4 (Optional):** Copy and paste contents of `menu_items_insert.sql`
   - Click "Run" or press Ctrl+Enter
   - Wait for "Success" message

4. **Verify Tables Created**
   - Click "Table Editor" in the left sidebar
   - You should see all tables listed:
     - users
     - orders
     - menu_items
     - riders
     - deliveries
     - loyalty_transactions ✓
     - customer_item_purchases ✓
     - customer_reviews ✓
     - cash_drawer_transactions
     - delivery_reports
     - delivery_billing_notifications

5. **Test SQL Functions**
   - Go back to SQL Editor
   - Run test queries from `delivery_fee_calculator_test.sql`
   - Verify all functions return expected results

---

### For Existing Database (Update Only)

If you already have a database and just need to add the missing tables:

1. **Check What's Missing**
   - Go to Table Editor in Supabase
   - Look for these tables:
     - `loyalty_transactions`
     - `customer_item_purchases`
     - `customer_reviews`
   - If any are missing, proceed to next step

2. **Run Only Required Updates**
   
   **If missing customer portal tables:**
   - Run `database_complete_schema.sql` only
   
   **If missing order columns (delivery_latitude, delivery_longitude):**
   - Run `database_schema_updates.sql` only
   
   **Note:** All `ALTER TABLE ADD COLUMN` statements use `IF NOT EXISTS`, so it's safe to run even if columns already exist.

3. **Verify Functions Exist**
   - Go to SQL Editor
   - Run this query:
   ```sql
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_schema = 'public' 
   AND routine_name LIKE 'calculate%';
   ```
   - Should return:
     - calculate_distance_meters
     - calculate_delivery_fee
     - calculate_delivery_fee_from_store
   
   If any are missing, run `database_complete_schema.sql` again.

---

## Troubleshooting

### Error: "table already exists"
**Solution:** This is normal if running schema files multiple times. The error is harmless because of `IF NOT EXISTS` clauses.

### Error: "column already exists"
**Solution:** Same as above - harmless due to `IF NOT EXISTS` clauses.

### Error: "permission denied"
**Solution:** Run `database_role_and_schema_fixes.sql` to fix RLS policies.

### Error: "function does not exist"
**Solution:** Run `database_complete_schema.sql` to create all functions.

### Tables exist but still getting 404 errors
**Solution:** Check Row Level Security (RLS) policies:
1. Go to Authentication → Policies in Supabase
2. Verify policies exist for:
   - loyalty_transactions
   - customer_item_purchases
   - customer_reviews
3. If missing, run `database_complete_schema.sql` again

---

## Verification Checklist

After running all schema files, verify the following:

### Tables
- [ ] `users` table exists
- [ ] `orders` table exists with all columns (including delivery_latitude, delivery_longitude)
- [ ] `menu_items` table exists
- [ ] `loyalty_transactions` table exists ✓
- [ ] `customer_item_purchases` table exists ✓
- [ ] `customer_reviews` table exists ✓
- [ ] `riders` table exists
- [ ] `deliveries` table exists
- [ ] `cash_drawer_transactions` table exists
- [ ] `delivery_reports` table exists

### Functions
- [ ] `calculate_distance_meters()` exists
- [ ] `calculate_delivery_fee()` exists
- [ ] `calculate_delivery_fee_from_store()` exists

### Triggers
- [ ] `trigger_update_customer_purchases` exists on orders table
- [ ] `trigger_add_loyalty_points` exists on orders table

### RLS Policies
- [ ] All tables have RLS enabled
- [ ] Policies allow customers to view their own data
- [ ] Policies allow staff (admin, cashier) to view all data

---

## Testing the Setup

### Test 1: Delivery Fee Calculation
```sql
-- Test distance calculation (should return ~1000m)
SELECT calculate_distance_meters(6.2178483, 124.8221226, 6.2188483, 124.8231226);

-- Test fee calculation for 1km (should return 30.00)
SELECT calculate_delivery_fee(1000);

-- Test fee calculation for 5km (should return 66.00)
SELECT calculate_delivery_fee(5000);

-- Test fee from store to a location
SELECT calculate_delivery_fee_from_store(6.2188483, 124.8231226);
```

### Test 2: Customer Portal Tables
```sql
-- Check if tables are accessible
SELECT COUNT(*) FROM loyalty_transactions;
SELECT COUNT(*) FROM customer_item_purchases;
SELECT COUNT(*) FROM customer_reviews;
```

### Test 3: Check RLS Policies
```sql
-- List all policies
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

---

## Next Steps After Database Setup

1. ✅ Set up Google Maps API key (see FIXES_APPLIED_SUMMARY.md)
2. ✅ Update `.env.local` with your API key
3. ✅ Deploy the application
4. ✅ Test customer portal features
5. ✅ Test checkout with location selection
6. ✅ Verify delivery fee calculation

---

## Additional Notes

- **Idempotent Scripts:** All schema files use `IF NOT EXISTS` clauses, making them safe to run multiple times
- **No Data Loss:** Running schema updates will not delete existing data
- **Backup Recommended:** Always backup your database before running schema changes in production
- **Development vs Production:** Test schema changes in a development environment first

---

## Support

If you encounter issues:
1. Check the error message in Supabase SQL Editor
2. Verify your role has sufficient permissions
3. Check the troubleshooting section above
4. Review the FIXES_APPLIED_SUMMARY.md for error resolution
