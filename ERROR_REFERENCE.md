# Quick Error Reference Guide

This guide helps you quickly identify and fix common errors in the Bite Bonansa Cafe application.

## Table of Contents
- [Database Errors (404)](#database-errors-404)
- [Storage Errors (400)](#storage-errors-400)
- [Order Errors (400)](#order-errors-400)
- [Service Worker Errors (503)](#service-worker-errors-503)
- [Quick Fix Checklist](#quick-fix-checklist)

---

## Database Errors (404)

### Error: "Could not find the table 'public.loyalty_transactions'"

```
Failed to load resource: the server responded with a status of 404
[CustomerDashboard] Error fetching loyalty transactions: Could not find the table 'public.loyalty_transactions' in the schema cache
```

**Cause:** The `loyalty_transactions` table doesn't exist in your Supabase database.

**Fix:**
1. Open Supabase SQL Editor
2. Run `database_complete_migration.sql`
3. Verify with: `SELECT * FROM loyalty_transactions LIMIT 1;`

---

### Error: "Could not find the table 'public.customer_item_purchases'"

```
Failed to load resource: the server responded with a status of 404
[CustomerDashboard] Error fetching purchase history: Could not find the table 'public.customer_item_purchases' in the schema cache
```

**Cause:** The `customer_item_purchases` table doesn't exist in your Supabase database.

**Fix:**
1. Open Supabase SQL Editor
2. Run `database_complete_migration.sql`
3. Verify with: `SELECT * FROM customer_item_purchases LIMIT 1;`

---

### Error: "Could not find the table 'public.customer_reviews'"

```
Failed to load resource: the server responded with a status of 404
[CustomerReviews] Failed to fetch reviews: Object
```

**Cause:** The `customer_reviews` table doesn't exist in your Supabase database.

**Fix:**
1. Open Supabase SQL Editor
2. Run `database_complete_migration.sql`
3. Verify with: `SELECT * FROM customer_reviews LIMIT 1;`

---

## Storage Errors (400)

### Error: "Bucket not found" when uploading review images

```
Failed to load resource: the server responded with a status of 400
Failed to upload image: StorageApiError: Bucket not found
```

**Cause:** The `reviews` storage bucket doesn't exist or is misconfigured.

**Fix:**
1. Go to Supabase Dashboard → **Storage**
2. Click **Create a new bucket**
3. Name it `reviews`
4. ✅ Check **Public bucket**
5. Click **Create bucket**
6. Add storage policies (see [SUPABASE_SETUP_COMPLETE.md](./SUPABASE_SETUP_COMPLETE.md) for details)

**Verify:**
```javascript
// In browser console
const { data } = await supabase.storage.listBuckets()
console.log(data.find(b => b.name === 'reviews'))
// Should return bucket info, not undefined
```

---

## Order Errors (400)

### Error: Orders endpoint returns 400

```
Failed to load resource: the server responded with a status of 400
[Checkout] Failed to submit order: Object
```

**Possible Causes & Fixes:**

#### 1. Missing order table columns

**Check if columns exist:**
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'orders' 
ORDER BY ordinal_position;
```

**Fix:** Run `database_complete_migration.sql` to add missing columns:
- `order_mode`
- `order_number`
- `customer_name`
- `contact_number`

#### 2. Invalid query syntax

**Common issue:** Using `.not()` incorrectly for multiple values.

**Wrong:**
```javascript
.not('status', 'eq', 'order_delivered')
.not('status', 'eq', 'cancelled')
```

**Correct:**
```javascript
.not('status', 'in', '(order_delivered,cancelled)')
```

#### 3. RLS policy blocking the request

**Check if RLS policies exist:**
```sql
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename = 'orders';
```

**Fix:** Run `database_complete_migration.sql` to create all RLS policies.

#### 4. Missing required fields in insert

**Check your order submission code includes all required fields:**
- `customer_id` (UUID, references users)
- `items` (JSONB array)
- `delivery_address` (TEXT)
- `subtotal` (DECIMAL)
- `total_amount` (DECIMAL)
- `payment_method` (VARCHAR)

---

## Service Worker Errors (503)

### Error: "Network failed and no cache"

```
[SW] Network failed and no cache for: /customer/reviews Failed to fetch
Failed to load resource: the server responded with a status of 503 (Service Unavailable)
```

**Cause:** The service worker cache doesn't have the page, and the network request failed.

**This is expected behavior when:**
- User is offline
- The page hasn't been pre-cached
- The route doesn't exist

**Fix (if route should work):**

1. **Add route to pre-cache list** in `public/service-worker.js`:
```javascript
const URLS_TO_CACHE = [
  '/',
  '/dashboard',
  '/login',
  '/customer/dashboard',
  '/customer/order-portal',
  '/customer/order-tracking',
  '/customer/order-history',
  '/customer/reviews',  // Add missing route
  '/customer/profile',
  // ... rest
];
```

2. **Update cache version** to force re-cache:
```javascript
const CACHE_NAME = 'bite-bonansa-v5'; // Increment version
```

3. **Clear old caches** in browser:
   - Chrome: DevTools → Application → Storage → Clear site data
   - Or: DevTools → Application → Service Workers → Unregister

4. **Reload the page** to install new service worker

---

## Quick Fix Checklist

Use this checklist to systematically resolve setup issues:

### ✅ Database Setup
- [ ] Run `database_complete_migration.sql` in Supabase SQL Editor
- [ ] Verify all 11 tables exist: `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';` should return ≥11
- [ ] Check RLS is enabled: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public';` all should be `true`
- [ ] Verify functions exist: `SELECT routine_name FROM information_schema.routines WHERE routine_schema='public' AND routine_type='FUNCTION';`

### ✅ Storage Setup
- [ ] `reviews` bucket exists in Storage dashboard
- [ ] Bucket is set to **Public**
- [ ] Storage policies are configured:
  - `Allow authenticated uploads` (INSERT)
  - `Public read access` (SELECT)
  - `Users can delete their own images` (DELETE)
- [ ] Test upload: Upload a test image and verify public URL works

### ✅ Environment Variables
- [ ] `.env.local` exists (not `.env.example`)
- [ ] `NEXT_PUBLIC_SUPABASE_URL` has real value (starts with `https://`)
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` has real value (long string)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` has real value (server-side only)
- [ ] Dev server restarted after updating `.env.local`
- [ ] `/api/health` endpoint returns `{"status":"ok"}`

### ✅ Application
- [ ] `npm install` completed without errors
- [ ] `npm run dev` starts without errors
- [ ] Browser console shows no Supabase configuration warnings
- [ ] Can register a new user
- [ ] Can login successfully
- [ ] User role is correctly assigned in database

### ✅ Verification Queries

Run these in Supabase SQL Editor to verify setup:

```sql
-- 1. Check table count
SELECT COUNT(*) as table_count 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
-- Expected: 11 or more

-- 2. Check specific tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'users', 'menu_items', 'orders', 
    'customer_item_purchases', 'customer_reviews', 'loyalty_transactions',
    'cash_drawer_transactions', 'delivery_reports', 
    'delivery_billing_notifications', 'deliveries', 'riders'
  )
ORDER BY table_name;
-- Expected: All 11 tables listed

-- 3. Check RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename IN (
  'orders', 'customer_reviews', 'loyalty_transactions', 'customer_item_purchases'
)
ORDER BY tablename;
-- Expected: All show rowsecurity = true

-- 4. Check functions
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'calculate_distance_meters', 
    'calculate_delivery_fee', 
    'calculate_delivery_fee_from_store',
    'calculate_earnings_percentage',
    'update_customer_purchases',
    'add_loyalty_points',
    'update_order_timestamps'
  )
ORDER BY routine_name;
-- Expected: All 7 functions listed

-- 5. Test delivery fee calculator
-- Note: Store is at 6.2178483, 124.8221226; testing with nearby coordinates
SELECT calculate_delivery_fee_from_store(6.2200000, 124.8250000) as fee;
-- Expected: A numeric value (e.g., 35.00 or higher)

-- 6. Check storage bucket (via Supabase API, not SQL)
-- Go to Storage dashboard and verify 'reviews' bucket exists
```

---

## Still Having Issues?

If you've completed all the steps above and still see errors:

1. **Check browser console** for detailed error messages
2. **Check Supabase logs** (Dashboard → Database → Logs)
3. **Verify API keys** in environment variables match Supabase dashboard
4. **Clear application cache** and reload
5. **Try incognito/private window** to rule out browser cache issues
6. **Review [SUPABASE_SETUP_COMPLETE.md](./SUPABASE_SETUP_COMPLETE.md)** for detailed setup instructions

### Get Help

When reporting issues, include:
- Browser console errors (full text)
- Supabase table list: `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;`
- RLS status: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public';`
- Environment check: Visit `/api/health` and share the response
- Steps you've already tried from this guide
