-- Migration: Fix johndave0991@gmail.com role to customer
-- 
-- PROBLEM:
-- The email johndave0991@gmail.com was incorrectly assigned the 'rider' role in the database,
-- causing them to see the rider interface instead of the customer interface.
--
-- SOLUTION:
-- Update the role to 'customer' in the users table and ensure customer_id is set.
-- Also remove any rider profile records for this email.
--
-- RELATED:
-- - utils/roleMapping.js only maps johndave0991@bitebonansacafe.com to 'rider'
-- - johndave0991@gmail.com should default to 'customer' role
--
-- Author: GitHub Copilot
-- Date: 2026-05-02

BEGIN;

-- Display current state for verification
DO $$
BEGIN
  RAISE NOTICE 'Checking current role for johndave0991@gmail.com...';
END $$;

SELECT 
  id,
  email,
  full_name,
  role,
  customer_id,
  created_at
FROM users
WHERE email = 'johndave0991@gmail.com';

-- Update role to customer and ensure customer_id is set
DO $$
DECLARE
  user_record RECORD;
  new_customer_id TEXT;
BEGIN
  -- Get the user record
  SELECT * INTO user_record
  FROM users
  WHERE email = 'johndave0991@gmail.com';
  
  IF user_record IS NULL THEN
    RAISE NOTICE 'User johndave0991@gmail.com not found. No action needed.';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Found user: % (role: %)', user_record.email, user_record.role;
  
  IF user_record.role = 'customer' THEN
    RAISE NOTICE 'User already has customer role. Checking customer_id...';
    
    -- Ensure customer_id is set even if role is already correct
    IF user_record.customer_id IS NULL THEN
      new_customer_id := 'CUST-' || 
                        EXTRACT(EPOCH FROM NOW())::BIGINT || '-' || 
                        UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 25));
      
      UPDATE users
      SET customer_id = new_customer_id,
          updated_at = NOW()
      WHERE email = 'johndave0991@gmail.com';
      
      RAISE NOTICE 'Set customer_id to: %', new_customer_id;
    ELSE
      RAISE NOTICE 'Customer_id already set: %', user_record.customer_id;
    END IF;
  ELSE
    RAISE NOTICE 'Updating role from % to customer...', user_record.role;
    
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
  END IF;
  
  -- Remove any rider profile records for this email
  DELETE FROM riders
  WHERE user_id IN (
    SELECT id FROM users WHERE email = 'johndave0991@gmail.com'
  );
  
  IF FOUND THEN
    RAISE NOTICE 'Removed rider profile for johndave0991@gmail.com';
  ELSE
    RAISE NOTICE 'No rider profile found to remove';
  END IF;
  
END $$;

-- Display final state for verification
DO $$
BEGIN
  RAISE NOTICE 'Final state after update:';
END $$;

SELECT 
  id,
  email,
  full_name,
  role,
  customer_id,
  updated_at
FROM users
WHERE email = 'johndave0991@gmail.com';

-- Summary
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 064 Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'User johndave0991@gmail.com is now configured as customer';
  RAISE NOTICE 'Any rider profile has been removed';
  RAISE NOTICE 'User will see customer interface on next login';
  RAISE NOTICE '========================================';
END $$;

COMMIT;
