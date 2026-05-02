# 🚀 Migration 062 Deployment Guide

## Fix: orders_rider_id_fkey Error

**Migration File:** `supabase/migrations/062_fix_orders_rider_id_fkey_comprehensive.sql`

---

## 🎯 What This Fixes

This migration resolves the persistent **foreign key constraint violation** error:

```
Failed to assign rider: insert or update on table "orders" 
violates foreign key constraint "orders_rider_id_fkey"
```

---

## 🔧 Root Causes Addressed

1. **customer_id NOT NULL constraint** - Blocked creation of rider users
2. **Missing riders in public.users** - Riders exist in auth but not in app DB
3. **Orphaned rider records** - Riders table has records without valid user_id
4. **Missing CASCADE constraints** - FK relationships not properly enforced

---

## 📋 How to Deploy

### Method 1: Supabase SQL Editor (Recommended)

1. **Open Supabase Dashboard**
   - Go to your project
   - Click on **SQL Editor** in the left sidebar

2. **Copy the Migration**
   - Open file: `supabase/migrations/062_fix_orders_rider_id_fkey_comprehensive.sql`
   - Copy the **entire file contents** (all ~400 lines)

3. **Run the Migration**
   - Paste into SQL Editor
   - Click **RUN**
   - Wait for execution to complete

4. **Review Output**
   - You should see success messages for each step
   - Check the "Available Riders" table at the end
   - Look for any WARNING messages

### Method 2: Supabase CLI

```bash
# From repository root
supabase db push

# Or run specific migration
supabase migration up --db-url "your-db-url" 062_fix_orders_rider_id_fkey_comprehensive.sql
```

---

## ✅ Expected Results

After running the migration, you should see output like:

```
STEP 1: Making customer_id nullable...
✓ customer_id is now nullable

STEP 2: Syncing riders from auth.users to public.users...
✓ Synced rider: johndave0991@bitebonansacafe.com (ID: xxx-xxx-xxx)
✓ Synced 1 rider(s) from auth.users to public.users

STEP 3: Ensuring correct role for rider emails...
✓ All rider emails already have correct role

STEP 4: Cleaning up orphaned riders...
✓ No orphaned riders found

STEP 5: Ensuring riders.user_id FK has ON DELETE CASCADE...
✓ FK already has ON DELETE CASCADE

STEP 6: Validating orders.rider_id FK constraint...
✓ All orders have valid rider_id references
✓ FK constraint orders_rider_id_fkey exists

STEP 7: Verification Report
Total riders in public.users: 1
Riders with complete profiles: 0
Riders without profiles: 1

=== Available Riders ===
id                                   | email                              | full_name          | role  | profile_status
-------------------------------------|------------------------------------|--------------------|-------|------------------
xxx-xxx-xxx                          | johndave0991@bitebonansacafe.com  | John Dave Salvaleon| rider | ✗ Missing Profile

Migration 062 Complete - orders_rider_id_fkey Error Fixed!
```

---

## 🔍 Post-Deployment Verification

### 1. Check Database State

Run this query in SQL Editor:

```sql
-- Verify customer_id is nullable
SELECT column_name, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'customer_id';
-- Expected: is_nullable = YES

-- Check riders in public.users
SELECT id, email, full_name, role 
FROM public.users 
WHERE role = 'rider';
-- Expected: At least one rider (johndave0991@bitebonansacafe.com)

-- Check FK constraint
SELECT conname, confdeltype
FROM pg_constraint
WHERE conname = 'orders_rider_id_fkey';
-- Expected: One row returned
```

### 2. Test Rider Assignment

1. **Refresh your browser** (hard refresh: Ctrl+Shift+R or Cmd+Shift+R)
2. **Log in as cashier**
3. **Go to Orders Queue**
4. **Create a test delivery order**
5. **Try to assign rider**

**Expected outcomes:**

- ✅ **If rider appears in dropdown AND assignment works**: Perfect! Migration successful.
- ⚠️ **If rider appears but assignment fails with "Missing profile"**: 
  - Rider needs to complete their profile
  - Log in as rider
  - Visit `/rider/profile`
  - Fill in required fields
  - Try assignment again
- ❌ **If rider doesn't appear**: Check Step 2 output - rider may not have been synced

---

## 🐛 Troubleshooting

### Issue: Migration fails at Step 1

**Error:** `column "customer_id" does not exist`

