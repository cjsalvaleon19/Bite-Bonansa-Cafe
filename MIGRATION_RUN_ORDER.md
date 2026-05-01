# Migration Run Order for Rider System

## Problem

When running migrations out of order or when the riders table exists with an incomplete schema, you may encounter errors like:

```
ERROR: 42703: column r.vehicle_type does not exist
ERROR: column "user_id" of relation "riders" does not exist
```

## Solution: Run Migrations in Correct Order

### Step 1: Migration 053 - Fix Riders Table Schema

**Purpose**: Ensures the riders table has ALL required columns

**Run this if:**
- The riders table exists but is missing columns
- You get "column does not exist" errors
- You're setting up the rider system for the first time

**What it does:**
- Checks if riders table exists
- Adds user_id if missing (critical for foreign key relationships)
- Adds all other columns: driver_id, vehicle_type, vehicle_plate, cellphone_number, emergency_contact, emergency_phone, is_available, total_earnings, deliveries_completed, created_at, updated_at

**Run in Supabase SQL Editor:**
```sql
-- Copy and paste entire content of:
supabase/migrations/053_fix_riders_table_schema.sql
```

### Step 2: Migration 050 - Create Rider Portal Tables

**Purpose**: Creates riders, deliveries, and delivery_history tables

**Run this if:**
- The riders table doesn't exist yet
- You need to create the complete rider portal infrastructure

**Prerequisites:**
- Users table must exist
- Orders table must exist
- Notifications table must exist
- Migration 053 should be run first if riders table exists with incomplete schema

**Run in Supabase SQL Editor:**
```sql
-- Copy and paste entire content of:
supabase/migrations/050_create_rider_portal_tables.sql
```

### Step 3: Migration 054 - Fix Rider Assignment Foreign Key

**Purpose**: Fixes data consistency and creates helper views/functions

**Run this if:**
- You're getting foreign key constraint violations when assigning riders
- You need the available_riders_view for queries
- You want to clean up orphaned data

**What it does:**
1. Validates riders table has all columns (safety check)
2. Clears orphaned rider_id references in orders table
3. Removes riders without valid user accounts
4. Creates `available_riders_view` (joins riders + users)
5. Creates `validate_rider_exists()` function
6. Adds helpful column comments

**Run in Supabase SQL Editor:**
```sql
-- Copy and paste entire content of:
supabase/migrations/054_fix_rider_assignment_fkey.sql
```

## Complete Setup Flow

### Scenario A: Fresh Setup (No Riders Table)
```
1. Run Migration 050 → Creates riders table with full schema
2. Run Migration 054 → Sets up views and validates data
```

### Scenario B: Riders Table Exists (Incomplete Schema)
```
1. Run Migration 053 → Fixes riders table schema, adds missing columns
2. Run Migration 054 → Sets up views and validates data
```

### Scenario C: Riders Table Exists (Complete Schema)
```
1. Run Migration 054 → Sets up views and validates data
```

## Verification

After running migrations, verify everything is correct:

### Check Riders Table Schema
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'riders'
ORDER BY ordinal_position;
```

Expected columns:
- id (uuid)
- user_id (uuid, NOT NULL)
- driver_id (varchar)
- vehicle_type (varchar)
- vehicle_plate (varchar)
- cellphone_number (varchar)
- emergency_contact (varchar)
- emergency_phone (varchar)
- is_available (boolean)
- total_earnings (numeric)
- deliveries_completed (integer)
- created_at (timestamp)
- updated_at (timestamp)

### Check View Was Created
```sql
SELECT * FROM available_riders_view LIMIT 1;
```

### Check Function Exists
```sql
SELECT validate_rider_exists('00000000-0000-0000-0000-000000000000'::uuid);
-- Should return false (assuming this UUID doesn't exist as a rider)
```

### Check No Orphaned Data
```sql
-- Should return 0 rows
SELECT o.id, o.order_number, o.rider_id
FROM orders o
WHERE o.rider_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = o.rider_id);
```

## Troubleshooting

### "column does not exist" Error

**Error**: `column r.vehicle_type does not exist`

**Solution**: Run Migration 053 first to add all missing columns

### "column user_id does not exist" Error

**Error**: `column "user_id" of relation "riders" does not exist`

**Solution**: Run Migration 053 first to add the user_id column

### Foreign Key Violation Error

**Error**: `violates foreign key constraint "orders_rider_id_fkey"`

**Solution**: 
1. Run Migration 054 to clean up orphaned data
2. Ensure you're using `riders.user_id` (not `riders.id`) when assigning riders
3. See FIX_RIDER_ASSIGNMENT_FKEY_ERROR.md for code fixes

### "prerequisite tables do not exist" Error

**Error from Migration 050**: `users/orders/notifications table does not exist`

**Solution**: Ensure these tables exist before running Migration 050

## Related Documentation

- **FIX_RIDER_ASSIGNMENT_FKEY_ERROR.md** - Complete fix for rider assignment errors
- **FIX_MIGRATION_050_USER_ID_ERROR.md** - Specific fix for user_id column issue
- **MIGRATION_050_PREREQUISITES.md** - Prerequisites for migration 050

## Key Takeaways

1. **Order matters**: Run 053 before 054 if riders table exists
2. **Complete schema required**: riders table must have ALL columns before creating views
3. **Use user_id, not id**: When assigning riders to orders, use `riders.user_id` which equals `users.id`
4. **Validate before assigning**: Use `validate_rider_exists()` function before assigning riders
5. **Use the view**: Query from `available_riders_view` for complete rider information
