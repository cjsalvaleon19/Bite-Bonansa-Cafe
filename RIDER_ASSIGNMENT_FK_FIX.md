# Rider Assignment Foreign Key Fix

## Problem Summary

**Error**: `insert or update on table "orders" violates foreign key constraint "orders_rider_id_fkey"`

**Root Causes**:
1. Riders table entries with `NULL` user_id values
2. Riders table entries where user_id doesn't exist in users table
3. Missing validation when fetching and assigning riders
4. No filtering of invalid rider data before displaying in UI

## Understanding the Schema

### Key Relationships
```
riders table:
  - id (UUID, primary key) - riders table's own ID
  - user_id (UUID, FK to users.id) - THIS is what matters!

orders table:
  - rider_id (UUID, FK to users.id) - references users.id, NOT riders.id!

users table:
  - id (UUID, primary key)
  - role (VARCHAR) - must be 'rider' for rider assignments
```

### Critical Rule
**When assigning riders to orders, always use `riders.user_id`, not `riders.id`!**

## Solutions Implemented

### 1. Code Changes in `pages/cashier/orders-queue.js`

#### A. Filter Invalid Riders During Fetch (Lines 234-250)
```javascript
const transformedRiders = (ridersData || [])
  .filter(rider => {
    // Skip riders with null user_id
    if (rider.user_id == null) {
      console.warn('[OrdersQueue] Skipping rider with null user_id:', rider);
      return false;
    }
    // Skip riders without user data (joined query failed)
    if (rider.users == null) {
      console.warn('[OrdersQueue] Skipping rider with null users data:', { user_id: rider.user_id });
      return false;
    }
    return true;
  })
  .map(rider => ({
    id: rider.user_id, // Use user_id for assignment!
    full_name: rider.users.full_name,
    email: rider.users.email,
    is_available: rider.is_available
  }));
```

**Why**: Prevents riders with invalid data from appearing in the UI, eliminating the chance of trying to assign a NULL or invalid ID.

#### B. Validate Rider Before Assignment
```javascript
// 1. Check riderId is not null/undefined
if (!riderId) {
  console.error('[OrdersQueue] Invalid rider ID:', { riderId });
  alert('Invalid rider selected. Please refresh the page and try again.');
  return;
}

// 2. Verify rider exists in users table
const { data: riderExists, error: checkError } = await supabase
  .from('users')
  .select('id, email, role')
  .eq('id', riderId)
  .single();

if (checkError || !riderExists) {
  throw new Error('Selected rider does not exist in the system. Please refresh and try again.');
}

// 3. Verify user has 'rider' role
if (riderExists.role !== 'rider') {
  throw new Error(`User ${riderExists.email} is not a rider (role: ${riderExists.role}). Cannot assign to order.`);
}
```

**Why**: Triple validation ensures only valid, existing riders with proper role can be assigned.

### 2. Database Migration `056_cleanup_invalid_rider_data.sql`

This migration cleans up existing bad data:

1. **Removes riders with NULL user_id**
2. **Removes riders where user_id doesn't exist in users table**
3. **Sets user_id to NOT NULL constraint** (prevents future NULL values)
4. **Clears invalid rider_id from orders table**

## How to Apply the Fix

### Step 1: Run the Database Migration
```bash
# Apply migration 056 to your Supabase database
# This will clean up all invalid data
```

The migration will:
- Delete any riders with NULL user_id
- Delete any riders referencing non-existent users
- Set user_id to NOT NULL to prevent future issues
- Clear any invalid rider assignments from orders

### Step 2: Deploy Code Changes
The code changes in `orders-queue.js` are already committed. Deploy your application to production.

### Step 3: Verify the Fix
1. Log in as a cashier
2. Go to Orders Queue
3. Try to assign a rider to a delivery order
4. Check browser console for validation logs
5. Verify assignment succeeds without FK errors

## Prevention - Best Practices

### When Creating Riders
```javascript
// ✅ CORRECT: Always provide user_id
await supabase
  .from('riders')
  .insert({
    user_id: userId, // Must exist in users.id!
    vehicle_type: 'motorcycle',
    // ... other fields
  });
```

### When Querying Riders
```javascript
// ✅ CORRECT: Join with users and use user_id
const { data } = await supabase
  .from('riders')
  .select(`
    user_id,
    is_available,
    users!riders_user_id_fkey (
      id,
      full_name,
      email
    )
  `);

// Transform to use user_id as the ID
const riders = data.map(r => ({
  id: r.user_id, // Use user_id!
  full_name: r.users.full_name,
  // ...
}));
```

### When Assigning Riders to Orders
```javascript
// ✅ CORRECT: Use the user_id (already stored as id after transform)
await supabase
  .from('orders')
  .update({
    rider_id: riderId, // This should be a user.id value!
    status: 'out_for_delivery'
  })
  .eq('id', orderId);
```

## Debugging Tips

### Check for Invalid Riders
```sql
-- Find riders with NULL user_id
SELECT * FROM riders WHERE user_id IS NULL;

-- Find riders with invalid user_id references
SELECT r.* 
FROM riders r
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = r.user_id);

-- Find orders with invalid rider_id references
SELECT o.*
FROM orders o
WHERE rider_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = o.rider_id);
```

### Browser Console Logs
Look for these log messages in the browser console:
- `[OrdersQueue] Fetched riders from riders table` - Shows raw data
- `[OrdersQueue] Skipping rider with null user_id` - Warning about bad data
- `[OrdersQueue] Final riders list` - Shows transformed, valid riders
- `[OrdersQueue] Attempting to assign rider` - Shows riderId being used
- `[OrdersQueue] Rider validation result` - Shows validation check result

## Testing Checklist

- [ ] Migration 056 applied successfully
- [ ] No riders with NULL user_id exist
- [ ] All riders.user_id values exist in users.id
- [ ] Can view available riders in Orders Queue
- [ ] Can assign rider to delivery order
- [ ] No FK constraint errors in console
- [ ] Order status updates to 'out_for_delivery'
- [ ] Rider receives notification

## Related Files

- `pages/cashier/orders-queue.js` - Main implementation
- `supabase/migrations/056_cleanup_invalid_rider_data.sql` - Data cleanup
- `supabase/migrations/054_fix_rider_assignment_fkey.sql` - Previous fix attempt
- `supabase/migrations/050_create_rider_portal_tables.sql` - Original schema

## Summary

The fix involves three layers of protection:

1. **Database Layer**: Migration ensures data integrity
2. **Data Fetching Layer**: Filter out invalid riders before UI display
3. **Assignment Layer**: Triple validation before database update

This comprehensive approach prevents the FK constraint error from occurring.