**Cause:** Users table doesn't have customer_id column yet

**Fix:** This is not a critical error. The migration will continue and skip this step.

---

### Issue: No riders synced in Step 2

**Output:** `✓ All rider users already synced (no action needed)`

**Check:** Run this query to see if riders exist:

```sql
SELECT a.id, a.email, p.id as public_id, p.role
FROM auth.users a
LEFT JOIN public.users p ON a.id = p.id
WHERE a.email LIKE '%rider%' OR a.email LIKE '%johndave%';
```

**If public_id is NULL:** The migration should have created them. Re-run the migration.

**If public_id exists but role is not 'rider':** Run Step 3 manually:

```sql
UPDATE public.users
SET role = 'rider'
WHERE email IN (
  'johndave0991@bitebonansacafe.com',
  'johndave0991@gmail.com',
  'rider@youremail.com'
);
```

---

### Issue: Rider assignment still fails

**Error:** Same FK constraint violation

**Debug steps:**

1. **Get the rider ID being used:**
   - Open browser console (F12)
   - Try assigning rider
   - Look for the error in console
   - Note the `rider_id` value

2. **Check if that ID exists in users table:**
   ```sql
   SELECT id, email, role 
   FROM public.users 
   WHERE id = 'THE-RIDER-ID-FROM-CONSOLE';
   ```

3. **If no rows returned:** The ID doesn't exist in public.users
   - Check auth.users for that ID
   - Run sync manually:
   ```sql
   INSERT INTO public.users (id, email, full_name, role, customer_id)
   SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', 'Rider User'), 'rider', NULL
   FROM auth.users
   WHERE id = 'THE-RIDER-ID-FROM-CONSOLE'
   ON CONFLICT (id) DO UPDATE SET role = 'rider';
   ```

---

## 🔄 Rollback (If Needed)

If you need to rollback this migration:

```sql
-- Step 1: Re-add NOT NULL to customer_id (only if it was NOT NULL before)
-- WARNING: This will fail if any riders/cashiers exist with NULL customer_id
-- ALTER TABLE public.users ALTER COLUMN customer_id SET NOT NULL;

-- Step 2: Remove synced riders (ONLY IF THEY WERE CREATED BY THIS MIGRATION)
-- WARNING: Check carefully before running
-- DELETE FROM public.users 
-- WHERE role = 'rider' 
-- AND email IN ('johndave0991@bitebonansacafe.com', 'johndave0991@gmail.com', 'rider@youremail.com');

-- Note: Rollback is NOT recommended. If issues persist, fix forward instead.
```

---

## 📊 What Changed

| Component | Before | After |
|-----------|--------|-------|
| users.customer_id | NOT NULL | NULL allowed |
| Riders in public.users | Missing | Synced from auth.users |
| Rider role | Possibly wrong | Corrected to 'rider' |
| Orphaned riders | May exist | Cleaned up |
| FK constraints | May lack CASCADE | CASCADE enforced |

---

## 🎉 Success Criteria

✅ Migration runs without errors  
✅ customer_id is nullable  
✅ At least one rider exists in public.users with role='rider'  
✅ FK constraint orders_rider_id_fkey exists  
✅ Can assign rider to order in Cashier Dashboard  

---

## 📝 Next Steps After Deployment

1. **Test rider assignment** - Verify it works end-to-end
2. **Complete rider profiles** - Have riders log in and fill out /rider/profile
3. **Monitor for errors** - Check application logs for any FK violations
4. **Update documentation** - Mark this issue as resolved

---

## 🆘 Need Help?

If you encounter issues:

1. Check the **Verification Report** at the end of migration output
2. Run the **Post-Deployment Verification** queries above
3. Check browser console for specific error messages
4. Run the diagnostic script: `diagnose_rider_fk_issue.sql`

---

## 📚 Related Files

- **Migration:** `supabase/migrations/062_fix_orders_rider_id_fkey_comprehensive.sql`
- **Previous Migration:** `supabase/migrations/061_make_customer_id_nullable.sql`
- **Diagnostic:** `diagnose_rider_fk_issue.sql`
- **Quick Fix:** `FIX_RIDER_FK_ONE_COMMAND.sql`
- **Documentation:** `FIX_RIDER_ASSIGNMENT_FKEY_ERROR.md`

---

**Migration Version:** 062  
**Created:** 2026-05-02  
**Status:** Ready for deployment  
