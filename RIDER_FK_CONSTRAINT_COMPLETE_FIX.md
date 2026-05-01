# Rider Foreign Key Constraint Violation - Complete Fix

## Problem Summary

**Error:** `Foreign key constraint violation: insert or update on table "orders" violates foreign key constraint "orders_rider_id_fkey"`

**User affected:** John Dave Salvaleon (johndave0991@bitebonansacafe.com)

**Location:** Cashier Orders Queue → Assign Rider modal

## Root Cause Analysis

The FK constraint `orders_rider_id_fkey` enforces that `orders.rider_id` must reference a valid `users.id`. The constraint fails when:

1. **User doesn't exist in `public.users` table**
   - User authenticated successfully (exists in `auth.users`)
   - But no corresponding record in `public.users`
   - Assignment tries to use a user ID that doesn't exist in the referenced table

2. **ID mismatch between `auth.users` and `public.users`** (data corruption)
   - User exists in both tables but with different IDs
   - Application uses ID from one table, database expects ID from another
   - This is the most subtle and dangerous case

3. **User has wrong role**
   - User exists in `public.users` but `role != 'rider'`
   - The atomic assignment function validates this and returns `INVALID_RIDER_ROLE`

## Why Previous SQL Fixes Didn't Work

The previous SQL statements like:
```sql
UPDATE profiles SET role = 'rider' WHERE email = 'johndave0991@bitebonansacafe.com';
```

Failed because:
- ❌ Wrong table: Should be `public.users`, not `profiles`
- ❌ Doesn't create missing user if they don't exist
- ❌ Doesn't fix ID mismatch if `auth.users.id != public.users.id`
- ❌ Doesn't ensure user ID exists in the users table for FK reference

## The Complete Fix

### Step 1: Diagnose the Issue

Run the diagnostic script to identify the exact problem:

```bash
psql -h <your-db-host> -U postgres -d postgres -f diagnose_rider_fk_issue.sql
```

This will show:
- Whether user exists in `auth.users` ✓
- Whether user exists in `public.users` ?
- Whether IDs match between the two tables ?
- Whether user has correct role ?
- Whether rider profile exists ?

### Step 2: Apply the Fix

Run the fix script:

```bash
psql -h <your-db-host> -U postgres -d postgres -f fix_rider_user_sync.sql
```

This script will:
1. ✅ Get the correct user ID from `auth.users`
2. ✅ Delete any mismatched record in `public.users`
3. ✅ Create/update user in `public.users` with correct ID and `role='rider'`
4. ✅ Verify the fix was successful

### Step 3: Complete Rider Profile

**IMPORTANT:** After running the fix SQL, the rider MUST complete their profile:

1. Login to the application as `johndave0991@bitebonansacafe.com`
2. Navigate to `/rider/profile`
3. Fill in all required fields:
   - Driver's License ID
   - Vehicle Type
   - Vehicle Plate
   - Cellphone Number
   - Emergency Contact Name
   - Emergency Contact Phone
4. Click "Save Profile"

This creates the required record in the `riders` table, which is necessary for:
- Rider to appear in the cashier's rider assignment dropdown
- Rider to be able to accept deliveries
- Rider dashboard to function properly

### Step 4: Test Rider Assignment

1. Login as cashier
2. Go to Orders Queue
3. Find a delivery order
4. Click "Assign Rider"
5. Select "John Dave Salvaleon"
6. Assignment should now succeed! ✅

## Understanding the Database Schema

```
auth.users (Supabase Auth)
    └─ id (UUID, PRIMARY KEY)
    
public.users (Application users)
    ├─ id (UUID, PRIMARY KEY, references auth.users.id)
    ├─ email (TEXT)
    ├─ full_name (TEXT)
    └─ role (TEXT) -- must be 'rider'
    
riders (Rider profiles)
    ├─ id (UUID, PRIMARY KEY)
    ├─ user_id (UUID, FOREIGN KEY -> users.id)
    ├─ vehicle_type, vehicle_plate, etc.
    └─ is_available (BOOLEAN)
    
orders (Customer orders)
    ├─ id (TEXT, PRIMARY KEY)
    ├─ rider_id (UUID, FOREIGN KEY -> users.id)  ⚠️ NOT riders.id
    └─ status, items, etc.
```

