# Migration 065 Deployment Guide

## Fix: Deliveries Not Appearing in Rider Interface

### Problem Summary
When the Cashier assigns a rider to an order using the "Out for Delivery" button:
1. ✅ The order is successfully updated in the database
2. ❌ No delivery record is created in the `deliveries` table
3. ❌ Rider interface shows "No active deliveries" because it queries the `deliveries` table

### Solution
Migration 065 updates the `assign_rider_to_order()` database function to:
- Create a delivery record when a rider is assigned
- Handle both new assignments and reassignments
- Populate all required delivery fields from the order data

---

## Deployment Steps

### 1. Run Migration in Supabase SQL Editor

```sql
-- Copy and paste the entire contents of:
-- supabase/migrations/065_create_delivery_on_rider_assignment.sql
-- into the Supabase SQL Editor and execute
```

### 2. Verify the Migration

After running the migration, verify it was successful:

```sql
-- Check function exists with correct signature
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname = 'assign_rider_to_order';
```

Expected: Function should exist with arguments `(p_order_id TEXT, p_rider_id UUID)`

### 3. Test the Fix

#### Test Setup
1. Log in as a cashier
2. Navigate to Orders Queue
3. Find or create a delivery order in "In Process" status
4. Click "Out for Delivery" button
5. Assign a rider from the modal

#### Expected Behavior - Cashier Side
- ✅ Modal shows available riders
- ✅ Rider assignment succeeds with success message
- ✅ Order disappears from queue (now assigned to rider)

#### Expected Behavior - Rider Side
1. Log in as the assigned rider (e.g., johndave0991@bitebonansacafe.com)
2. Navigate to Deliveries page
3. Click "Active Deliveries" tab

**Expected Results:**
- ✅ The assigned delivery appears in the list
- ✅ Shows order details (customer name, phone, address)
- ✅ Shows delivery fee
- ✅ Status is "pending" or "in_progress"

### 4. Verify Database Records

```sql
-- Check that delivery was created
SELECT 
  d.id,
  d.order_id,
  d.rider_id,
  d.customer_name,
  d.status,
  d.created_at,
  o.order_number,
  u.email as rider_email
FROM deliveries d
JOIN orders o ON o.id = d.order_id
JOIN users u ON u.id = d.rider_id
ORDER BY d.created_at DESC
LIMIT 5;
```

---

## Rollback Plan

If you need to rollback this migration:

```sql
-- Restore the old version of the function (from migration 058)
-- This will NOT delete existing delivery records

DROP FUNCTION IF EXISTS assign_rider_to_order(TEXT, UUID);

CREATE OR REPLACE FUNCTION assign_rider_to_order(
  p_order_id TEXT,
  p_rider_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_rider_record RECORD;
  v_order_record RECORD;
  v_result JSON;
BEGIN
  -- Step 1: Validate the order exists and can accept a rider
  SELECT id, status, order_mode
  INTO v_order_record
  FROM orders
  WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'ORDER_NOT_FOUND',
      'message', 'Order does not exist',
      'order_id', p_order_id
    );
  END IF;
  
  IF v_order_record.order_mode != 'delivery' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'INVALID_ORDER_MODE',
      'message', 'Only delivery orders can be assigned to riders',
      'order_mode', v_order_record.order_mode
    );
  END IF;
  
  -- Step 2: Validate the rider exists and has correct role
  SELECT u.id, u.email, u.full_name, u.role
  INTO v_rider_record
  FROM users u
  WHERE u.id = p_rider_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'RIDER_NOT_FOUND',
      'message', 'Rider does not exist in users table',
      'rider_id', p_rider_id
    );
  END IF;
  
  IF v_rider_record.role != 'rider' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'INVALID_RIDER_ROLE',
      'message', 'User exists but is not a rider',
      'rider_id', p_rider_id,
      'rider_email', v_rider_record.email,
      'actual_role', v_rider_record.role,
      'expected_role', 'rider'
    );
  END IF;
  
  -- Step 3: Update the order atomically
  UPDATE orders
  SET 
    status = 'out_for_delivery',
    rider_id = p_rider_id,
    out_for_delivery_at = NOW()
  WHERE id = p_order_id;
  
  -- Step 4: Return success with rider details
  RETURN json_build_object(
    'success', true,
    'order_id', p_order_id,
    'rider_id', p_rider_id,
    'rider_email', v_rider_record.email,
    'rider_name', v_rider_record.full_name,
    'message', 'Rider assigned successfully'
  );
  
EXCEPTION
  WHEN foreign_key_violation THEN
    RETURN json_build_object(
      'success', false,
      'error', 'FK_VIOLATION',
      'message', 'Foreign key constraint violation: ' || SQLERRM,
      'order_id', p_order_id,
      'rider_id', p_rider_id
    );
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'UNEXPECTED_ERROR',
      'message', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION assign_rider_to_order(TEXT, UUID) TO authenticated;
```

---

## Technical Details

### What Changed

**Before (Migration 058):**
- `assign_rider_to_order()` only updated the `orders` table
- No delivery record was created
- Riders couldn't see their assignments

**After (Migration 065):**
- `assign_rider_to_order()` updates `orders` table AND creates/updates `deliveries` record
- Delivery record includes:
  - `order_id`, `rider_id`
  - Customer details (name, phone, address, coordinates)
  - Delivery fee
  - Status (set to 'pending')
- Returns `delivery_id` in the success response

### Database Schema

The `deliveries` table structure:
```sql
CREATE TABLE deliveries (
  id UUID PRIMARY KEY,
  order_id TEXT UNIQUE REFERENCES orders(id),
  rider_id UUID REFERENCES users(id),
  customer_name VARCHAR(255),
  customer_phone VARCHAR(20),
  customer_address TEXT,
  customer_latitude DECIMAL(10,8),
  customer_longitude DECIMAL(11,8),
  delivery_fee DECIMAL(10,2),
  status VARCHAR(50),  -- 'pending', 'accepted', 'in_progress', 'completed', 'cancelled'
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  -- ... other fields
);
```

---

## Success Criteria

✅ Migration runs without errors  
✅ Function exists with correct signature  
✅ Cashier can assign riders successfully  
✅ Delivery record is created in database  
✅ Rider can see assigned deliveries in their interface  

---

## Support

If you encounter any issues:
1. Check the Supabase logs for SQL errors
2. Verify the rider has `role='rider'` in the `users` table
3. Ensure the order has `order_mode='delivery'`
4. Check that the `deliveries` table exists and has correct schema

For additional help, contact the development team.
