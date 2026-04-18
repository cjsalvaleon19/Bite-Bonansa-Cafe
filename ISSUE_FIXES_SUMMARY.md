# Issue Fixes Summary

This document summarizes the fixes applied to resolve the reported errors and issues.

## Issues Addressed

### 1. ✅ Fixed: `loyalty_balance` Column Error

**Problem:** Multiple queries were trying to select `loyalty_balance` from the `users` table, but this column doesn't exist in the Supabase database.

**Error Message:**
```
column users.loyalty_balance does not exist
```

**Solution:**
- Removed all direct `loyalty_balance` queries from the `users` table
- Updated code to calculate loyalty balance from the `loyalty_transactions` table
- The loyalty balance is now calculated dynamically by summing all transaction amounts

**Files Modified:**
- `pages/customer/dashboard.js` - Calculates balance from transactions
- `pages/customer/profile.js` - Fetches balance from transactions
- `pages/cashier/pos.js` - Queries transactions for customer points
- `pages/api/register.js` - Removed loyalty_balance from user insert
- `pages/api/customers.js` - Calculates balance from transactions

**Note:** The `loyalty_balance` column was commented out in the original schema. The loyalty system now fully relies on the `loyalty_transactions` table, which is more robust and provides transaction history.

---

### 2. ⚠️ Partially Fixed: `customer_reviews` Table Error

**Problem:** The application tries to query the `customer_reviews` table, but it doesn't exist in the Supabase database.

**Error Message:**
```
Failed to load resource: the server responded with a status of 404
[CustomerReviews] Failed to fetch reviews
```

**Current Status:**
- The table schema is defined in `database_schema.sql` (lines 91-106)
- The code correctly references `customer_reviews`
- **Action Required:** The table needs to be created in Supabase

**To Fix:**
1. Open Supabase SQL Editor
2. Run the following SQL from `database_schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS customer_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255),
  review_text TEXT NOT NULL,
  star_rating INT NOT NULL CHECK (star_rating >= 1 AND star_rating <= 5),
  image_urls TEXT[],
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_customer ON customer_reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON customer_reviews(status);

-- Enable RLS
ALTER TABLE customer_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Customers can view their own reviews" ON customer_reviews
  FOR SELECT USING (auth.uid() = customer_id);

CREATE POLICY "Customers can create reviews" ON customer_reviews
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Customers can update their own reviews" ON customer_reviews
  FOR UPDATE USING (auth.uid() = customer_id);
```

---

### 3. ✅ Fixed: Order Portal Navigation Issue

**Problem:** Clicking "Order Portal" in the navigation menu was showing the Dashboard tab instead.

**Root Cause:** The `/customer/menu` page had an automatic redirect back to `/customer/dashboard`, causing a loop.

**Solution:**
- Updated all navigation links to point to `/customer/order-portal` instead of `/customer/menu`
- Removed the redirect from `menu.js`
- The actual order portal functionality is in `order-portal.js` with full cart and checkout features

**Files Modified:**
- `pages/customer/dashboard.js` - Updated navigation and action card links
- `pages/customer/orders.js` - Updated navigation link
- `pages/customer/profile.js` - Updated navigation link
- `pages/customer/reviews.js` - Updated navigation link
- `pages/customer/menu.js` - Removed automatic redirect

---

### 4. ⚠️ To Investigate: Role-Based Routing Issue

**Problem:** Both customer and rider login credentials are showing the customer portal.

**Current Implementation:**
- Role mapping is correctly implemented in `utils/roleMapping.js`
- Fixed role assignments:
  - `cjsalvaleon19@gmail.com` → **admin**
  - `arclitacj@gmail.com` → **cashier**
  - `johndave0991@gmail.com` → **rider**
  - All others → **customer**

**Possible Causes:**
1. The rider account in the database has the wrong role
2. The rider hasn't registered yet, or registered with a different email

**To Check:**
1. Open Supabase Table Editor → `users` table
2. Find the rider's account (email: `johndave0991@gmail.com`)
3. Verify the `role` column is set to `'rider'`
4. If the role is wrong, update it:

```sql
UPDATE users 
SET role = 'rider' 
WHERE email = 'johndave0991@gmail.com';
```

**If Rider Hasn't Registered:**
- Have the rider register with the exact email: `johndave0991@gmail.com`
- The system will automatically assign the `'rider'` role during registration
- After logging in, they should be redirected to `/rider/dashboard`

---

### 5. ✅ Completed: Menu Items Update

**Problem:** The menu list needed to be updated with all items from the menu images.

