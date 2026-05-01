-- Migration 052: Add rider@youremail.com to rider role mapping
-- This migration updates the role for rider@youremail.com to 'rider' if the account exists

-- Update user role to 'rider' if the account exists
UPDATE users 
SET role = 'rider' 
WHERE email = 'rider@youremail.com' 
  AND role != 'rider';

-- Log the change
DO $$
DECLARE
  affected_rows INT;
BEGIN
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  
  IF affected_rows > 0 THEN
    RAISE NOTICE 'Updated % user(s) with email rider@youremail.com to rider role', affected_rows;
  ELSE
    RAISE NOTICE 'No existing user found with email rider@youremail.com, or user already has rider role';
  END IF;
END $$;

-- Verify the change
SELECT id, email, role, full_name 
FROM users 
WHERE email = 'rider@youremail.com';
