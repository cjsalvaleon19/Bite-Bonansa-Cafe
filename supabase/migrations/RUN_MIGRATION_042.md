# Migration 042: Create Missing Loyalty and Purchase Tracking Tables

## Purpose
This migration fixes two critical errors in the application:

1. **Customer Dashboard Purchase History Error**:
   ```
   [CustomerDashboard] Error fetching purchase history: Could not find a relationship 
   between 'customer_item_purchases' and 'menu_items' in the schema cache
   ```

2. **Orders Queue Pickup Completion Error**:
   ```
   [OrdersQueue] Failed to complete pickup order: column "balance_after" does not exist
   ```

## What This Migration Does

### 1. Creates `loyalty_transactions` Table
- Tracks customer loyalty points (earned/spent)
- **Includes the `balance_after` column** that was missing and causing pickup order completion failures
- Supports transaction types: 'earned', 'spent', 'adjustment'
- Links to orders and customers with proper foreign keys

### 2. Creates `customer_item_purchases` Table
- Tracks purchase history for each customer
- **Has a proper foreign key relationship to `menu_items`** (fixes the schema cache error)
- Stores purchase count, last purchased date, and total spent
- Unique constraint ensures one row per customer-item pair

### 3. Creates `customer_reviews` Table
- Prepared for future review functionality
- Supports star ratings (1-5), text reviews, and image uploads
- Has status workflow: pending → published/archived

### 4. Row Level Security (RLS) Policies
- Customers can only view their own data
- Staff (admin/cashier) can view all data
- System can manage all operations

## How to Apply This Migration

### Option 1: Using Supabase Dashboard (Recommended for Production)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the migration file:
   ```
   supabase/migrations/042_create_missing_loyalty_and_purchase_tables.sql
   ```
4. Copy the entire contents
5. Paste into the SQL Editor
6. Click **Run** to execute the migration
7. Verify success in the output panel

### Option 2: Using Supabase CLI (For Local Development)
```bash
# If you have Supabase CLI installed
supabase db push

# Or apply this specific migration
supabase migration up
```

### Option 3: Manual Application
If you have direct database access:
```bash
psql -h your-db-host -U postgres -d postgres < supabase/migrations/042_create_missing_loyalty_and_purchase_tables.sql
```

## Verification Steps

After applying the migration, verify it worked:

### 1. Check Tables Were Created
Run this query in the SQL Editor:
```sql
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('loyalty_transactions', 'customer_item_purchases', 'customer_reviews')
ORDER BY table_name;
```

Expected result: 3 rows showing all three tables.

### 2. Verify Foreign Key Relationships
```sql
SELECT 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'customer_item_purchases';
```

Expected result: Should show relationships to `users` and `menu_items`.

### 3. Check Column Exists
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'loyalty_transactions' 
  AND column_name = 'balance_after';
```

Expected result: 1 row showing `balance_after | numeric`.

### 4. Test Customer Dashboard
1. Log in as a customer
2. Navigate to the customer dashboard
3. The "Most Purchased Items" section should load without errors
4. Check browser console for errors (should be none)

### 5. Test Pickup Order Completion
1. Log in as a cashier
2. Go to Orders Queue
3. Create a test pickup order (or use existing one)
4. Mark order as "Ready for Pick-up"
5. Click "Order Complete"
6. Should complete successfully without the "balance_after" error

## Expected Impact

### Immediate Fixes
- ✅ Customer Dashboard will load purchase history without errors
- ✅ Cashiers can complete pickup orders without errors
- ✅ Loyalty points system is ready for implementation

### Future Enhancements Enabled
- Customer purchase history tracking
- Loyalty points earning and redemption
- Customer reviews and ratings system
- Personalized recommendations based on purchase history

## Rollback (If Needed)

If you need to undo this migration:
```sql
-- Drop tables in reverse order (respecting foreign keys)
DROP TABLE IF EXISTS customer_reviews CASCADE;
DROP TABLE IF EXISTS customer_item_purchases CASCADE;
DROP TABLE IF EXISTS loyalty_transactions CASCADE;

-- Drop helper function
DROP FUNCTION IF EXISTS update_customer_purchase_history() CASCADE;
```

## Related Files

### Frontend Files That Use These Tables
- `pages/customer/dashboard.js` - Uses `customer_item_purchases` and `loyalty_transactions`
- `pages/cashier/orders-queue.js` - Updates `loyalty_transactions` (needs balance_after column)

### Schema Documentation
- `database_complete_schema.sql` - Reference schema (this migration aligns with it)

## Notes

- This migration is **idempotent** - safe to run multiple times
- Uses `IF NOT EXISTS` clauses to prevent errors if tables already exist
- All tables have RLS enabled for security
- Indexes are created for optimal query performance
- The migration includes a helper function for future automation (currently commented out)

## Support

If you encounter issues:
1. Check Supabase logs for detailed error messages
2. Verify your database user has sufficient permissions
3. Ensure the `users` and `menu_items` tables exist before running this migration
4. Contact support with the specific error message