**Solution:**
Created a comprehensive SQL script (`menu_items_insert.sql`) with 200+ menu items across all categories:

**Categories Added:**
- Appetizers (Nachos, Fries, Siomai, Calamares)
- Pasta (Spaghetti solo and combos)
- Noodles (Ramyeon, Samyang Carbonara)
- Korean (Tteokbokki)
- Chicken (Meals, Platters, Burgers with 7-8 flavors each)
- Burgers (8 chicken burger variants)
- Rice Meals (8 Silog varieties)
- Sandwiches (Clubhouse, Footlong)
- Japanese (Spam Musubi, Sushi)
- Salads (Caesar Salad)
- Breakfast (Waffles)
- Milktea (16 flavors, 16oz & 22oz sizes)
- Coffee (19 varieties, 12oz, 16oz & 22oz sizes)
- Soda (6 fruit soda flavors, 16oz & 22oz)
- Lemonade (5 varieties, 16oz & 22oz)
- Frappe (11 varieties, 16oz & 22oz)

**To Add Menu Items:**
1. Open Supabase SQL Editor
2. Copy and run the entire content of `menu_items_insert.sql`
3. Verify items were added:
   ```sql
   SELECT category, COUNT(*) as count 
   FROM menu_items 
   GROUP BY category 
   ORDER BY category;
   ```

---

## Database Setup Checklist

To complete the fixes, run these SQL scripts in Supabase:

### Required Tables (if not already created):

1. **loyalty_transactions** - For loyalty points tracking
2. **customer_reviews** - For customer reviews feature
3. **menu_items** - Should already exist, just needs data

### Optional: Clean Start

If you want to start fresh with the complete schema:

```bash
# Run in Supabase SQL Editor
# 1. Run database_schema.sql (creates all tables)
# 2. Run database_schema_updates.sql (if applicable)
# 3. Run menu_items_insert.sql (adds all menu items)
```

---

## Testing Steps

After running the SQL scripts:

### Test 1: Loyalty Balance
1. Login as a customer
2. Go to Profile page
3. Loyalty balance should show as ₱0.00 (or calculated from transactions)
4. No errors in console

### Test 2: Customer Reviews
1. Login as a customer
2. Go to "Share Review" page
3. Page should load without 404 errors
4. Try creating a review

### Test 3: Order Portal
1. Login as a customer
2. Click "Order Portal" in navigation
3. Should see menu items categorized by type
4. Should see cart functionality

### Test 4: Role-Based Access
1. Login with `johndave0991@gmail.com` (rider account)
2. Should be redirected to `/rider/dashboard`
3. Should see rider-specific features
4. If still showing customer portal, check the role in database

### Test 5: Menu Items
1. Open Order Portal
2. Menu items should be organized by categories
3. Filter by category should work
4. All prices should match the menu images

---

## Summary of Changes

| Issue | Status | Action Required |
|-------|--------|-----------------|
| loyalty_balance errors | ✅ Fixed | None - uses transactions now |
| customer_reviews 404 | ⚠️ Partial | Create table in Supabase |
| Order Portal navigation | ✅ Fixed | None - links updated |
| Role routing (rider) | ⚠️ To verify | Check/update role in database |
| Menu items | ✅ Ready | Run menu_items_insert.sql |

---

## Files Changed

### Code Files Modified:
1. `pages/customer/dashboard.js` - Loyalty balance from transactions, navigation links
2. `pages/customer/profile.js` - Loyalty balance from transactions, navigation links
3. `pages/customer/menu.js` - Removed redirect
4. `pages/customer/orders.js` - Navigation links
5. `pages/customer/reviews.js` - Navigation links
6. `pages/cashier/pos.js` - Loyalty balance from transactions
7. `pages/api/register.js` - Removed loyalty_balance insert
8. `pages/api/customers.js` - Calculate balance from transactions

### New Files Created:
1. `menu_items_insert.sql` - Complete menu items SQL insert script
2. `ISSUE_FIXES_SUMMARY.md` - This document

---

## Next Steps

1. **Immediate:** Run `menu_items_insert.sql` in Supabase to add all menu items
2. **Required:** Create `customer_reviews` table using SQL above
3. **Verify:** Check rider account role in database and update if needed
4. **Test:** Follow testing steps above to verify all fixes work
5. **Deploy:** If everything works locally, deploy to production

---

## Support

If you encounter any issues:

1. **Console Errors:** Check browser console for specific error messages
2. **Database:** Verify tables exist in Supabase
3. **Roles:** Check `users` table for correct role assignments
4. **Network:** Check Supabase API responses in Network tab

For role-based access issues, the most common fix is updating the role in the database directly.
