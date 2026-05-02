# QUICK FIX: johndave0991@gmail.com Role Correction

## Problem
User `johndave0991@gmail.com` is seeing the **rider interface** but should see the **customer interface**.

## Solution
Run Migration 064 to update the database.

## How to Fix (3 Steps)

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase Dashboard
2. Click **SQL Editor** in the left sidebar

### Step 2: Run Migration
Copy and paste this entire SQL script, then click **Run**:

```sql
-- Migration 064: Fix johndave0991@gmail.com role to customer

BEGIN;

-- Update role to customer and ensure customer_id is set
DO $$
DECLARE
  user_record RECORD;
  new_customer_id TEXT;
BEGIN
  SELECT * INTO user_record
  FROM users
  WHERE email = 'johndave0991@gmail.com';
  
  IF user_record IS NULL THEN
    RAISE NOTICE 'User not found. No action needed.';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Found user: % (current role: %)', user_record.email, user_record.role;
  
  IF user_record.role != 'customer' THEN
    -- Generate customer_id if not present
    IF user_record.customer_id IS NULL THEN
      new_customer_id := 'CUST-' || 
                        EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || 
                        UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 25));
    ELSE
      new_customer_id := user_record.customer_id;
    END IF;
    
    -- Update to customer role
    UPDATE users
    SET role = 'customer',
        customer_id = new_customer_id,
        updated_at = NOW()
    WHERE email = 'johndave0991@gmail.com';
    
    RAISE NOTICE 'Updated role to customer with customer_id: %', new_customer_id;
  ELSE
    RAISE NOTICE 'Already customer role';
  END IF;
  
  -- Remove any rider profile
  DELETE FROM riders
  WHERE user_id IN (SELECT id FROM users WHERE email = 'johndave0991@gmail.com');
  
  IF FOUND THEN
    RAISE NOTICE 'Removed rider profile';
  END IF;
END $$;

-- Verify the fix
SELECT email, role, customer_id FROM users WHERE email = 'johndave0991@gmail.com';

COMMIT;
```

### Step 3: Test
1. Log out if currently logged in as `johndave0991@gmail.com`
2. Log back in
3. Should redirect to `/customer/dashboard` ✅

## Expected Output
```
NOTICE:  Found user: johndave0991@gmail.com (current role: rider)
NOTICE:  Updated role to customer with customer_id: CUST-1234567890-ABC123
NOTICE:  Removed rider profile

      email             | role     | customer_id
------------------------+----------+----------------------
 johndave0991@gmail.com | customer | CUST-1234567890-ABC123
```

## Important Note
⚠️ **Two different emails exist:**
- `johndave0991@bitebonansacafe.com` = **Rider** (company email) ✅ Correct
- `johndave0991@gmail.com` = **Customer** (personal email) ✅ This fix

The domain matters!

## Need More Details?
See complete documentation in:
- `FIX_JOHNDAVE_GMAIL_ROLE.md` - Full summary
- `supabase/migrations/RUN_MIGRATION_064.md` - Detailed migration guide
- `supabase/migrations/064_fix_johndave_gmail_role.sql` - Complete migration file
