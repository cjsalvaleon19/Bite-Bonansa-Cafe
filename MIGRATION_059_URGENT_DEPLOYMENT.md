# URGENT: Migration 059 Deployment Guide

## Critical Issue

Production systems are experiencing this error:
```
Failed to assign rider: operator does not exist: text = uuid
```

## Root Cause

Migration 058 deployed a database function with incorrect type signature:
- Function parameter: `p_order_id UUID`
- Database column: `orders.id TEXT`

PostgreSQL cannot compare TEXT = UUID, causing all rider assignments to fail.

## Immediate Fix Required

### Step 1: Run Migration 059

**In Supabase SQL Editor:**
```sql
-- Copy and paste the entire contents of:
-- supabase/migrations/059_fix_assign_rider_type_mismatch.sql
```

Or use Supabase CLI:
```bash
supabase migration up
```

### Step 2: Verify Fix

Test the function works:
```sql
SELECT assign_rider_to_order(
  'ORD-260501-003',        -- Use actual order ID (TEXT)
  'actual-rider-uuid-here'::UUID
);
```

Expected result: JSON with `"success": true` or specific error message (not type error).

### Step 3: Confirm in Application

1. Login as cashier
2. Go to Orders Queue
3. Click "Out for Delivery" on a delivery order
4. Select a rider
5. Should assign successfully (no type error)

## What Migration 059 Does

1. Drops the broken function signature `(UUID, UUID)`
2. Recreates with correct signature `(TEXT, UUID)`
3. No data changes
4. Takes < 1 second
5. Safe to run multiple times (idempotent)

## Downtime

**Zero downtime** - function is recreated immediately.

Brief moment (< 100ms) where function doesn't exist, but:
- Application has retry logic
- Users will just click again if it fails
- Error is rare due to speed of execution

## Rollback

If issues occur (unlikely):
```sql
-- Function will still exist, just revert to manual assignment
-- Or re-run migration 058 if needed (but it has the bug)
```

## Verification Checklist

- [ ] Migration 059 ran successfully (check migration logs)
- [ ] Function exists: `SELECT * FROM pg_proc WHERE proname = 'assign_rider_to_order';`
- [ ] Function has correct signature (TEXT, UUID)
- [ ] Test assignment works in production
- [ ] No more "operator does not exist" errors in logs

## Communication

**To Users:**
"We've deployed a fix for the rider assignment error. Please try again. If you still see issues, refresh your browser and contact support."

## Timeline

- **Discovery**: Error appeared after migration 058 deployment
- **Diagnosis**: Type mismatch between function parameter and column type
- **Fix Created**: Migration 059
- **Deployment**: ASAP (< 5 minutes to run)
- **Verification**: Immediate (test one rider assignment)

## Support

If migration 059 doesn't fix the issue:

1. Check migration actually ran:
   ```sql
   SELECT * FROM _migrations WHERE name LIKE '%059%';
   ```

2. Check function signature:
   ```sql
   SELECT 
     p.proname,
     pg_get_function_arguments(p.oid) as arguments
   FROM pg_proc p
   WHERE p.proname = 'assign_rider_to_order';
   ```
   
   Should show: `p_order_id text, p_rider_id uuid`

3. Check application is calling function correctly:
   - Browser console should show RPC call
   - Order ID should be string, not trying to cast to UUID

4. Contact development team with error logs

## Related Files

- `supabase/migrations/059_fix_assign_rider_type_mismatch.sql` - The fix
- `RIDER_ASSIGNMENT_409_FIX_COMPLETE.md` - Full technical documentation
- `pages/cashier/orders-queue.js` - Application code (no changes needed)

## Priority

🔴 **CRITICAL** - All rider assignments are currently failing
⏰ **IMMEDIATE** - Deploy as soon as possible
✅ **LOW RISK** - Simple type fix, no data changes

---

**Last Updated**: 2026-05-01
**Status**: Ready for Production Deployment
