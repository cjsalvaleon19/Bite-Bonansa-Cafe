# Migration 071: Fix Delivery Report Submission Error

## Problem
When riders attempt to submit billable delivery fees via the Billing Portal, they receive a **400 error**:

```
column "related_id" is of type uuid but expression is of type text
```

## Root Cause
Migration 050 created two trigger functions that insert notifications when:
1. A delivery report is marked as paid (`update_rider_earnings()`)
2. A new delivery report is submitted (`notify_cashiers_on_report()`)

Both functions incorrectly cast the `delivery_reports.id` as TEXT (`NEW.id::TEXT`) when inserting into `notifications.related_id`, which expects a UUID type.

## Solution
Migration 071 recreates both trigger functions with proper UUID handling:
- Changed `NEW.id::TEXT` to `NEW.id` (no casting needed, as both are UUID)
- This allows the database to properly insert UUID values into the `notifications.related_id` column

## Deployment Instructions

### 1. Apply Migration
Run migration 071 in your Supabase database:

```sql
-- Execute this in Supabase SQL Editor or via CLI
\i supabase/migrations/071_fix_delivery_report_notification_uuid.sql
```

### 2. Verify Trigger Functions
Confirm the trigger functions were updated successfully:

```sql
-- Check update_rider_earnings function
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'update_rider_earnings';

-- Check notify_cashiers_on_report function
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'notify_cashiers_on_report';

-- Both should show NEW.id (not NEW.id::TEXT) in the related_id field
```

### 3. Test Report Submission
1. Log in as a rider with completed deliveries
2. Navigate to **Reports** > **Billing Portal**
3. Select one or more completed deliveries
4. Click **Submit Report**
5. Verify success message appears without errors

### 4. Verify Notifications
After successful submission, check that notifications were created:

```sql
-- Check cashier notifications (for new report submission)
SELECT * FROM notifications 
WHERE type = 'delivery_report' 
AND related_type = 'delivery_report'
ORDER BY created_at DESC
LIMIT 5;

-- The related_id should be a valid UUID matching a delivery_reports.id
```

### 5. Test Payment Flow (Optional)
To test the payment notification, **first get a real UUID** from existing reports:

```sql
-- Step 1: Get an actual delivery report UUID
SELECT id, report_date, rider_id, status, rider_earnings
FROM delivery_reports 
WHERE status = 'submitted'
ORDER BY created_at DESC 
LIMIT 5;

-- Step 2: Copy a real UUID from the results above and use it below
-- Mark a submitted report as paid (replace <actual-uuid> with real UUID from step 1)
UPDATE delivery_reports 
SET status = 'paid', paid_at = NOW()
WHERE id = '<actual-uuid>';  -- Use real UUID here, not placeholder text

-- Step 3: Check rider payment notification
SELECT * FROM notifications 
WHERE type = 'report_paid'
ORDER BY created_at DESC
LIMIT 1;
```

**Important:** 
- The placeholder `<report-uuid>` or `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` will cause a UUID syntax error
- You must use an **actual UUID value** from your database (format: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)
- The column is `rider_earnings`, not `total_earnings`

## Expected Results

### Before Migration 071
- ❌ Error: "column "related_id" is of type uuid but expression is of type text"
- ❌ Riders cannot submit billing reports
- ❌ No notifications created

### After Migration 071
- ✅ Reports submit successfully
- ✅ Cashiers receive notification about new report
- ✅ Riders receive notification when report is paid
- ✅ All notifications have valid UUID in `related_id`

## Impact

### Who is Affected?
- **Riders**: Can now submit billing reports without errors
- **Cashiers**: Will receive proper notifications when reports are submitted
- **System**: Notifications system functions correctly for delivery reports

### Backward Compatibility
- ✅ No breaking changes
- ✅ Existing reports remain intact
- ✅ Migration only updates trigger functions, not data
- ✅ Safe to run on production database

## Rollback (if needed)
If you need to rollback this migration, you would need to restore the old trigger functions. However, **this is not recommended** as the old functions contain the bug. Instead, fix any issues in a new migration.

## Related Migrations
- **Migration 018**: Created notifications table with `related_id UUID`
- **Migration 037**: Fixed similar UUID casting issue in order status notifications
- **Migration 050**: Created delivery report triggers (contained the bug)
- **Migration 071**: Fixes the bug in migration 050 triggers

## Notes
- This is the same type of bug that was fixed in migration 037 for order notifications
- Future migrations should use direct UUID values, not TEXT casting, when inserting into UUID columns
- PostgreSQL automatically handles UUID type conversion when the source is already UUID type
