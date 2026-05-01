# Migration 050 Prerequisites and Troubleshooting

## Error: "column user_id does not exist"

If you encounter this error when running migration 050_create_rider_portal_tables.sql, it indicates that required prerequisite tables are missing or incomplete.

## Root Cause

Migration 050 creates tables with foreign key constraints and triggers that depend on existing tables:

1. **users table** - Required for foreign keys in riders, deliveries, and delivery_reports tables
2. **orders table** - Required for foreign key in deliveries table
3. **notifications table** - Required for notification triggers

If any of these tables don't exist or are missing required columns, the migration will fail.

## Prerequisites

Before running migration 050, ensure these migrations have been run:

### Required Migrations
- **Migration 018**: Creates the notifications system (notifications table)
- **Earlier migrations**: Create users and orders tables

### Required Tables and Columns
```sql
-- users table must have:
- id UUID (or compatible type)
- role VARCHAR (for RLS policies)

-- orders table must have:
- id TEXT (note: TEXT type, not UUID - see migration 049, 051)

-- notifications table must have:
- user_id UUID
- type VARCHAR(50)
- title VARCHAR(255)
- message TEXT
- related_id UUID
- related_type VARCHAR(50)
```

## Solution

### Option 1: Run Migrations in Order
Run all migrations in numerical order from 001 to 050:

```bash
# Run all migrations in order
for file in supabase/migrations/*.sql; do
  psql $DATABASE_URL -f "$file"
done
```

### Option 2: Run Specific Prerequisites
If you only need to run migration 050, first run these:

```bash
# Run prerequisite migrations
psql $DATABASE_URL -f supabase/migrations/018_create_notifications_system.sql

# Then run migration 050
psql $DATABASE_URL -f supabase/migrations/050_create_rider_portal_tables.sql

# Then run migration 051 (fixes order_id type if needed)
psql $DATABASE_URL -f supabase/migrations/051_fix_deliveries_rider_reference.sql
```

### Option 3: Verify Prerequisites
The migration now includes automatic prerequisite checks. Run it and it will tell you exactly what's missing:

```bash
psql $DATABASE_URL -f supabase/migrations/050_create_rider_portal_tables.sql
```

You'll see clear error messages like:
- "users table does not exist"
- "notifications table does not exist"
- "users table does not have id column"

## Verification

After fixing prerequisites, verify the migration works:

```sql
-- Check if tables were created
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('riders', 'deliveries', 'delivery_reports');

-- Check if triggers were created
SELECT tgname FROM pg_trigger 
WHERE tgname IN ('trigger_update_delivery_count', 'trigger_update_rider_earnings', 'trigger_notify_cashiers');

-- Verify column types
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'deliveries' AND column_name IN ('order_id', 'rider_id');
```

Expected results:
- `deliveries.order_id` should be TEXT type
- `deliveries.rider_id` should be UUID type
- All three tables should exist
- All three triggers should exist

## Common Issues

### Issue: "Key columns are of incompatible types"
**Cause**: `orders.id` is TEXT but `deliveries.order_id` was created as UUID (fixed in migration 050 and 051)

**Solution**: Ensure you're using the latest version of migration 050 (which defines order_id as TEXT), or run migration 051 to fix existing databases.

### Issue: "relation users does not exist"
**Cause**: Users table hasn't been created yet

**Solution**: 
- If using Supabase, ensure you've enabled authentication and the auth schema is set up
- If custom users table, create it before running this migration
- Check that earlier migrations have been run

### Issue: "column id does not exist in table users"
**Cause**: Users table exists but doesn't have standard `id` column

**Solution**: Verify your users table schema matches the expected structure with an `id` column of UUID type.

## Migration Dependencies Tree

```
Migration 050 depends on:
  ├─ users table (created in Supabase auth or earlier custom migration)
  ├─ orders table (created in earlier migrations)
  └─ notifications table
       └─ Migration 018: create_notifications_system.sql
```

## Files Related to This Fix

- `supabase/migrations/050_create_rider_portal_tables.sql` - Main migration (now with prerequisite checks)
- `supabase/migrations/051_fix_deliveries_rider_reference.sql` - Fixes order_id type mismatch
- `FIX_DELIVERIES_ORDER_ID_TYPE_MISMATCH.md` - Documentation for order_id fix
- `SQL_ERROR_FIX_SUMMARY.md` - Summary of previous fixes

## Prevention

To prevent this error in the future:

1. **Always run migrations in order** - Don't skip migrations
2. **Use migration tools** - Tools like Supabase CLI or Flyway ensure proper ordering
3. **Check prerequisites** - The migration now validates prerequisites automatically
4. **Keep documentation updated** - Document any custom table requirements

## Support

If you continue to experience issues:

1. Check the prerequisite error message from the migration
2. Verify your database schema matches expected structure
3. Review migration logs for specific error details
4. Ensure you're not using a partial database restore
