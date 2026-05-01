# Rider Assignment and Profile Issues - Complete Fix Guide

## Overview

This document provides a complete guide to fixing two related issues with the rider system:

1. **FK Constraint Violation** on rider assignment
2. **NOT NULL Constraint Violation** on rider profile save

Both issues stem from schema mismatches between the migration files and the actual database.

---

## Issue 1: FK Constraint Violation on Rider Assignment

### Error Message
```
[OrdersQueue] Failed to assign rider: insert or update on table "orders" violates foreign key constraint "orders_rider_id_fkey"
```

### Root Cause

The rider exists in Supabase Auth (`auth.users`) but NOT in the public `users` table. The FK constraint `orders.rider_id` references `public.users.id`, causing the assignment to fail.

This happens when:
- User creates account directly through Supabase Auth (not via /api/register)
- User's public.users record was deleted but auth.users record remains

### Solution

**Auto-create user profile on login** (already implemented in previous fix)

The login page now automatically creates a user profile in `public.users` if missing:

```javascript
// pages/login.js lines 54-105
if (!userData) {
  const userRole = getRoleForEmail(data.user.email);
  const profileData = {
    id: data.user.id,
    email: data.user.email,
    full_name: data.user.user_metadata?.full_name || null,
    phone: data.user.user_metadata?.phone || null,
    role: userRole
  };
  
  if (userRole === 'customer') {
    profileData.customer_id = generateCustomerId();
  }
  
  await supabase.from('users').insert(profileData);
}
```

### Verification

1. Rider logs in → Profile auto-created in public.users
2. Fallback query finds rider in users table
3. FK constraint passes (user exists in public.users)
4. Rider can be assigned to orders

---

## Issue 2: NOT NULL Constraint on Rider Profile Save

### Error Message
```
[RiderProfile] Failed to save profile: null value in column "name" of relation "riders" violates not-null constraint
```

### Root Cause

The production database has an undocumented `name` column in the `riders` table with a NOT NULL constraint. This column is **NOT** in the migration files (050, 053) because:

1. Rider names should come from `users.full_name` via `user_id` foreign key
2. The `riders` table should only store rider-specific info
3. This prevents data duplication and maintains normalized schema

The profile save code (lines 187-200 in `pages/rider/profile.js`) doesn't include a `name` field, causing the save to fail.

### Solution

**Run Migration 055** to fix the schema mismatch

Migration `055_fix_riders_name_column.sql` will:
1. Check if `name` column exists
2. Drop it if empty (preferred - matches migration schema)
3. Make it nullable if it contains data (preserves existing data)

---

## Complete Fix Steps

### Step 1: Ensure Latest Code is Deployed

The auto-create user profile fix is already in the code on branch `copilot/fix-no-rider-available-error`. Make sure this is deployed.

### Step 2: Run Migration 055

**Via Supabase Dashboard:**

1. Go to Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy contents of `supabase/migrations/055_fix_riders_name_column.sql`
5. Paste and click **Run**
6. Verify success messages

**Via Supabase CLI:**

```bash
supabase db push --include-all
```

### Step 3: Test the Fixes

**Test 1: Rider Login & Profile Creation**
1. Ensure rider account exists in Supabase Auth
2. Log in as rider (johndave0991@bitebonansacafe.com or rider@youremail.com)
3. Should successfully log in and redirect to /rider/dashboard
4. Check that user exists in public.users table:
   ```sql
   SELECT * FROM users WHERE email = 'johndave0991@bitebonansacafe.com';
   ```

**Test 2: Rider Profile Save**
1. While logged in as rider, go to `/rider/profile`
2. Fill in required fields:
   - Driver ID
   - Vehicle Type
   - Vehicle Plate
   - Phone numbers
3. Click Save
4. Should succeed without "name" column error
5. Verify in database:
   ```sql
   SELECT * FROM riders WHERE user_id = (
     SELECT id FROM users WHERE email = 'johndave0991@bitebonansacafe.com'
   );
   ```

