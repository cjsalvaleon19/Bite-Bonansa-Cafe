# Migration 064: Fix johndave0991@gmail.com Role to Customer

## Problem

The email `johndave0991@gmail.com` was incorrectly assigned the 'rider' role in the database, causing the user to see the rider interface instead of the customer interface.

## Root Cause

According to `utils/roleMapping.js`, only the following emails have fixed role assignments:
- `cjsalvaleon19@gmail.com` → admin
- `arclitacj@gmail.com` → cashier
- `bantecj@bitebonansacafe.com` → cashier
- `johndave0991@bitebonansacafe.com` → rider (NOTE: @bitebonansacafe.com domain)
- `rider@youremail.com` → rider

**All other emails**, including `johndave0991@gmail.com` (NOTE: @gmail.com domain), should default to **customer** role.

However, if a database record already exists with `role='rider'`, the user will continue to see the rider interface because the login process uses the existing database role rather than creating a new one.

## Solution

Migration 064 performs the following actions:

1. **Updates the role** from 'rider' to 'customer' for `johndave0991@gmail.com`
2. **Ensures customer_id is set** (required for customer role)
3. **Removes any rider profile** records associated with this email
4. **Displays verification** before and after the changes

## How to Run

### Option 1: Supabase SQL Editor (Recommended)

1. Open your Supabase dashboard
2. Go to **SQL Editor**
3. Copy the entire contents of `064_fix_johndave_gmail_role.sql`
4. Paste into the SQL Editor
5. Click **Run**

### Option 2: Command Line (psql)

```bash
psql -h <your-supabase-host> \
     -U postgres \
     -d postgres \
     -f supabase/migrations/064_fix_johndave_gmail_role.sql
```

## Expected Output

```
NOTICE:  Checking current role for johndave0991@gmail.com...
 id | email | full_name | role | customer_id | created_at
----+-------+-----------+------+-------------+------------
 ... (current record)

NOTICE:  Found user: johndave0991@gmail.com (role: rider)
NOTICE:  Updating role from rider to customer...
NOTICE:  Updated role to customer with customer_id: CUST-1234567890-ABC123DEF456
NOTICE:  Removed rider profile for johndave0991@gmail.com

NOTICE:  Final state after update:
 id | email | full_name | role | customer_id | updated_at
----+-------+-----------+------+-------------+------------
 ... (updated record showing role=customer)

NOTICE:  ========================================
NOTICE:  Migration 064 Complete
NOTICE:  ========================================
NOTICE:  User johndave0991@gmail.com is now configured as customer
NOTICE:  Any rider profile has been removed
NOTICE:  User will see customer interface on next login
NOTICE:  ========================================
```

## Verification

After running the migration, verify the fix:

```sql
-- Check user role
SELECT id, email, role, customer_id
FROM users
WHERE email = 'johndave0991@gmail.com';

-- Should show:
-- role: customer
-- customer_id: CUST-... (some value)

-- Verify no rider profile exists
SELECT r.id, r.user_id, u.email
FROM riders r
JOIN users u ON r.user_id = u.id
WHERE u.email = 'johndave0991@gmail.com';

-- Should return 0 rows
```

## Testing

1. **Log out** the user `johndave0991@gmail.com` if currently logged in
2. **Log back in** with `johndave0991@gmail.com`
3. **Verify** user is redirected to `/customer/dashboard` (not `/rider/dashboard`)
4. **Verify** user sees customer interface with menu, orders, tracking, etc.

## Important Notes

- ✅ `johndave0991@bitebonansacafe.com` remains as rider (this is correct)
- ✅ `johndave0991@gmail.com` is now customer (this is the fix)
- ⚠️ **Note the domain difference**: @bitebonansacafe.com vs @gmail.com

## Related Files

- `utils/roleMapping.js` - Fixed role assignments
- `pages/login.js` - Login flow that creates users with roles from roleMapping
- `FIXED_ROLES_GUIDE.md` - Documentation (updated)
- `PORTAL_ACCESS_IMPLEMENTATION.md` - Documentation (updated)
- `DEPLOYMENT_GUIDE.md` - Documentation (updated)

## Rollback

If needed, you can rollback by manually updating the user:

```sql
-- ROLLBACK (only if needed - not recommended)
UPDATE users
SET role = 'rider',
    customer_id = NULL,
    updated_at = NOW()
WHERE email = 'johndave0991@gmail.com';
```

However, this is **not recommended** as the correct configuration is customer role.
