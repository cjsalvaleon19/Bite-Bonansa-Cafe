# Complete Supabase Setup Guide for Bite Bonansa Cafe

This guide provides step-by-step instructions to set up the complete Supabase database and storage for the Bite Bonansa Cafe application.

## Prerequisites

- A Supabase project created at [supabase.com](https://supabase.com)
- Access to the Supabase SQL Editor
- Access to the Supabase Storage dashboard

## Part 1: Database Migration

### Step 1: Run the Complete Migration SQL

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Create a new query
4. Copy the entire contents of `database_complete_migration.sql`
5. Paste it into the SQL editor
6. Click **Run** to execute the migration

This will create all necessary tables:
- ✅ `users` (with all required columns)
- ✅ `menu_items`
- ✅ `orders` (with enhanced fields)
- ✅ `customer_item_purchases` (for purchase history tracking)
- ✅ `customer_reviews` (for customer reviews with images)
- ✅ `loyalty_transactions` (for loyalty points tracking)
- ✅ `cash_drawer_transactions` (for cashier cash management)
- ✅ `delivery_reports` (for rider billing)
- ✅ `delivery_billing_notifications` (for rider payment notifications)
- ✅ `deliveries` (for delivery order management)
- ✅ `riders` (for rider profiles)

It will also create:
- ✅ All necessary indexes for performance
- ✅ Row Level Security (RLS) policies
- ✅ Database functions and triggers
- ✅ Delivery fee calculator functions
- ✅ Loyalty points automation
- ✅ Purchase tracking automation

### Step 2: Verify Table Creation

After running the migration, verify that all tables were created:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

You should see all 11 tables listed.

## Part 2: Storage Bucket Setup

### Step 3: Create the Reviews Storage Bucket

1. In your Supabase dashboard, navigate to **Storage** in the left sidebar
2. Click **Create a new bucket**
3. Configure the bucket:
   - **Name**: `reviews`
   - **Public bucket**: ✅ **Check this box** (to allow public read access)
   - Click **Create bucket**

### Step 4: Configure Bucket Policies

After creating the bucket, set up storage policies:

1. Click on the `reviews` bucket
2. Go to **Policies** tab
3. Create the following policies:

#### Policy 1: Allow Authenticated Users to Upload Images

Click **New Policy** and add:

```sql
-- Policy name: Allow authenticated uploads
-- Operation: INSERT
-- Policy definition:
(bucket_id = 'reviews'::text) AND (auth.role() = 'authenticated'::text)
```

Or use the Supabase UI:
- **Policy name**: Allow authenticated uploads
- **Allowed operation**: INSERT
- **Target roles**: authenticated
- **USING expression**: `bucket_id = 'reviews'`
- **WITH CHECK expression**: Leave empty (inherited from USING)

#### Policy 2: Allow Public Read Access

```sql
-- Policy name: Public read access
-- Operation: SELECT
-- Policy definition:
bucket_id = 'reviews'::text
```

Or use the Supabase UI:
- **Policy name**: Public read access
- **Allowed operation**: SELECT
- **Target roles**: public, authenticated
- **USING expression**: `bucket_id = 'reviews'`

#### Policy 3: Allow Users to Delete Their Own Images

```sql
-- Policy name: Users can delete their own images
-- Operation: DELETE
-- Policy definition:
(bucket_id = 'reviews'::text) AND (auth.uid()::text = (storage.foldername(name))[1])
```

Or use the Supabase UI:
- **Policy name**: Users can delete their own images
- **Allowed operation**: DELETE
- **Target roles**: authenticated
- **USING expression**: `(bucket_id = 'reviews') AND (auth.uid()::text = (storage.foldername(name))[1])`

### Alternative: Create Policies via SQL

Alternatively, you can create all storage policies at once using SQL Editor:

```sql
-- Enable storage on reviews bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('reviews', 'reviews', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policy: Allow authenticated users to upload
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'reviews');

-- Policy: Public read access
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'reviews');

-- Policy: Users can delete their own images
CREATE POLICY "Users can delete their own images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'reviews' AND auth.uid()::text = (storage.foldername(name))[1]);
```

## Part 3: Populate Menu Items (Optional)

If you don't have menu items yet, you can insert sample data:

```sql
-- Use the menu_items_insert.sql file or create your own items
INSERT INTO menu_items (name, category, price, description, available, image_url)
VALUES
  ('Classic Burger', 'Burgers', 150.00, 'Juicy beef patty with fresh vegetables', true, '/images/burger.jpg'),
  ('Fried Chicken', 'Chicken', 120.00, 'Crispy golden fried chicken', true, '/images/chicken.jpg'),
  ('Caesar Salad', 'Salads', 100.00, 'Fresh romaine with Caesar dressing', true, '/images/salad.jpg'),
  ('Iced Coffee', 'Beverages', 80.00, 'Refreshing iced coffee', true, '/images/coffee.jpg');
```

Or run the complete menu items insert script:
```bash
# If you have menu_items_insert.sql file
# Copy its contents and run it in the SQL Editor
```

## Part 4: Verification

### Verify Database Setup

Run these verification queries in SQL Editor:

```sql
-- 1. Check all tables exist
SELECT COUNT(*) as table_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE';
-- Should return 11 or more

-- 2. Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
-- All tables should have rowsecurity = true

-- 3. Check functions exist
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_type = 'FUNCTION'
ORDER BY routine_name;
-- Should see calculate_distance_meters, calculate_delivery_fee, etc.

-- 4. Test delivery fee calculator (using nearby coordinates for testing)
-- Store location: 6.2178483, 124.8221226
SELECT calculate_delivery_fee_from_store(6.2200000, 124.8250000) as delivery_fee;
-- Should return a calculated fee (approximately ₱45-50 for this test location)

-- 5. Verify indexes
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

### Verify Storage Setup

1. Go to **Storage** > `reviews` bucket
2. Try uploading a test image
3. Check that the image is publicly accessible
4. Delete the test image

## Part 5: Environment Configuration

Make sure your `.env.local` file has the correct Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Replace with your actual Supabase project URL and anon key (found in **Settings** > **API**).

## Common Issues and Solutions

### Issue 1: "Table not found" errors

**Solution**: Run the `database_complete_migration.sql` script again. It's designed to be idempotent (safe to run multiple times).

### Issue 2: "Bucket not found" error

**Solution**: 
1. Verify the bucket exists in **Storage** dashboard
2. Check the bucket name is exactly `reviews` (case-sensitive)
3. Ensure the bucket is set to public

### Issue 3: "Permission denied" when uploading images

**Solution**:
1. Check that RLS policies are created on `storage.objects`
2. Verify user is authenticated
3. Check storage policies allow INSERT for authenticated users

### Issue 4: Images not displaying (404)

**Solution**:
1. Verify bucket is set to **public**
2. Check the public read policy exists
3. Verify the image URLs are correctly formatted

### Issue 5: Orders query returns 400 error

**Solution**:
1. Check the `orders` table schema matches the migration
2. Verify all required columns exist
3. Check RLS policies allow the current user to query orders

## Testing the Setup

### Test 1: Customer Registration and Login
1. Create a test customer account
2. Verify user is created in `users` table with role='customer'
3. Check `loyalty_balance` is initialized to 0

### Test 2: Menu Items
1. Go to customer order portal
2. Verify menu items load correctly
3. Test adding items to cart

### Test 3: Reviews
1. Login as a customer
2. Go to reviews page
3. Try creating a review with images
4. Verify images upload to `reviews` bucket
5. Check review is saved in `customer_reviews` table

### Test 4: Loyalty Points
1. Create a test order as a customer
2. Update order status to 'order_delivered' (as admin/cashier)
3. Verify loyalty points are automatically added
4. Check `loyalty_transactions` table has the transaction
5. Verify `users.loyalty_balance` is updated

### Test 5: Purchase Tracking
1. Complete an order
2. Check `customer_item_purchases` table
3. Verify purchase counts are tracked correctly
4. Test "Most Purchased Items" on customer dashboard

## Next Steps

After completing this setup:

1. ✅ Database is fully configured
2. ✅ Storage bucket is ready for review images
3. ✅ All RLS policies are in place
4. ✅ Triggers and functions are active

You can now:
- Add menu items via admin portal
- Register customers and process orders
- Accept customer reviews with images
- Track loyalty points automatically
- Manage rider deliveries and billing

## Support

If you encounter any issues:
1. Check the browser console for error messages
2. Check Supabase logs in **Database** > **Logs**
3. Verify your environment variables are correct
4. Review the RLS policies for the affected tables
5. Check that all migrations have been applied

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Storage Guide](https://supabase.com/docs/guides/storage)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Functions](https://www.postgresql.org/docs/current/plpgsql.html)