**Test 3: Rider Assignment**
1. Log in as cashier
2. Go to **Orders Queue** (`/cashier/orders-queue`)
3. Create or select a delivery order
4. Click "Assign Rider"
5. Rider should appear in the list (with ⚠️ badge if profile incomplete)
6. Click on rider to assign
7. Should succeed without FK constraint error
8. Order status should update to "out_for_delivery"

---

## Schema Reference

### Users Table (Relevant Fields)
```sql
users (
  id UUID PRIMARY KEY,           -- From Supabase Auth
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,                -- Rider's name stored here
  phone TEXT,
  role TEXT,                     -- 'rider', 'cashier', 'customer', 'admin'
  customer_id TEXT,              -- Only for customers
  created_at TIMESTAMP
)
```

### Riders Table (Correct Schema)
```sql
riders (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id),  -- FK to users table
  driver_id VARCHAR(50) UNIQUE NOT NULL,
  vehicle_type VARCHAR(50),
  vehicle_plate VARCHAR(20),
  cellphone_number VARCHAR(20),
  emergency_contact VARCHAR(255),
  emergency_phone VARCHAR(20),
  is_available BOOLEAN DEFAULT true,
  total_earnings DECIMAL(10,2) DEFAULT 0,
  deliveries_completed INT DEFAULT 0,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
-- NOTE: NO "name" column - use JOIN with users table to get full_name
```

### Orders Table (Relevant Field)
```sql
orders (
  id TEXT PRIMARY KEY,
  rider_id UUID REFERENCES users(id),  -- FK to users.id (NOT riders.id)
  status TEXT,
  order_mode TEXT,
  ...
)
```

---

## How to Get Rider Name

Always join with the users table:

```sql
SELECT 
  r.*,
  u.full_name AS rider_name,
  u.email
FROM riders r
JOIN users u ON r.user_id = u.id
WHERE r.is_available = true;
```

Or use the `available_riders_view` (migration 054):

```sql
SELECT * FROM available_riders_view WHERE is_available = true;
```

---

## Troubleshooting

### If FK Constraint Still Fails

1. **Check user exists:**
   ```sql
   SELECT id, email, role FROM users WHERE email = 'rider@email.com';
   ```

2. **Check rider record:**
   ```sql
   SELECT * FROM riders WHERE user_id = 'user-id-here';
   ```

3. **Check order update:**
   ```sql
   SELECT id, rider_id, status FROM orders WHERE id = 'order-id-here';
   ```

4. **Check RLS policies:**
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'orders';
   ```

### If Profile Save Still Fails

1. **Verify name column is gone:**
   ```sql
   SELECT column_name, is_nullable 
   FROM information_schema.columns 
   WHERE table_name = 'riders' AND column_name = 'name';
   ```

2. **Check for other unexpected columns:**
   ```sql
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'riders'
   ORDER BY ordinal_position;
   ```

3. **Review error logs:**
   Look for detailed constraint violation messages

---

## Prevention

To prevent similar issues:

1. ✅ **Use migration files** - Never modify database schema manually
2. ✅ **Keep migrations in sync** - Always commit migration changes to git
3. ✅ **Test locally first** - Run migrations in development before production
4. ✅ **Review schemas regularly** - Compare migrations with actual database
5. ✅ **Document changes** - Add comments and README files for complex migrations

---

## Related Files

- `pages/login.js` - Auto-create user profile logic
- `pages/rider/profile.js` - Rider profile save logic
- `pages/cashier/orders-queue.js` - Rider assignment logic
- `supabase/migrations/050_create_rider_portal_tables.sql` - Original riders table
- `supabase/migrations/053_fix_riders_table_schema.sql` - Schema fixer
- `supabase/migrations/055_fix_riders_name_column.sql` - Name column fix
- `FIX_RIDERS_NAME_COLUMN.md` - Detailed migration 055 documentation

---

## Support

If issues persist after following this guide:

1. Check browser console for detailed error messages
2. Check Supabase logs for database errors
3. Verify all migrations have run successfully
4. Contact support with:
   - Error messages (full text)
   - Database schema output (from troubleshooting queries)
   - Steps to reproduce the issue
