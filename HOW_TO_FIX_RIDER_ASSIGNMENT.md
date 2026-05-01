# How to Fix the Rider Assignment FK Constraint Error

## The Error You're Seeing

```
Failed to assign rider: Database foreign key constraint violation.

Details: Foreign key constraint violation: insert or update on table "orders" 
violates foreign key constraint "orders_rider_id_fkey"
```

This happens when trying to assign **John Dave Salvaleon** (johndave0991@bitebonansacafe.com) as a rider.

## Root Cause

The `orders.rider_id` foreign key requires the rider's user ID to exist in the `public.users` table. The error means:
- **Either:** The user doesn't exist in `public.users` at all
- **Or:** The user's ID in `public.users` doesn't match their ID in `auth.users`

## How to Fix (Step-by-Step)

### Step 1: Run Diagnostic

1. Open your Supabase project dashboard
2. Go to **SQL Editor** (left sidebar)
3. Click **New query**
4. Open the file `DIAGNOSE_RIDER_FOR_SUPABASE.sql` from this repository
5. Copy the **ENTIRE contents** of that file
6. Paste into the SQL Editor
7. Click **Run** (or press Ctrl+Enter)
8. Review the results

The diagnostic will tell you exactly what's wrong.

### Step 2: Run the Fix

1. Stay in **SQL Editor**
2. Click **New query** (to start fresh)
3. Open the file `FIX_RIDER_FOR_SUPABASE.sql` from this repository
4. Copy the **ENTIRE contents** of that file
5. Paste into the SQL Editor
6. Click **Run** (or press Ctrl+Enter)
7. Wait for it to complete (should take ~1 second)
8. Check the verification results at the bottom

You should see: `✓ FIXED - Ready for rider assignment`

### Step 3: Rider Must Complete Profile

**CRITICAL:** After running the fix, the rider must create their profile:

1. Have the rider login to the application as `johndave0991@bitebonansacafe.com`
2. They should navigate to `/rider/profile`
3. Fill in all required fields:
   - Driver's License ID
   - Vehicle Type
   - Vehicle Plate Number
   - Cellphone Number
   - Emergency Contact Name
   - Emergency Contact Phone
4. Click **Save Profile**

This creates the `riders` table record needed for the rider to:
- Appear in the cashier's rider assignment dropdown
- Be able to accept delivery orders
- Access the rider dashboard

### Step 4: Test Assignment

1. Login as cashier
2. Go to **Orders Queue** (`/cashier/orders-queue`)
3. Find a delivery order
4. Click **Assign Rider**
5. Select "John Dave Salvaleon" from the dropdown
6. Assignment should now work! ✅

## Why This Happened

The FK constraint `orders.rider_id -> users.id` requires that any rider assigned to an order must have a record in the `users` table. 

When a user signs up, they're added to `auth.users` (Supabase authentication), but they might not have been added to `public.users` (application data). The fix script syncs the user from `auth.users` to `public.users` with the correct ID and role.

## Files in This Repository

- `DIAGNOSE_RIDER_FOR_SUPABASE.sql` - Run this first to identify the issue
- `FIX_RIDER_FOR_SUPABASE.sql` - Run this to fix the issue
- `RIDER_FK_CONSTRAINT_COMPLETE_FIX.md` - Detailed technical documentation
- `diagnose_rider_fk_issue.sql` - Original version (requires psql, not Supabase SQL Editor)
- `fix_rider_user_sync.sql` - Original version (requires psql, not Supabase SQL Editor)

## Important Notes

- ✅ All SQL diagnostic and fix files are now compatible with **Supabase SQL Editor** (updated to use `RAISE NOTICE` instead of `\echo`)
- ⚠️ The fix is safe to run multiple times (it's idempotent)
- ⚠️ The rider MUST complete their profile at `/rider/profile` after the fix

## Still Having Issues?

If the fix doesn't work:

1. Check that you ran the **entire** SQL script, not just part of it
2. Make sure the rider completed their profile at `/rider/profile`
3. Try refreshing the cashier dashboard
4. Check the browser console for detailed error messages
5. Run the diagnostic script again to see current status

## Error You Might Have Seen

If you got this error:
```
ERROR: 42601: syntax error at or near "\"
LINE 8: \echo '═══════════════════════════════════════════════════════════════════════════'
```

This error occurred with older versions of the SQL files that used psql-specific `\echo` commands. All SQL files in this repository have been updated to use standard PostgreSQL syntax (`RAISE NOTICE` in `DO` blocks) and are now compatible with Supabase SQL Editor.
