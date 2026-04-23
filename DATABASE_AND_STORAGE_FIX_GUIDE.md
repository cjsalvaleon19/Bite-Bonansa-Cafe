# Database and Storage Setup Fix Guide

## Problem Summary

The application is experiencing the following errors:
1. **Missing Database Tables** (404 errors):
   - `loyalty_transactions` - for customer loyalty points tracking
   - `customer_item_purchases` - for purchase history tracking
   - `customer_reviews` - for customer reviews with images

2. **Missing Storage Bucket** (400 error):
   - `reviews` bucket - for storing customer review images

3. **Orders Query Issue** (400 error):
   - Issue with the `.or()` query syntax in Supabase

4. **Google Maps Warnings** (non-critical):
   - API not activated
   - Deprecated features

## Solution: Complete Database and Storage Setup

### Step 1: Create Database Tables

You need to run the SQL migration script to create the missing tables. We have a complete migration script ready.

**Option A: Using Supabase SQL Editor (Recommended)**

1. Go to your Supabase project dashboard at [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project: `bffpcgsevigxpldidxgl`
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy the entire contents of `SUPABASE_MIGRATION.sql` from this repository
6. Paste it into the SQL editor
7. Click **Run** or press `Ctrl+Enter`

**What this script does:**
- Creates 3 missing tables with proper structure and constraints
- Sets up Row Level Security (RLS) policies for each table
- Creates indexes for optimal query performance
- Sets up triggers to automatically track purchase history and loyalty points
- Creates delivery fee calculation functions

**Option B: Using Supabase CLI**

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref bffpcgsevigxpldidxgl

# Run the migration
supabase db push --file SUPABASE_MIGRATION.sql
```

### Step 2: Create Storage Bucket for Review Images

The `reviews` storage bucket must be created to store customer review images.

**Using Supabase Dashboard:**

1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **New Bucket**
4. Configure the bucket:
   - **Name**: `reviews`
   - **Public**: ✅ **MUST be checked** (allows public access to review images)
   - **File size limit**: 5 MB
   - **Allowed MIME types**: 
     - `image/jpeg`
     - `image/png`
     - `image/webp`
     - `image/gif`
5. Click **Create Bucket**

**After creating the bucket, set up storage policies:**

Go to **Storage** → **Policies** → Click on the `reviews` bucket, then add these policies:

```sql
-- Policy 1: Allow authenticated users to upload
CREATE POLICY "Allow authenticated uploads to reviews"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'reviews');

-- Policy 2: Allow public read access
CREATE POLICY "Allow public read access to reviews"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'reviews');

-- Policy 3: Allow users to update/delete their own files
CREATE POLICY "Allow users to update their own review images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'reviews' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Allow users to delete their own review images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'reviews' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### Step 3: Verify Database Tables

After running the migration, verify all tables were created successfully:

```sql
-- Check if all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('loyalty_transactions', 'customer_item_purchases', 'customer_reviews')
ORDER BY table_name;
```

You should see all 3 tables listed.

**Check RLS is enabled:**

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('loyalty_transactions', 'customer_item_purchases', 'customer_reviews');
```

All tables should have `rowsecurity = true`.

### Step 4: Verify Storage Bucket

Verify the bucket was created:

```sql
SELECT * FROM storage.buckets WHERE id = 'reviews';
```

Expected result:
```
id      | name    | public | created_at
--------|---------|--------|------------
reviews | reviews | true   | <timestamp>
```

### Step 5: Test the Application

After completing steps 1-4, refresh your application and test:

1. **Customer Dashboard** (`/customer/dashboard`)
   - Should load without 404 errors
   - Loyalty balance should display (initially 0)
   - Most purchased items section should load

2. **Customer Reviews** (`/customer/reviews`)
   - Should be able to submit reviews
   - Image upload should work without "Bucket not found" error

3. **Order Tracking** (`/customer/order-tracking`)
   - Should display orders correctly

## Additional Fixes

### Fix 1: Orders Query Issue (400 Error)

The error with the orders query is already handled in the code correctly:
```javascript
.or('status.eq.order_in_queue,status.eq.order_in_process,status.eq.out_for_delivery')
```

This is the correct Supabase syntax. If you still see 400 errors, check:
1. Ensure the `orders` table has a `status` column
2. Verify the status values match exactly (case-sensitive)

### Fix 2: Google Maps Issues (Optional)

These are warnings, not critical errors, but to fix them:

1. **API Not Activated Error**:
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Enable "Maps JavaScript API" for your project
   - Make sure your API key has the correct restrictions

2. **Deprecated Marker Warning**:
   - This is just a deprecation warning
   - The old API still works but consider upgrading to `AdvancedMarkerElement` in future updates

3. **Autocomplete Deprecation Warning**:
   - Similar to above, the old API still works
   - Consider upgrading to `PlaceAutocompleteElement` in future updates

### Fix 3: Header Element Issue

The error `Could not find element with selector .header-and-quick-actions-mfe-Header--organisation-name-text` suggests a microfrontend component issue. This is likely:

1. A missing or incorrectly loaded component
2. Check if there's a header component that should be loaded
3. Verify all component dependencies are properly installed

## Troubleshooting

### Error: "relation does not exist"
- **Cause**: Tables haven't been created yet
- **Solution**: Run the SQL migration script (Step 1)

### Error: "Bucket not found"
- **Cause**: The `reviews` storage bucket hasn't been created
- **Solution**: Create the bucket via Supabase Dashboard (Step 2)

### Error: "New row violates row-level security policy"
- **Cause**: RLS policies haven't been set up correctly
- **Solution**: Re-run the migration script which includes RLS policies

### Error: "PGRST116 - table not found"
- **Cause**: Table doesn't exist in the database
- **Solution**: The application code already handles this gracefully, but you should still create the tables

## Files Reference

- **Migration Script**: `SUPABASE_MIGRATION.sql` - Complete database setup
- **Alternative Schema**: `database_complete_schema.sql` - Same as migration script
- **Storage Guide**: `STORAGE_BUCKET_SETUP.md` - Detailed storage bucket setup
- **Customer Dashboard**: `pages/customer/dashboard.js` - Uses all 3 tables
- **Customer Reviews**: `pages/customer/reviews.js` - Uses reviews table and storage

## Quick Checklist

- [ ] Run `SUPABASE_MIGRATION.sql` in Supabase SQL Editor
- [ ] Verify all 3 tables were created
- [ ] Create `reviews` storage bucket (public)
- [ ] Add storage bucket policies
- [ ] Verify bucket was created successfully
- [ ] Test customer dashboard (should load without errors)
- [ ] Test customer reviews (image upload should work)
- [ ] Clear browser cache and test again

## Expected Results After Fix

✅ No more 404 errors for missing tables  
✅ No more "Bucket not found" errors  
✅ Customer dashboard loads correctly  
✅ Loyalty balance displays (initially 0)  
✅ Reviews can be submitted with images  
✅ Purchase history tracking works  
✅ Automatic loyalty points on order completion  

## Need Help?

If you encounter issues:
1. Check Supabase logs in Dashboard → Logs
2. Check browser console for detailed error messages
3. Verify your Supabase URL and anon key in `.env.local`
4. Make sure you're using the correct project (bffpcgsevigxpldidxgl)

---

**Note**: The application code already has proper error handling for missing tables (PGRST116 error), so it won't crash. However, features dependent on these tables won't work until the tables are created.
