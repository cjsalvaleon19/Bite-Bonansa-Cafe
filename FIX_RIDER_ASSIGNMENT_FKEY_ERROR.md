# Fix Foreign Key Constraint Violation: orders_rider_id_fkey

## Error Details

```
Failed to assign rider: insert or update on table "orders" violates foreign key constraint "orders_rider_id_fkey"
```

This error occurs when trying to assign a rider to a delivery order in the Orders Queue page.

## Root Cause

The issue stems from confusion between two separate ID fields in the rider system:

### Database Schema

```sql
-- users table
CREATE TABLE users (
  id UUID PRIMARY KEY,
  role VARCHAR,  -- can be 'rider', 'customer', 'cashier', etc.
  ...
);

-- riders table (additional rider-specific data)
CREATE TABLE riders (
  id UUID PRIMARY KEY,              -- ⚠️ Separate ID, NOT used for orders
  user_id UUID REFERENCES users(id), -- ✅ This is what orders.rider_id should use
  driver_id VARCHAR(50),
  vehicle_type VARCHAR(50),
  is_available BOOLEAN,
  ...
);

-- orders table
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  rider_id UUID REFERENCES users(id),  -- ⚠️ References users.id, NOT riders.id
  ...
);
```

### The Problem

1. **orders.rider_id** → References **users.id** (from migration 036)
2. **riders** table has its own **id** field (UUID)
3. **riders.user_id** → References **users.id**
4. Code was fetching from wrong table or using wrong ID field

### Why It Fails

When assigning a rider:
```javascript
// ❌ WRONG: Using riders.id 
await supabase.from('orders').update({ rider_id: ridersTableId })

// ✅ CORRECT: Using riders.user_id (which equals users.id)
await supabase.from('orders').update({ rider_id: userIdFromRidersTable })
```

The foreign key constraint `orders_rider_id_fkey` validates that the rider_id exists in `users(id)`, not in `riders(id)`.

## Solution

### 1. Run Migration 054

Migration 054 (`054_fix_rider_assignment_fkey.sql`) fixes data inconsistencies:

- Clears orphaned rider_id references in orders table
- Removes riders without valid user accounts
- Creates `available_riders_view` for easy querying
- Adds helpful column comments
- Creates `validate_rider_exists()` function

**Run in Supabase SQL Editor:**
```sql
-- Copy and paste contents of supabase/migrations/054_fix_rider_assignment_fkey.sql
```

### 2. Updated Code

**File: `pages/cashier/orders-queue.js`**

The `fetchRiders()` function was updated to:

```javascript
// ✅ NEW: Fetch from riders table with user JOIN
const { data: ridersData, error } = await supabase
  .from('riders')
  .select(`
    user_id,
    is_available,
    users!riders_user_id_fkey (
      id,
      full_name,
      email
    )
  `)
  .eq('is_available', true)
  .order('users(full_name)');

// Transform to use user_id as the id
const transformedRiders = (ridersData || []).map(rider => ({
  id: rider.user_id,  // ✅ Use user_id (matches orders.rider_id FK)
  full_name: rider.users?.full_name,
  email: rider.users?.email,
  is_available: rider.is_available
}));
```

**Before (Wrong):**
```javascript
// ❌ OLD: Fetched from users table directly
const { data: ridersData, error } = await supabase
  .from('users')
  .select('id, full_name, email')
  .eq('role', 'rider')
  .order('full_name');
```

The new approach:
- Queries the `riders` table (ensuring rider-specific data exists)
- Joins with `users` table to get user information
- Filters by `is_available = true` (only shows active riders)
- Uses `user_id` as the ID for assignment (which matches `users.id`)

### 3. Added Validation

The `handleAssignRider()` function now validates the rider exists:

```javascript
// Validate that the rider exists in users table before assigning
const { data: riderExists, error: checkError } = await supabase
  .from('users')
  .select('id')
  .eq('id', riderId)
  .single();

if (checkError || !riderExists) {
  throw new Error('Selected rider does not exist in the system. Please refresh and try again.');
}
```

This prevents attempting to assign a non-existent user ID.

## Verification

After applying the fix, verify the data:

### 1. Check for Orphaned References

