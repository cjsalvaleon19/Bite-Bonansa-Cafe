# Fix Rider Portal Errors - Database Tables Missing

## Problem Summary

The rider portal is failing with multiple errors because the required database tables don't exist:

### Missing Tables:
- `deliveries` - Tracks delivery assignments and status
- `delivery_reports` - Stores rider billing reports  
- `riders` - Missing `user_id` column (table exists but schema is outdated)

### Errors Observed:
```
Failed to load resource: the server responded with a status of 404 ()
Could not find the table 'public.deliveries' in the schema cache
Could not find the table 'public.delivery_reports' in the schema cache

Failed to load resource: the server responded with a status of 400 ()
column riders.user_id does not exist

insert or update on table "orders" violates foreign key constraint "orders_rider_id_fkey"
```

## Root Cause

Migrations **050** and **051** have not been run on the Supabase database. These migrations create the rider portal tables and fix type mismatches.

## Solution

You need to run the following migrations in order:

### 1. Migration 050: Create Rider Portal Tables
This migration creates:
- `riders` table with `user_id` column
- `deliveries` table for tracking deliveries
- `delivery_reports` table for billing
- Triggers for automatic notifications and earnings updates

### 2. Migration 051: Fix order_id Type Mismatch
This migration fixes a type mismatch in `deliveries.order_id` to match `orders.id` (TEXT type).

## How to Run the Migrations

### Option A: Using Supabase Dashboard (Recommended)

1. **Log in to your Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project: `bffpcgsevigxpldidxgl`

2. **Navigate to SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Run Migration 050**
   - Copy the entire contents of `supabase/migrations/050_create_rider_portal_tables.sql`
   - Paste into the SQL Editor
   - Click "Run" or press Ctrl+Enter
   - Wait for success message: "Migration 050 completed successfully!"

4. **Run Migration 051**
   - Clear the SQL Editor
   - Copy the entire contents of `supabase/migrations/051_fix_deliveries_rider_reference.sql`
   - Paste into the SQL Editor
   - Click "Run" or press Ctrl+Enter
   - Wait for success message: "Migration 051 completed successfully!"

5. **Verify Tables Created**
   - Go to "Table Editor" in the left sidebar
   - Confirm these tables exist:
     - `riders` (should have `user_id` column)
     - `deliveries` (should have `order_id` as TEXT, `rider_id` as UUID)
     - `delivery_reports`

### Option B: Using Supabase CLI

If you have Supabase CLI installed:

```bash
# Make sure you're in the project directory
cd /path/to/Bite-Bonansa-Cafe

# Link to your project (if not already linked)
supabase link --project-ref bffpcgsevigxpldidxgl

# Push migrations to Supabase
supabase db push

# Or run specific migrations
supabase migration up --db-url "your-database-url"
```

### Option C: Manual SQL Execution

If you prefer to run SQL commands directly:

1. Connect to your Supabase database using `psql` or another PostgreSQL client
2. Execute the SQL from migration 050:
   ```bash
   psql "your-connection-string" < supabase/migrations/050_create_rider_portal_tables.sql
   ```
3. Execute the SQL from migration 051:
   ```bash
   psql "your-connection-string" < supabase/migrations/051_fix_deliveries_rider_reference.sql
   ```

## What These Migrations Will Create

### `riders` Table
```sql
CREATE TABLE riders (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id),
  driver_id VARCHAR(50) UNIQUE NOT NULL,
  vehicle_type VARCHAR(50),
  vehicle_plate VARCHAR(20),
  cellphone_number VARCHAR(20),
  emergency_contact VARCHAR(255),
  emergency_phone VARCHAR(20),
  is_available BOOLEAN DEFAULT true,
  total_earnings DECIMAL(10,2) DEFAULT 0,
  deliveries_completed INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### `deliveries` Table
```sql
CREATE TABLE deliveries (
  id UUID PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),  -- Fixed to TEXT in migration 051
  rider_id UUID NOT NULL REFERENCES users(id),
  customer_name VARCHAR(255),
  customer_phone VARCHAR(20),
  customer_address TEXT NOT NULL,
  customer_latitude DECIMAL(10,8),
  customer_longitude DECIMAL(11,8),
  delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 50,
  distance_meters INT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  report_submitted BOOLEAN DEFAULT false,
  report_submitted_at TIMESTAMP,
  report_paid BOOLEAN DEFAULT false,
  report_paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  accepted_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  special_instructions TEXT,
  delivery_notes TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### `delivery_reports` Table
