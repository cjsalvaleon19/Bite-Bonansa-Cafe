# Troubleshooting Guide

## Issue: Rider login shows customer portal

If you're logging in with a rider account (johndave0991@gmail.com) but seeing the customer portal instead of the rider dashboard, the issue is likely that your user role in the database is not set correctly.

### Solution 1: Check your role in the database

Run this query in your Supabase SQL Editor:

```sql
SELECT id, email, role FROM users WHERE email = 'johndave0991@gmail.com';
```

The `role` column should show `'rider'`. If it shows `'customer'` or something else, you need to update it.

### Solution 2: Update the role manually

Run this update query in your Supabase SQL Editor:

```sql
UPDATE users SET role = 'rider' WHERE email = 'johndave0991@gmail.com';
```

Then log out and log back in.

### Solution 3: Re-register (if new account)

If this is a newly registered account, the role should have been set automatically during registration. If not, there may be an issue with the role mapping. Delete the account and re-register:

```sql
-- Delete from users table
DELETE FROM users WHERE email = 'johndave0991@gmail.com';

-- Also delete from auth.users (if you have permissions)
-- This may require admin access
```

Then re-register through the registration page.

## Issue: 404 errors for loyalty_transactions and customer_item_purchases

These tables may not exist in your database. Run the database schema creation script to create them:

1. Go to your Supabase SQL Editor
2. Open the file `/database_schema.sql`
3. Run the entire script to create all missing tables

## Issue: 400 error on orders query

This was caused by incorrect Supabase filter syntax. The code has been updated to use the correct syntax:
- Changed from `.not('status', 'eq', 'value')` to `.not('status', 'in', '("value1","value2")')`

## Issue: Service Worker errors

If you see service worker installation errors or caching issues:

1. Clear your browser cache
2. Unregister the service worker:
   - Open DevTools → Application → Service Workers
   - Click "Unregister" for the Bite Bonansa service worker
3. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
4. The service worker will reinstall automatically

## Fixed Role Assignments

The following email addresses have fixed role assignments:

- `cjsalvaleon19@gmail.com` → Admin
- `arclitacj@gmail.com` → Cashier  
- `johndave0991@gmail.com` → Rider
- All other accounts → Customer

These roles are automatically assigned during registration.