```sql
-- Should return 0 rows
SELECT o.id, o.order_number, o.rider_id
FROM orders o
WHERE o.rider_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = o.rider_id);
```

### 2. Check Riders Table Consistency

```sql
-- Should return 0 rows
SELECT r.id, r.user_id
FROM riders r
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = r.user_id);
```

### 3. Use the New View

```sql
-- Get all available riders with correct IDs
SELECT user_id, full_name, email, is_available
FROM available_riders_view
WHERE is_available = true;
```

### 4. Test Rider Assignment

1. Log in as cashier
2. Go to Orders Queue
3. Find a delivery order
4. Click "Assign Rider"
5. Select a rider from the list
6. Verify no error occurs
7. Check that order.rider_id is set correctly:

```sql
SELECT id, order_number, rider_id, status
FROM orders
WHERE rider_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

## Database Design Clarification

### Why Two Tables?

The system uses two tables for riders:

1. **users table** (role='rider')
   - Authentication and basic user info
   - Shared across all user types (customer, cashier, rider, admin)
   - Used for login, permissions, notifications

2. **riders table**
   - Rider-specific information (vehicle, driver ID, earnings)
   - One-to-one relationship with users via `user_id`
   - Extended profile for riders

### ID Field Reference Guide

| Table | Field | Type | Purpose | Used For |
|-------|-------|------|---------|----------|
| users | id | UUID | User identity | Authentication, orders.rider_id FK |
| riders | id | UUID | Rider record PK | Internal riders table queries only |
| riders | user_id | UUID | Link to user | **Use this for orders.rider_id!** |
| orders | rider_id | UUID | Assigned rider | References users.id (via riders.user_id) |

### The Golden Rule

> **When assigning a rider to an order, always use `riders.user_id`, which equals `users.id`**

## Common Mistakes to Avoid

### ❌ Don't Do This

```javascript
// Wrong: Using riders.id
const { data: riders } = await supabase.from('riders').select('id, ...');
await supabase.from('orders').update({ rider_id: riders[0].id }); // ❌ FAILS!
```

### ✅ Do This Instead

```javascript
// Correct: Using riders.user_id
const { data: riders } = await supabase.from('riders').select('user_id, ...');
await supabase.from('orders').update({ rider_id: riders[0].user_id }); // ✅ WORKS!
```

Or use the view:
```javascript
// Even better: Use the view
const { data: riders } = await supabase.from('available_riders_view').select('user_id, full_name, email');
await supabase.from('orders').update({ rider_id: riders[0].user_id }); // ✅ WORKS!
```

## Files Modified

- ✅ Updated: `pages/cashier/orders-queue.js` - Fixed fetchRiders() and handleAssignRider()
- ✅ Created: `supabase/migrations/054_fix_rider_assignment_fkey.sql` - Data cleanup and view creation
- ✅ Created: `FIX_RIDER_ASSIGNMENT_FKEY_ERROR.md` - This documentation

## Related Issues

- **Migration 050 Error**: If you encountered "column user_id does not exist", see `FIX_MIGRATION_050_USER_ID_ERROR.md`
- **Deliveries Table**: The deliveries table also has a rider_id - ensure consistency

## Prevention

To prevent this issue in the future:

1. **Always use `available_riders_view`** when querying rider data
2. **Use `validate_rider_exists()`** function before assignment
3. **Check column comments** in the database for ID field usage
4. **Test rider assignment** after any schema changes
5. **Document ID relationships** clearly in code comments

## Testing Checklist

After deploying the fix:

- [ ] Run migration 054 in production
- [ ] Verify no orphaned data (queries above return 0 rows)
- [ ] Test rider assignment in Orders Queue
- [ ] Check that assigned orders show correct rider info
- [ ] Verify rider notifications are sent
- [ ] Test rider dashboard shows assigned deliveries
- [ ] Check that deliveries table is created properly (if using)

## Support

If you still encounter this error after applying the fix:

1. **Check if riders exist**: Query `available_riders_view` to see available riders
2. **Verify user roles**: Ensure rider users have `role = 'rider'` in users table
3. **Check riders table**: Ensure riders have corresponding entries in riders table
4. **Review logs**: Check browser console for specific error messages
5. **Database state**: Run verification queries to check data consistency
