-- Migration 098: Fix cjsalvaleon19@bitebonansacafe.com role to admin
--
-- PROBLEM:
-- cjsalvaleon19@bitebonansacafe.com was assigned 'customer' role at
-- registration because the email was missing from the FIXED_ROLES mapping
-- in utils/roleMapping.js.  The user should have admin access.
--
-- SOLUTION:
-- Update the role to 'admin' in the users table for this email.

BEGIN;

DO $$
DECLARE
  v_user RECORD;
BEGIN
  SELECT id, email, role INTO v_user
  FROM users
  WHERE email = 'cjsalvaleon19@bitebonansacafe.com';

  IF v_user IS NULL THEN
    RAISE NOTICE 'User cjsalvaleon19@bitebonansacafe.com not found – no action needed.';
    RETURN;
  END IF;

  IF v_user.role = 'admin' THEN
    RAISE NOTICE 'User % already has admin role – no action needed.', v_user.email;
    RETURN;
  END IF;

  UPDATE users
  SET role       = 'admin',
      updated_at = NOW()
  WHERE id = v_user.id;

  RAISE NOTICE 'Updated % (id: %) from role "%" to "admin".', v_user.email, v_user.id, v_user.role;
END $$;

COMMIT;
