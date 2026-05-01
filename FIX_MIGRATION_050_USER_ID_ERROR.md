# Fix Migration 050 Error: Column user_id Does Not Exist

## Error Details

```
Error: Failed to run sql query: ERROR: 42703: column "user_id" does not exist
```

This error occurs when running `supabase/migrations/050_create_rider_portal_tables.sql`.

## Root Cause

The error happens when:

1. **A `riders` table already exists** in the database (from a previous partial migration attempt or manual creation)
2. **The existing `riders` table is missing the `user_id` column**
3. Migration 050 uses `CREATE TABLE IF NOT EXISTS`, which skips table creation if it already exists
4. Subsequent commands (creating indexes, RLS policies, triggers) try to reference the `user_id` column that doesn't exist

### Why This Happens

```sql
-- Migration 050 line 59
CREATE TABLE IF NOT EXISTS riders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  ...
);

-- Later in the migration - line 85
CREATE INDEX IF NOT EXISTS idx_riders_user_id ON riders(user_id);  -- FAILS if column missing!
```

If `riders` table already exists without `user_id`, the `CREATE TABLE IF NOT EXISTS` does nothing, and the `CREATE INDEX` fails.

## Solution

You have **two options** to fix this:

### Option 1: Run Migration 053 First (Recommended)

Migration 053 (`053_fix_riders_table_schema.sql`) was created to handle this exact scenario. It checks if the `riders` table exists and adds missing columns.

**Steps:**

1. **Run Migration 053 first**:
   - Open Supabase Dashboard → SQL Editor
   - Copy and paste `supabase/migrations/053_fix_riders_table_schema.sql`
   - Execute the migration
   - You should see: "✓ Added user_id column to riders table"

2. **Then run Migration 050**:
   - Now run `050_create_rider_portal_tables.sql`
   - It will validate the schema and proceed successfully

3. **Then run Migration 051**:
   - Finally run `051_fix_deliveries_rider_reference.sql` to fix type mismatches

### Option 2: Drop and Recreate (Clean Slate)

If you want to start fresh and don't have important data in the `riders` table:

**Steps:**

1. **Drop existing incomplete tables** (in Supabase SQL Editor):
   ```sql
   -- Drop tables in reverse dependency order
   DROP TABLE IF EXISTS delivery_reports CASCADE;
   DROP TABLE IF EXISTS deliveries CASCADE;
   DROP TABLE IF EXISTS riders CASCADE;
   ```

2. **Run migrations in order**:
   - Run `050_create_rider_portal_tables.sql`
   - Run `051_fix_deliveries_rider_reference.sql`

## Detailed Migration Order

For a clean deployment, run migrations in this order:

```
050_create_rider_portal_tables.sql    → Creates riders, deliveries, delivery_reports tables
051_fix_deliveries_rider_reference.sql → Fixes order_id type mismatch
052_add_rider_email_to_role_mapping.sql → (If needed for role mapping)
053_fix_riders_table_schema.sql       → Only needed if 050 fails due to existing table
```

## Migration 050 - Updated Version

The migration has been updated to provide a clearer error message:

```sql
-- If table already exists but is missing critical columns, add them
-- This handles the case where table was partially created or has old schema

IF NOT EXISTS (
  SELECT 1 FROM information_schema.columns 
  WHERE table_schema = 'public' AND table_name = 'riders' AND column_name = 'user_id'
) THEN
  RAISE EXCEPTION 'riders table exists but is missing user_id column. 
                   Please run migration 053_fix_riders_table_schema.sql first to fix the schema.';
END IF;
```

Now if you try to run migration 050 with an incomplete `riders` table, you'll get a clear message telling you to run migration 053 first.

## Migration 053 - Schema Fixer

Migration 053 (`053_fix_riders_table_schema.sql`) does the following:

1. **Checks if `riders` table exists**
2. **If it exists**, checks for required columns:
   - `user_id` (UUID, references users.id)
   - `driver_id` (VARCHAR(50), required)
   - `total_earnings` (DECIMAL)
   - `deliveries_completed` (INT)
   - `is_available` (BOOLEAN)
3. **Adds any missing columns** with proper constraints
4. **Creates missing indexes**

This migration is **safe to run multiple times** (idempotent). It only adds missing columns and won't affect existing data.

## Verification After Fix

After running the migrations, verify the schema:

### Check riders table structure:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'riders'
ORDER BY ordinal_position;
```

Expected columns:
- `id` (UUID, PRIMARY KEY)
- `user_id` (UUID, NOT NULL, UNIQUE, FK to users.id)
- `driver_id` (VARCHAR(50), NOT NULL, UNIQUE)
- `vehicle_type` (VARCHAR(50))
- `vehicle_plate` (VARCHAR(20))
- `cellphone_number` (VARCHAR(20))
- `emergency_contact` (VARCHAR(255))
- `emergency_phone` (VARCHAR(20))
- `is_available` (BOOLEAN, default true)
- `total_earnings` (DECIMAL(10,2), default 0)
- `deliveries_completed` (INT, default 0)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### Check indexes:

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'riders'
  AND schemaname = 'public';
```

Expected indexes:
- `riders_pkey` (on id)
- `riders_user_id_key` (unique on user_id)
- `riders_driver_id_key` (unique on driver_id)
- `idx_riders_user_id` (on user_id)
- `idx_riders_driver_id` (on driver_id)
- `idx_riders_available` (on is_available)

### Check foreign keys:

```sql
SELECT
  conname as constraint_name,
  conrelid::regclass as table_name,
  a.attname as column_name,
  confrelid::regclass as foreign_table_name,
  af.attname as foreign_column_name
FROM pg_constraint c
JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
JOIN pg_attribute af ON af.attnum = ANY(c.confkey) AND af.attrelid = c.confrelid
WHERE conrelid = 'riders'::regclass
  AND contype = 'f';
```

Expected:
- `riders_user_id_fkey`: riders.user_id → users.id (ON DELETE CASCADE)

## Common Issues and Troubleshooting

### Issue: "relation riders already exists"

**Cause**: Table exists from previous attempt  
**Solution**: Use Option 1 (run migration 053) or Option 2 (drop and recreate)

### Issue: "violates foreign key constraint"

**Cause**: Trying to create `riders` with `user_id` FK but referencing non-existent user  
**Solution**: Ensure `users` table is populated before creating riders

### Issue: "column user_id referenced in foreign key constraint does not exist"

**Cause**: The `riders` table exists but schema is incomplete  
**Solution**: Run migration 053 to add missing columns

### Issue: Migration 053 fails with "column user_id cannot be marked NOT NULL"

**Cause**: Existing rows in `riders` table would violate NOT NULL constraint  
**Solution**: Either:
1. Delete existing rows: `DELETE FROM riders;`
2. Or populate user_id for existing rows before adding constraint

## Prevention

To avoid this issue in the future:

1. **Always run migrations in order** (050 → 051 → 053)
2. **Don't create tables manually** that are handled by migrations
3. **Use proper migration tools** (Supabase CLI or Dashboard SQL Editor)
4. **Test migrations on development database** before running in production
5. **Keep migration logs** to track which migrations have been successfully applied

## Files Modified

- ✅ Created: `supabase/migrations/053_fix_riders_table_schema.sql` - Schema fixer migration
- ✅ Updated: `supabase/migrations/050_create_rider_portal_tables.sql` - Added validation check
- ✅ Created: `FIX_MIGRATION_050_USER_ID_ERROR.md` - This documentation

## Related Documentation

- `FIX_RIDER_PORTAL_ERRORS.md` - General rider portal database issues
- `MIGRATION_050_PREREQUISITES.md` - Prerequisites for migration 050
- `FIX_DELIVERIES_ORDER_ID_TYPE_MISMATCH.md` - Related to migration 051
