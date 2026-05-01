# Migration 060: Orphaned Riders Cleanup - Deployment Guide

## Issue

After deploying migration 059 (type mismatch fix), a NEW error appeared:

```
Failed to assign rider: Database foreign key constraint violation.

Details: Foreign key constraint violation: insert or update on table 
"orders" violates foreign key constraint "orders_rider_id_fkey"
```

## Root Cause

The `riders` table contains **orphaned records** - riders whose `user_id` references users that no longer exist in the `users` table.

**How this happens:**
- User account deleted (voluntary deletion, admin cleanup, etc.)
- Rider record NOT automatically deleted
- Rider still appears in assignment UI
- Attempting to assign → FK constraint violation

## Quick Fix: Run Migration 060

### Step 1: Deploy Migration 060

**In Supabase SQL Editor:**
```sql
-- Copy and paste the entire contents of:
-- supabase/migrations/060_cleanup_orphaned_riders.sql
```

Or use Supabase CLI:
```bash
supabase migration up
```

### Step 2: Verify Cleanup

Check migration logs for output like:
```
Found 2 orphaned rider record(s)
Orphaned riders details:
  - Rider ID: xxx, User ID: yyy, Vehicle: motorcycle, Created: 2024-...
  - Rider ID: zzz, User ID: aaa, Vehicle: car, Created: 2024-...
Archived 2 rider record(s)
Deleted 2 orphaned rider record(s)
✓ New constraint added with CASCADE delete
```

### Step 3: Test Rider Assignment

1. Login as cashier
2. Go to Orders Queue  
3. Create or find a delivery order
4. Click "Out for Delivery"
5. Select a rider
6. Should assign successfully (no FK error)

## What Migration 060 Does

### 1. Identifies Orphaned Riders
```sql
SELECT * FROM riders r
WHERE NOT EXISTS (
  SELECT 1 FROM users u WHERE u.id = r.user_id
);
```

### 2. Archives Data (For Recovery)
Creates `riders_archived` table with all orphaned data, just in case you need to recover it later.

### 3. Deletes Orphaned Riders
Removes riders whose user doesn't exist.

### 4. Adds CASCADE Constraint
```sql
ALTER TABLE riders 
  ADD CONSTRAINT riders_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) 
  ON DELETE CASCADE;
```

**Result**: When a user is deleted in the future, their rider record is automatically deleted too.

## Recovery (If Needed)

If you need to restore archived data:

```sql
-- View archived riders
SELECT * FROM riders_archived 
WHERE reason = 'orphaned_user_deleted'
ORDER BY archived_at DESC;

-- Restore a specific rider (if user is restored)
INSERT INTO riders (id, user_id, driver_id, vehicle_type, ...)
SELECT id, user_id, driver_id, vehicle_type, ...
FROM riders_archived
WHERE id = '<specific-rider-id>';
```

## Verification Checklist

- [ ] Migration 060 ran successfully
- [ ] Check how many riders were orphaned (in migration logs)
- [ ] Verify `riders_archived` table exists and contains archived data
- [ ] Verify CASCADE constraint exists:
  ```sql
  SELECT constraint_name, delete_rule
  FROM information_schema.referential_constraints
  WHERE constraint_name = 'riders_user_id_fkey';
  -- Should show: delete_rule = 'CASCADE'
  ```
- [ ] Test rider assignment in production (should work)
- [ ] No more FK violation errors in logs

## Important Notes

### Data Safety
- All deleted data is archived to `riders_archived` table
- Migration logs show exactly which riders were removed
- Data can be recovered if needed

### Future Protection
- ON DELETE CASCADE prevents future orphans
- No manual cleanup needed going forward
- Database maintains referential integrity automatically

### Downtime
- **Zero downtime** - takes < 5 seconds typically
- Safe to run during business hours
- No impact on active orders or assignments

## Relationship to Migration 059

These migrations work together:

1. **Migration 059**: Fixes type mismatch (text vs uuid)
   - Error: "operator does not exist: text = uuid"
   - Makes the function work at all

2. **Migration 060**: Fixes data integrity (orphaned riders)
   - Error: "Foreign key constraint violation"
   - Ensures assigned riders actually exist

**Both are required** for rider assignment to work properly.

## Deployment Order

If deploying both:
```
Migration 059 (type fix) → Migration 060 (orphan cleanup)
```

**DO NOT** run in reverse order - migration 060 won't help if type mismatch prevents function execution.

## Troubleshooting

### If migration fails:

**Error: "riders_user_id_fkey already exists"**
- Migration is idempotent, this is OK
- Constraint will be dropped and recreated
- Check logs to confirm orphans were cleaned

**Error: "riders_archived table already exists"**
- This is OK, migration will reuse it
- Your previously archived data is safe

**Error: "cannot drop constraint - doesn't exist"**
- This means constraint was never created (unusual)
- Migration will create it from scratch
- Check if riders table exists at all

### If rider assignment still fails after migration:

1. **Check both migrations ran:**
   ```sql
   SELECT * FROM _migrations 
   WHERE name LIKE '%059%' OR name LIKE '%060%'
   ORDER BY created_at;
   ```

2. **Check function signature:**
   ```sql
   SELECT pg_get_function_arguments(p.oid) as arguments
   FROM pg_proc p
   WHERE p.proname = 'assign_rider_to_order';
   -- Should show: p_order_id text, p_rider_id uuid
   ```

3. **Check for remaining orphans:**
   ```sql
   SELECT COUNT(*) FROM riders r
   WHERE NOT EXISTS (
     SELECT 1 FROM users u WHERE u.id = r.user_id
   );
   -- Should return: 0
   ```

## Support

If issues persist after both migrations:
1. Collect error logs from browser console
2. Check migration logs for any failures
3. Verify both migrations in `_migrations` table
4. Contact development team with details

---

**Last Updated**: 2026-05-01
**Status**: Ready for Production Deployment
**Priority**: 🔴 CRITICAL (blocks rider assignments)
**Risk**: 🟢 LOW (archives data before deletion)
