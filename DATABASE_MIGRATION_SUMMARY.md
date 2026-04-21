# Database Migration Summary

## Overview

This document summarizes the database schema updates required to fix the errors reported in the browser console and ensure the Bite Bonansa Cafe application works correctly.

## Errors Addressed

The following errors were reported and have been fixed by the database migration:

### 1. Missing Tables (404 Errors)
- ❌ `loyalty_transactions` - Table not found
- ❌ `customer_item_purchases` - Table not found  
- ❌ `customer_reviews` - Table not found

### 2. Storage Errors (400 Errors)
- ❌ `reviews` storage bucket - Bucket not found

### 3. Orders Endpoint (400 Errors)
- ❌ Missing columns in `orders` table
- ❌ Potential RLS policy issues

## Solution

A comprehensive database migration file has been created: **`database_complete_migration.sql`**

### What It Does

The migration script:

1. **Updates the `users` table** with required columns:
   - `role` (admin, cashier, rider, customer)
   - `loyalty_balance` (for loyalty points)
   - `customer_id` (unique customer identifier)
   - `cashier_id` (cashier identification)
   - Additional profile fields

2. **Creates missing tables:**
   - `customer_item_purchases` - Tracks purchase history for recommendations
   - `customer_reviews` - Stores customer reviews with image support
   - `loyalty_transactions` - Tracks loyalty points earned/spent
   - `cash_drawer_transactions` - Cashier cash management
   - `delivery_reports` - Rider delivery fee billing
   - `delivery_billing_notifications` - Rider payment notifications
   - `deliveries` - Delivery order management
   - `riders` - Rider profile information

3. **Updates the `orders` table** with:
   - `order_mode` (dine-in, take-out, pick-up, delivery)
   - `order_number` (unique tracking number)
   - `customer_name` and `contact_number`

4. **Creates database functions:**
   - `calculate_earnings_percentage()` - 2% or 5% based on order amount
   - `calculate_distance_meters()` - Haversine formula for GPS distance
   - `calculate_delivery_fee()` - Distance-based fee calculation
   - `calculate_delivery_fee_from_store()` - Fee from store location
   - `update_customer_purchases()` - Auto-track purchase history
   - `add_loyalty_points()` - Auto-add points on order completion
   - `update_order_timestamps()` - Auto-update status timestamps

5. **Creates database triggers:**
   - Auto-update purchase counts when orders are delivered
   - Auto-add loyalty points when orders are delivered
   - Auto-update order timestamps on status changes

6. **Sets up Row Level Security (RLS):**
   - Customers can only see their own orders, reviews, and transactions
   - Staff can view/manage all data based on role
   - Riders can only see assigned deliveries
   - Cashiers can manage cash drawer and view billing

7. **Creates database views:**
   - `cashier_daily_stats` - Daily sales statistics for cashier dashboard

## Files Created/Updated

### New Files

1. **`database_complete_migration.sql`** (Primary migration file)
   - Complete database schema migration
   - All tables, functions, triggers, and RLS policies
   - Safe to run multiple times (idempotent)

2. **`SUPABASE_SETUP_COMPLETE.md`** (Setup guide)
   - Step-by-step Supabase setup instructions
   - Database migration steps
   - Storage bucket configuration
   - Verification queries
   - Troubleshooting tips

3. **`ERROR_REFERENCE.md`** (Quick error reference)
   - Common errors and solutions
   - Quick fix checklist
   - Verification queries
   - Troubleshooting guide

### Updated Files

1. **`README.md`**
   - Added database setup step to Getting Started
   - Points to comprehensive setup guide

2. **`DATABASE_SETUP_GUIDE.md`**
   - Updated with notice to use new comprehensive guide
   - Quick migration steps added

## Database Schema

### Complete Table List

After running the migration, you will have these tables:

1. `users` - User accounts with roles and profiles
2. `menu_items` - Cafe menu items
3. `orders` - Customer orders with full tracking
4. `customer_item_purchases` - Purchase history tracking
5. `customer_reviews` - Customer reviews with images
6. `loyalty_transactions` - Loyalty points transaction history
7. `cash_drawer_transactions` - Cashier cash management
8. `delivery_reports` - Rider delivery fee billing reports
9. `delivery_billing_notifications` - Rider payment notifications
10. `deliveries` - Delivery order assignments
11. `riders` - Rider profile information

### Functions Created

1. `calculate_earnings_percentage(order_subtotal)` - Returns 2% or 5%
2. `calculate_distance_meters(lat1, lon1, lat2, lon2)` - Haversine distance
3. `calculate_delivery_fee(distance_meters)` - ₱35 base + ₱10/200m
4. `calculate_delivery_fee_from_store(lat, lon)` - Fee from store coords
5. `update_customer_purchases()` - Trigger function for purchase tracking
6. `add_loyalty_points()` - Trigger function for loyalty points
7. `update_order_timestamps()` - Trigger function for status timestamps

### Views Created

1. `cashier_daily_stats` - Daily sales statistics

## Storage Configuration

