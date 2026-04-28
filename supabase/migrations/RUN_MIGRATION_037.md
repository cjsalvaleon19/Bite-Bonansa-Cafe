# Migration 037: Fix notifications.related_id UUID Type Issue

## Problem
Cashier dashboard is throwing the error:
```
[CashierDashboard] Failed to accept order: column "related_id" is of type uuid but expression is of type text
```

## Root Cause Analysis

The error occurs when the database trigger `notify_customer_on_order_status_change()` tries to insert a notification after an order status update. The trigger was created in migration 018.

### Potential Causes:
1. The `related_id` column might have been created with wrong type in some environments
2. The trigger function might not be explicitly casting the UUID value
3. PostgreSQL type inference issues when inserting `NEW.id` from the trigger

## Solution

This migration:

1. **Verifies and fixes the column type**: Ensures `notifications.related_id` is explicitly `UUID` type
2. **Updates the trigger function**: Adds explicit `::UUID` cast when inserting `NEW.id` into `related_id`
3. **Recreates the trigger**: Ensures the updated function is used

## Changes

### Column Type Fix
```sql
ALTER TABLE notifications 
ALTER COLUMN related_id TYPE UUID USING related_id::UUID;
```

### Trigger Function Update
Changed from:
```sql
related_id,
...
VALUES (..., NEW.id, ...)
```

To:
```sql
related_id,
...
VALUES (..., NEW.id::UUID, ...)  -- Explicit cast
```

## Testing

Run the test migration to verify:
```bash
# In Supabase SQL Editor, run:
supabase/migrations/test_migration_037.sql
```

Expected results:
- ✓ related_id column is UUID type
- ✓ Trigger function exists
- ✓ Trigger is active on orders table
- ✓ Test notification insert succeeds

## Deployment

1. Apply migration in Supabase dashboard
2. Test by accepting an order in cashier dashboard
3. Verify no UUID type errors occur

## Related Files
- `supabase/migrations/018_create_notifications_system.sql` - Original notification system creation
- `pages/cashier/dashboard.js` - Cashier dashboard that triggers order updates
- `database_schema.sql` - Main schema reference

## Impact
- **Breaking**: No
- **Data Loss**: No
- **Downtime**: None (migration is fast)
