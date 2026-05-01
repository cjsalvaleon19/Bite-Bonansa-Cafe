# Fix Riders Table "name" Column Issue

## Problem

The riders table in the production database has a `name` column with a NOT NULL constraint that isn't defined in any migration file. This causes rider profile saves to fail with the error:

```
null value in column "name" of relation "riders" violates not-null constraint
```

## Root Cause

The `name` column was likely added manually to the database or through an undocumented migration. The official schema in migrations 050 and 053 does NOT include a `name` column because:

1. Rider names should come from `users.full_name` via the `user_id` foreign key
2. The `riders` table should only store rider-specific information (driver ID, vehicle info, etc.)
3. This prevents data duplication and keeps the schema normalized

## Solution

Migration `055_fix_riders_name_column.sql` fixes this schema mismatch by:

1. Checking if the `name` column exists in the `riders` table
2. If it exists:
   - If empty: Drops the column (preferred - matches migration schema)
   - If has data: Removes the NOT NULL constraint (allows existing data to remain)
3. If it doesn't exist: Reports success (schema is already correct)

## How to Run

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the contents of `supabase/migrations/055_fix_riders_name_column.sql`
5. Paste into the query editor
6. Click **Run**
7. Verify the success messages in the output

### Option 2: Via Supabase CLI

```bash
supabase db push --include-all
```

Or run the specific migration:

```bash
supabase db execute supabase/migrations/055_fix_riders_name_column.sql
```

## Verification

After running the migration, verify the fix:

```sql
-- Check riders table schema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'riders'
ORDER BY ordinal_position;
```

Expected result: No `name` column should be present (or if present due to data, it should be nullable).

## Testing

1. **Test rider profile save:**
   - Log in as a rider
   - Go to `/rider/profile`
   - Fill in required fields (driver_id, vehicle info, etc.)
   - Click Save
   - Should succeed without "name" column error

2. **Test rider assignment:**
   - Log in as cashier
   - Go to Orders Queue
   - Try to assign a rider to a delivery order
   - Should succeed without FK constraint error

## Related Issues

This migration also addresses related issues:
- FK constraint violations when assigning riders (if user doesn't exist in public.users)
- Schema mismatches between migration files and actual database

## Schema Reference

### Correct Riders Table Schema (from migration 050)

```sql
CREATE TABLE riders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  
  -- Driver identification
  driver_id VARCHAR(50) UNIQUE NOT NULL,
  
  -- Vehicle information
  vehicle_type VARCHAR(50),
  vehicle_plate VARCHAR(20),
  
  -- Contact information
  cellphone_number VARCHAR(20),
  emergency_contact VARCHAR(255),
  emergency_phone VARCHAR(20),
  
  -- Status and tracking
  is_available BOOLEAN DEFAULT true,
  total_earnings DECIMAL(10,2) DEFAULT 0,
  deliveries_completed INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### How to Get Rider Name

Use a JOIN to get the rider's name from the users table:

```sql
SELECT 
  r.*,
  u.full_name,
  u.email
FROM riders r
JOIN users u ON r.user_id = u.id
WHERE r.is_available = true;
```

Or use the `available_riders_view` (created in migration 054) which already includes this join.

## Prevention

To prevent similar issues in the future:

1. **Always use migrations** - Never modify the database schema manually
2. **Document all changes** - Add comments to explain schema decisions
3. **Use version control** - Keep migration files in sync with the database
4. **Test locally first** - Run migrations in development before production
5. **Review schema regularly** - Compare migration files with actual database schema

## Troubleshooting

If the migration fails:

1. Check if there's a dependency on the `name` column in views or functions
2. Check if there are foreign keys referencing the column
3. Manually inspect the data:
   ```sql
   SELECT name, COUNT(*) FROM riders GROUP BY name;
   ```
4. If needed, migrate data to `users.full_name` before dropping:
   ```sql
   UPDATE users u
   SET full_name = r.name
   FROM riders r
   WHERE u.id = r.user_id
   AND u.full_name IS NULL
   AND r.name IS NOT NULL;
   ```

## Support

If you encounter issues after running this migration:

1. Check the Supabase logs for detailed error messages
2. Verify the riders table schema matches the expected schema above
3. Test the rider profile save functionality
4. Report any persistent issues with logs attached