### Reviews Bucket

A `reviews` storage bucket must be created for customer review images:

**Configuration:**
- Name: `reviews`
- Public: Yes (for public read access)
- Policies:
  1. Allow authenticated uploads (INSERT)
  2. Public read access (SELECT)
  3. Users can delete their own images (DELETE)

See [SUPABASE_SETUP_COMPLETE.md](./SUPABASE_SETUP_COMPLETE.md) for detailed storage setup.

## How to Apply

### For Local Development

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Create a new query
4. Copy the entire contents of `database_complete_migration.sql`
5. Paste and click **Run**
6. Follow storage setup in [SUPABASE_SETUP_COMPLETE.md](./SUPABASE_SETUP_COMPLETE.md)

### Verification

After running the migration, verify with these queries:

```sql
-- Check table count (should be 11+)
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- List all tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- List all functions
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
ORDER BY routine_name;
```

## Testing

After applying the migration:

1. ✅ Browser console should no longer show "table not found" errors
2. ✅ Customer dashboard should display loyalty balance
3. ✅ Purchase history should load correctly
4. ✅ Customer reviews page should work
5. ✅ Review image upload should work (after storage setup)
6. ✅ Orders should submit successfully
7. ✅ Loyalty points should auto-increment on order delivery

## Migration Safety

The migration is designed to be **safe and idempotent**:

- ✅ Uses `CREATE TABLE IF NOT EXISTS` - won't fail if table exists
- ✅ Uses `ALTER TABLE ADD COLUMN IF NOT EXISTS` - won't fail if column exists
- ✅ Uses `DROP POLICY IF EXISTS` before creating - safe to re-run
- ✅ Uses `DROP TRIGGER IF EXISTS` before creating - safe to re-run
- ✅ Uses `CREATE OR REPLACE FUNCTION` - safe to re-run
- ✅ No data deletion operations - existing data is preserved

**You can safely run this migration multiple times.**

## Rollback

If you need to undo the migration:

```sql
-- WARNING: This will delete all data in these tables!

DROP TABLE IF EXISTS delivery_billing_notifications CASCADE;
DROP TABLE IF EXISTS delivery_reports CASCADE;
DROP TABLE IF EXISTS deliveries CASCADE;
DROP TABLE IF EXISTS riders CASCADE;
DROP TABLE IF EXISTS cash_drawer_transactions CASCADE;
DROP TABLE IF EXISTS loyalty_transactions CASCADE;
DROP TABLE IF EXISTS customer_reviews CASCADE;
DROP TABLE IF EXISTS customer_item_purchases CASCADE;

DROP VIEW IF EXISTS cashier_daily_stats;

DROP FUNCTION IF EXISTS calculate_earnings_percentage(DECIMAL);
DROP FUNCTION IF EXISTS calculate_distance_meters(DECIMAL, DECIMAL, DECIMAL, DECIMAL);
DROP FUNCTION IF EXISTS calculate_delivery_fee(INT);
DROP FUNCTION IF EXISTS calculate_delivery_fee_from_store(DECIMAL, DECIMAL);
DROP FUNCTION IF EXISTS update_customer_purchases();
DROP FUNCTION IF EXISTS add_loyalty_points();
DROP FUNCTION IF EXISTS update_order_timestamps();

-- Note: This does NOT remove columns added to users/orders tables
-- Manual removal required if needed
```

## Support Documents

For detailed help, see:

1. **[SUPABASE_SETUP_COMPLETE.md](./SUPABASE_SETUP_COMPLETE.md)** - Complete setup guide with step-by-step instructions
2. **[ERROR_REFERENCE.md](./ERROR_REFERENCE.md)** - Quick reference for common errors and solutions
3. **[README.md](./README.md)** - Getting started and environment setup

## Known Limitations

1. **Storage bucket creation** - Must be done manually via Supabase Dashboard or API (not via SQL)
2. **Menu items** - Not included in this migration; use `menu_items_insert.sql` separately if needed
3. **User role assignment** - Requires manual update or registration logic

## Next Steps

After running the migration:

1. ✅ Set up the `reviews` storage bucket
2. ✅ Configure storage policies
3. ✅ Insert menu items (if not already done)
4. ✅ Test customer registration and login
5. ✅ Test order placement
6. ✅ Test review submission with images
7. ✅ Verify loyalty points are working

## Support

If you encounter issues:

1. Check [ERROR_REFERENCE.md](./ERROR_REFERENCE.md) for quick solutions
2. Review [SUPABASE_SETUP_COMPLETE.md](./SUPABASE_SETUP_COMPLETE.md) for detailed setup
3. Check Supabase logs: Dashboard → Database → Logs
4. Verify environment variables are correct
5. Clear browser cache and reload

## Change Log

**Version 1.0** (Current)
- Initial comprehensive migration
- All customer portal tables
- All rider portal tables  
- All cashier portal tables
- Loyalty system tables
- Review system with storage
- Delivery fee calculator functions
- Complete RLS policies
- Automated triggers for loyalty and purchases
