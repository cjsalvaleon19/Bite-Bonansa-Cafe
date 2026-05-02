-- =============================================================================
-- Migration 065: Create Delivery Record on Rider Assignment
-- =============================================================================
-- Purpose: Fix issue where orders assigned to riders don't appear in rider interface
-- 
-- Problem: When cashier assigns rider via "Out for Delivery" button:
--          1. assign_rider_to_order() updates orders table (rider_id, status)
--          2. BUT does NOT create record in deliveries table
--          3. Rider interface queries deliveries table, finding nothing
--
-- Solution: Modify assign_rider_to_order() to create deliveries record
-- =============================================================================

-- Drop and recreate the assign_rider_to_order function
DROP FUNCTION IF EXISTS assign_rider_to_order(TEXT, UUID);

CREATE OR REPLACE FUNCTION assign_rider_to_order(
  p_order_id TEXT,
  p_rider_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_rider_record RECORD;
  v_order_record RECORD;
  v_delivery_id UUID;
  v_result JSON;
BEGIN
  -- Step 1: Validate the order exists and can accept a rider
  SELECT id, status, order_mode, customer_name, customer_phone, customer_address,
         customer_latitude, customer_longitude, delivery_fee, total_amount
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
  
  -- Check order mode is delivery
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
  
  -- Validate role is 'rider'
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
  
  -- Step 4: Create delivery record
  -- Check if delivery already exists for this order
  IF NOT EXISTS (SELECT 1 FROM deliveries WHERE order_id = p_order_id) THEN
    INSERT INTO deliveries (
      order_id,
      rider_id,
      customer_name,
      customer_phone,
      customer_address,
      customer_latitude,
      customer_longitude,
      delivery_fee,
      status,
      created_at
    ) VALUES (
      p_order_id,
      p_rider_id,
      v_order_record.customer_name,
      v_order_record.customer_phone,
      v_order_record.customer_address,
      v_order_record.customer_latitude,
      v_order_record.customer_longitude,
      COALESCE(v_order_record.delivery_fee, 50), -- Default 50 if null
      'pending',
      NOW()
    )
    RETURNING id INTO v_delivery_id;
  ELSE
    -- Update existing delivery record
    UPDATE deliveries
    SET 
      rider_id = p_rider_id,
      status = 'pending',
      updated_at = NOW()
    WHERE order_id = p_order_id
    RETURNING id INTO v_delivery_id;
  END IF;
  
  -- Step 5: Return success with rider and delivery details
  RETURN json_build_object(
    'success', true,
    'order_id', p_order_id,
    'delivery_id', v_delivery_id,
    'rider_id', p_rider_id,
    'rider_email', v_rider_record.email,
    'rider_name', v_rider_record.full_name,
    'message', 'Rider assigned and delivery created successfully'
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

-- Add helpful comment
COMMENT ON FUNCTION assign_rider_to_order(TEXT, UUID) IS 
  'Atomically assigns a rider to a delivery order with validation and creates delivery record. '
  'Returns JSON with success status and details. '
  'Validates rider exists and has role=''rider'' within the same transaction. '
  'Creates or updates delivery record for rider interface. '
  'Note: order_id is TEXT type to match orders.id column type.';

-- Grant execute permission to authenticated users (cashiers)
GRANT EXECUTE ON FUNCTION assign_rider_to_order(TEXT, UUID) TO authenticated;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Migration 065: Create Delivery on Rider Assignment - COMPLETE';
  RAISE NOTICE '================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Updated function: assign_rider_to_order(order_id, rider_id)';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes:';
  RAISE NOTICE '  + Creates delivery record when rider is assigned';
  RAISE NOTICE '  + Deliveries now appear in rider interface';
  RAISE NOTICE '  + Handles both new and existing delivery records';
  RAISE NOTICE '';
  RAISE NOTICE 'This fixes the issue where riders could not see assigned deliveries';
  RAISE NOTICE '================================================================';
END $$;
