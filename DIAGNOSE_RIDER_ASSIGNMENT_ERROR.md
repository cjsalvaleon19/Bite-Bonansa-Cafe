# Diagnosing Rider Assignment Errors

## Problem
The console shows:
```
[OrdersQueue] Rider assignment failed: Object
```

But we cannot see the actual error details because the browser console only shows "Object" instead of the error content.

## Root Cause Analysis

Based on the code in `pages/cashier/orders-queue.js` (line 448), the error is logged like this:

```javascript
console.error('[OrdersQueue] Rider assignment failed:', {
  errorType,
  errorMessage,
  fullResult: assignmentResult
});
```

The atomic assignment function in `supabase/migrations/058_atomic_rider_assignment.sql` can return these error types:

1. **ORDER_NOT_FOUND** - Order doesn't exist
2. **INVALID_ORDER_MODE** - Order is not delivery mode
3. **RIDER_NOT_FOUND** - Rider doesn't exist in users table  
4. **INVALID_RIDER_ROLE** - User exists but role is not 'rider'
5. **FK_VIOLATION** - Foreign key constraint violation
6. **UNEXPECTED_ERROR** - Other database errors

## Most Likely Cause

Given the repository memories, especially the **customer_id constraint** memory, the most likely cause is:

**The rider user does not exist in the `public.users` table** because:
1. Rider exists in `auth.users` (authenticated successfully)
2. Login tried to create record in `public.users`
3. Creation failed due to `customer_id NOT NULL` constraint
4. Now rider assignment fails with `RIDER_NOT_FOUND` error

### Why This Happens

From memory "customer_id constraint":
- The `customer_id` column in users table has NOT NULL constraint
- Only customers need `customer_id` - riders, cashiers, admins should have NULL
- Migration 061 fixes this, but **it hasn't been applied to your database yet**

## How to Fix

### Step 1: Apply Migration 061 (REQUIRED)

Run this in your Supabase SQL Editor:

```sql
-- Make customer_id nullable
ALTER TABLE public.users 
  ALTER COLUMN customer_id DROP NOT NULL;

-- Verify the fix
SELECT 
  column_name,
  data_type,
  is_nullable,
  CASE 
    WHEN is_nullable = 'YES' THEN '✓ FIXED - customer_id is now nullable'
    ELSE '✗ FAILED - customer_id is still NOT NULL'
  END AS result
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'users' 
  AND column_name = 'customer_id';
```

### Step 2: Verify Rider Exists in Users Table

```sql
-- Check if rider exists in users table
SELECT 
  u.id,
  u.email,
  u.full_name,
  u.role,
  u.customer_id,
  CASE 
    WHEN u.role = 'rider' THEN '✓ Role is rider'
    ELSE '✗ Role is ' || u.role
  END as role_check
FROM public.users u
WHERE u.email LIKE '%rider%' 
   OR u.email LIKE '%johndave%'
ORDER BY u.email;
```

### Step 3: Check Auth Users vs Public Users

```sql
-- Compare auth.users vs public.users to find missing profiles
SELECT 
  au.email as auth_email,
  au.id as auth_id,
  u.email as public_email,
  u.id as public_id,
  u.role as public_role,
  CASE 
    WHEN u.id IS NULL THEN '✗ MISSING from public.users'
    WHEN u.role != 'rider' THEN '✗ Wrong role: ' || u.role
    ELSE '✓ OK'
  END as status
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
WHERE au.email LIKE '%rider%' 
   OR au.email LIKE '%johndave%'
ORDER BY au.email;
```

### Step 4: Manually Create Missing Rider User (If Needed)

If the rider is missing from `public.users` after fixing migration 061:

```sql
-- Replace with actual values from auth.users
INSERT INTO public.users (
  id,
  email,
  full_name,
  role,
  customer_id  -- Will be NULL for riders
)
VALUES (
  '<uuid-from-auth-users>',
  'johndave0991@bitebonansacafe.com',
  'John Dave Salvaleon',
  'rider',
  NULL  -- Riders don't need customer_id
)
ON CONFLICT (id) DO UPDATE
SET role = 'rider';
```

## Testing After Fix

1. **Logout** from the application
2. **Login again** as the rider (this will trigger auto-create profile logic)
3. **Try assigning the rider** from the cashier orders queue
4. **Check browser console** - you should now see detailed error (if any) or success

## Enhanced Error Logging

To see actual error details in the console, you can also:

1. Open browser DevTools (F12)
2. Go to Console tab
3. Click the "Object" to expand it
4. Look for properties: `errorType`, `errorMessage`, `fullResult`

Or modify the console.error call to use JSON.stringify:

```javascript
console.error('[OrdersQueue] Rider assignment failed:', 
  JSON.stringify({
    errorType,
    errorMessage,
    fullResult: assignmentResult
  }, null, 2)
);
```

## Next Steps

1. ✅ Apply Migration 061 to make customer_id nullable
2. ✅ Verify/create rider record in public.users
3. ✅ Logout and login again to trigger auto-create
4. ✅ Test rider assignment
5. ✅ Check logs for actual error details

## Related Files

- **Migration**: `supabase/migrations/061_make_customer_id_nullable.sql`
- **Quick Fix**: `FIX_CUSTOMER_ID_NOT_NULL.sql`
- **Documentation**: `FIX_CUSTOMER_ID_CONSTRAINT_GUIDE.md`
- **Frontend**: `pages/cashier/orders-queue.js` (line 448)
- **Backend**: `supabase/migrations/058_atomic_rider_assignment.sql`
- **Login Logic**: `pages/login.js` (lines 52-96 auto-create profile)