**Key relationships:**
- `orders.rider_id` → `users.id` (NOT `riders.id`)
- `riders.user_id` → `users.id`
- `users.id` → `auth.users.id` (same ID, synchronized)

## Why Both Tables Are Required

### `public.users` table
- **Purpose:** Application-level user data
- **Required for:** FK constraint validation on `orders.rider_id`
- **Must have:** Correct ID matching `auth.users.id` and `role='rider'`

### `riders` table
- **Purpose:** Rider-specific profile data
- **Required for:** Rider to appear in assignment dropdown, track deliveries
- **Must have:** Record with `user_id` matching `users.id`

**Both are required:** User in `public.users` satisfies FK constraint, record in `riders` provides profile data.

## How the Fix Prevents Future Issues

The `fix_rider_user_sync.sql` script ensures:

1. **ID Consistency:** Uses `INSERT ... ON CONFLICT` to sync IDs from `auth.users`
2. **Role Correctness:** Forces `role='rider'` on upsert
3. **Data Cleanup:** Deletes mismatched records before recreating
4. **Verification:** Shows final state to confirm fix

## Verification Queries

After running the fix, verify with these queries:

```sql
-- 1. Check user exists with correct role
SELECT id, email, full_name, role
FROM public.users
WHERE email = 'johndave0991@bitebonansacafe.com';
-- Expected: 1 row, role='rider'

-- 2. Check ID consistency
SELECT 
  a.id AS auth_id,
  p.id AS public_id,
  a.id = p.id AS ids_match
FROM auth.users a
JOIN public.users p ON a.email = p.email
WHERE a.email = 'johndave0991@bitebonansacafe.com';
-- Expected: ids_match=true

-- 3. Check rider profile
SELECT r.id, r.user_id, u.email, r.vehicle_type, r.is_available
FROM riders r
JOIN users u ON r.user_id = u.id
WHERE u.email = 'johndave0991@bitebonansacafe.com';
-- Expected: 1 row with vehicle details (after profile completion)

-- 4. Test assignment function
SELECT assign_rider_to_order(
  'test-order-id',
  (SELECT id FROM users WHERE email = 'johndave0991@bitebonansacafe.com')
);
-- Expected: error='ORDER_NOT_FOUND' (which is correct for test)
-- NOT expected: error='RIDER_NOT_FOUND' or 'FK_VIOLATION'
```

## Troubleshooting

### Error: "User not found in auth.users"
**Solution:** User needs to sign up first at `/login` (create account)

### Error: "Rider profile not found"
**Solution:** User needs to complete profile at `/rider/profile`

### Error: Still getting FK violation after fix
**Possible causes:**
1. Wrong user ID being passed from frontend
2. Database trigger interfering
3. Migration 058 (atomic function) not applied

**Debug steps:**
1. Check browser console for actual `rider_id` being sent
2. Run diagnostic script again to verify fix
3. Check if `assign_rider_to_order` function exists: `\df assign_rider_to_order`

## Prevention for Future Riders

To prevent this issue for new riders:

1. **On signup:** Login page (`pages/login.js`) auto-creates user in `public.users` with correct ID
2. **On first rider login:** Prompt user to complete profile at `/rider/profile`
3. **Validation:** `assign_rider_to_order` function validates everything atomically

The fix ensures data integrity at both application and database levels.

## Files Involved

- `diagnose_rider_fk_issue.sql` - Diagnostic script
- `fix_rider_user_sync.sql` - Fix script
- `supabase/migrations/058_atomic_rider_assignment.sql` - Assignment function
- `pages/cashier/orders-queue.js` - Frontend rider assignment
- `pages/rider/profile.js` - Rider profile completion
- `pages/login.js` - Auto-creates user on login

## Summary

✅ **Root cause:** User missing or mismatched in `public.users` table  
✅ **Fix:** Sync user from `auth.users` to `public.users` with correct ID and role  
✅ **Required action:** Rider must complete profile at `/rider/profile`  
✅ **Result:** Rider assignment will work successfully  

The fix addresses the data integrity issue at its source and ensures all future assignments work correctly.
