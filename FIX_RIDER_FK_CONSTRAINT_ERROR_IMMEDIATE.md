# IMMEDIATE FIX: Rider Assignment FK Constraint Error

## Error You're Seeing

```
Failed to assign rider: Database foreign key constraint violation.

Details: Foreign key constraint violation: insert or update on table 
"orders" violates foreign key constraint "orders_rider_id_fkey"
```

Console logs:
```
[OrdersQueue] Rider assignment failed: Object
```

---

## Root Cause

**The rider user does NOT exist in the `public.users` table.**

### Why?

1. When rider logs in, the app tries to auto-create their profile in `public.users`
2. The SQL tries: `INSERT INTO users (id, email, full_name, role, customer_id) VALUES (..., 'rider', NULL)`
3. **This FAILS** because `customer_id` has a `NOT NULL` constraint
4. Since insert fails, rider doesn't exist in `public.users`
5. When cashier tries to assign this rider to an order:
   - `orders.rider_id` tries to reference `users.id`
   - But the rider's `users.id` doesn't exist
   - **Foreign key constraint violation!**

---

## THE FIX (3 Steps - Takes 2 Minutes)

### ✅ STEP 1: Fix the Database Constraint

**Run this in your Supabase SQL Editor:**

```sql
-- Make customer_id nullable (only customers need it, not riders!)
ALTER TABLE public.users 
  ALTER COLUMN customer_id DROP NOT NULL;

-- Verify it worked
SELECT 
  is_nullable,
  CASE 
    WHEN is_nullable = 'YES' THEN '✓ SUCCESS - Fixed!'
    ELSE '✗ FAILED - Try again'
  END AS status
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'customer_id';
```

**Expected result:** You should see `is_nullable = YES` and status `✓ SUCCESS - Fixed!`

---

### ✅ STEP 2: Create Missing Rider User

Now that `customer_id` can be NULL, create the rider user manually.

**First, get the rider's auth ID:**

```sql
-- Find rider in auth.users
SELECT 
  id as auth_id,
  email,
  'Copy this ID ↑' as instruction
FROM auth.users
WHERE email ILIKE '%rider%' 
   OR email ILIKE '%johndave%';
```

**Copy the `auth_id` (UUID) from the results.**

**Then create the user profile:**

```sql
-- Replace <PASTE_AUTH_ID_HERE> with the UUID you copied above
-- Replace email and name with actual values if different

INSERT INTO public.users (
  id,
  email,
  full_name,
  role,
  customer_id  -- NULL for riders (that's the point of this fix!)
)
VALUES (
  '<PASTE_AUTH_ID_HERE>',  -- ← PASTE THE UUID HERE
  'johndave0991@bitebonansacafe.com',
  'John Dave Salvaleon',
  'rider',
  NULL  -- Riders don't need customer_id
)
ON CONFLICT (id) DO UPDATE
SET role = 'rider',
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;

-- Verify
SELECT 
  id,
  email,
  full_name,
  role,
  customer_id,
  '✓ Rider user created!' as status
FROM public.users
WHERE email ILIKE '%johndave%';
```

---

### ✅ STEP 3: Test the Assignment

1. **Refresh the browser page** (hard refresh: Ctrl+Shift+R or Cmd+Shift+R)
2. **Go to Orders Queue** page
3. **Try assigning the rider** to a delivery order
4. **Should work now!** ✅

---

## Alternative: Trigger Auto-Create (Easier)

If you don't want to manually create the user, just:

1. **Apply STEP 1** (make `customer_id` nullable)
2. **Rider logs out** completely from the app
3. **Rider logs in again** 
   - The auto-create logic will now succeed (because `customer_id` can be NULL)
   - User profile will be created automatically
4. **Cashier refreshes Orders Queue page**
5. **Try assigning rider** → Should work! ✅

---

## Verification Queries

### Check if rider exists in public.users:

```sql
SELECT 
  u.id,
  u.email,
  u.role,
  u.customer_id,
  CASE 
    WHEN u.id IS NOT NULL THEN '✓ User exists in public.users'
    ELSE '✗ User missing from public.users'
  END as status
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
WHERE au.email ILIKE '%johndave%' OR au.email ILIKE '%rider%';
```

### Check if rider can be assigned:

```sql
-- This should return the rider's info
SELECT 
  u.id as rider_id,
  u.email,
  u.full_name,
  u.role,
  '✓ This rider can be assigned to orders' as status
FROM public.users u
WHERE u.role = 'rider'
  AND (u.email ILIKE '%johndave%' OR u.email ILIKE '%rider%');
```

If this query returns results, the rider can be assigned!

---

## Why Did This Happen?

The database schema had an incorrect constraint:
- `customer_id NOT NULL` ← **Wrong!** Only customers need this
- Should be: `customer_id NULL` for riders, cashiers, admins

This is a schema design issue that's now fixed by Migration 061.

---

## Files to Reference

- **Quick Fix SQL**: `FIX_CUSTOMER_ID_NOT_NULL.sql`
- **Migration**: `supabase/migrations/061_make_customer_id_nullable.sql`
- **Diagnostic Guide**: `DIAGNOSE_RIDER_ASSIGNMENT_ERROR.md`
- **Diagnostic Script**: `diagnose_rider_assignment_error.sql`

---

## Still Not Working?

If after following all 3 steps it still fails:

1. **Run the diagnostic script**: `diagnose_rider_assignment_error.sql`
2. **Check browser console** - click on the "Object" to expand and see actual error
3. **Share the output** from the diagnostic script

---

## Prevention

After applying this fix, all future rider logins will work correctly. The `customer_id` column is now properly nullable, allowing:
- ✓ Customers: have `customer_id` value
- ✓ Riders: have `customer_id = NULL`
- ✓ Cashiers: have `customer_id = NULL`
- ✓ Admins: have `customer_id = NULL`

This is the correct schema design! 🎉