```sql
CREATE TABLE delivery_reports (
  id UUID PRIMARY KEY,
  rider_id UUID NOT NULL REFERENCES users(id),
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_deliveries INT NOT NULL DEFAULT 0,
  delivery_ids UUID[],
  total_delivery_fees DECIMAL(10,2) NOT NULL DEFAULT 0,
  rider_earnings DECIMAL(10,2) NOT NULL DEFAULT 0,
  business_revenue DECIMAL(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'submitted',
  submitted_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP,
  paid_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(rider_id, report_date)
);
```

## Automatic Features Enabled

After running these migrations, the following features will work automatically:

1. **Earnings Tracking**: When a delivery report is marked as paid, the rider's total earnings are automatically updated
2. **Delivery Count**: When a delivery is completed, the rider's delivery count increments automatically
3. **Notifications**: Cashiers are automatically notified when riders submit delivery reports
4. **Row Level Security**: Proper permissions ensure riders can only see/edit their own data

## Expected Outcome

After running these migrations:

✅ No more "Could not find the table 'public.deliveries'" errors  
✅ No more "Could not find the table 'public.delivery_reports'" errors  
✅ No more "column riders.user_id does not exist" errors  
✅ Rider Dashboard will load properly  
✅ Rider Deliveries page will work  
✅ Rider Reports page will function  
✅ Rider Profile page will display correctly  
✅ Order assignment to riders will work  

## Testing After Migration

1. **Test Rider Profile**:
   - Log in as rider: `johndave0991@bitebonansacafe.com`
   - Navigate to Rider > Profile
   - Verify profile loads without errors

2. **Test Rider Dashboard**:
   - Check that stats display (deliveries completed, total earnings)
   - Verify pending deliveries count shows

3. **Test Rider Deliveries**:
   - Navigate to Rider > Deliveries
   - Verify delivery list loads without errors

4. **Test Rider Reports**:
   - Navigate to Rider > Reports
   - Verify reports page loads without errors

5. **Test Order Assignment**:
   - As cashier, try assigning a rider to an order
   - Verify no foreign key constraint errors

## Troubleshooting

### If migration 050 fails with "users table does not exist":
- The migrations have prerequisite checks
- Ensure earlier migrations have been run first
- Check that `users`, `orders`, and `notifications` tables exist

### If migration 051 shows "deliveries table does not exist, skipping":
- This is normal if migration 050 hasn't been run yet
- Migration 051 will automatically skip and migration 050 will create the table correctly

### If you still see 404 errors after running migrations:
- Check Supabase API URL in your environment variables
- Verify RLS (Row Level Security) policies are enabled
- Check that the user has proper authentication

### If you see "relation does not exist" errors:
- The migrations might not have been applied to the correct database
- Verify you're connected to the right Supabase project
- Check the schema cache has been refreshed (may take a few seconds)

## Additional Notes

- **Row Level Security (RLS)** is enabled on all rider tables
- Riders can only view/update their own data
- Cashiers and admins can view all rider data
- The migrations are idempotent (safe to run multiple times)
- Use `CREATE TABLE IF NOT EXISTS` ensures no errors if tables already exist

## Files Referenced

- `supabase/migrations/050_create_rider_portal_tables.sql` - Creates rider portal tables
- `supabase/migrations/051_fix_deliveries_rider_reference.sql` - Fixes type mismatch
- `supabase/migrations/036_add_cashier_rider_to_orders.sql` - Adds rider_id to orders table

## Support

If you continue to experience issues after running these migrations:

1. Check the Supabase Dashboard logs for detailed error messages
2. Verify all environment variables are set correctly
3. Ensure your Supabase project is on a plan that supports these features
4. Check that API keys have the necessary permissions
