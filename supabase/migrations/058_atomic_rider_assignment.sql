-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 058: Atomic Rider Assignment Function
-- ═══════════════════════════════════════════════════════════════════════════
-- Purpose: Fix persistent 409 FK constraint errors by making rider assignment atomic
-- 
-- Problem: Even with validation in the application and migration 057's trigger,
--          there's still a timing gap between:
--          1. App validates rider exists with role='rider'
--          2. App sends UPDATE to database
--         In this gap, data could change or there could be consistency issues.
--
-- Solution: Create a database function that performs validation and assignment
--          atomically within a single transaction, eliminating the timing gap.
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop function if it exists (for idempotency)
DROP FUNCTION IF EXISTS assign_rider_to_order(UUID, UUID);

-- Create atomic rider assignment function
CREATE OR REPLACE FUNCTION assign_rider_to_order(
  p_order_id UUID,
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
  -- This validation happens within the same transaction as the update
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
  -- Since we're in the same transaction, the rider validation is still valid
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
    -- This should never happen due to our validation, but catch it anyway
    RETURN json_build_object(
      'success', false,
      'error', 'FK_VIOLATION',
      'message', 'Foreign key constraint violation: ' || SQLERRM,
      'order_id', p_order_id,
      'rider_id', p_rider_id
    );
  WHEN OTHERS THEN
    -- Catch any other unexpected errors
    RETURN json_build_object(
      'success', false,
      'error', 'UNEXPECTED_ERROR',
      'message', SQLERRM,
      'sqlstate', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql;

-- Add helpful comment
COMMENT ON FUNCTION assign_rider_to_order(UUID, UUID) IS 
  'Atomically assigns a rider to a delivery order with validation. '
  'Returns JSON with success status and details. '
  'Validates rider exists and has role=''rider'' within the same transaction as the update.';

-- Grant execute permission to authenticated users (cashiers)
GRANT EXECUTE ON FUNCTION assign_rider_to_order(UUID, UUID) TO authenticated;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Migration 058: Atomic Rider Assignment Function - COMPLETE';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Created function: assign_rider_to_order(order_id, rider_id)';
  RAISE NOTICE '';
  RAISE NOTICE 'This function performs atomic rider assignment with validation:';
  RAISE NOTICE '  ✓ Validates order exists and is delivery mode';
  RAISE NOTICE '  ✓ Validates rider exists in users table';
  RAISE NOTICE '  ✓ Validates rider has role = ''rider''';
  RAISE NOTICE '  ✓ Updates order in same transaction';
  RAISE NOTICE '  ✓ Returns detailed JSON response';
  RAISE NOTICE '';
  RAISE NOTICE 'Usage from application:';
  RAISE NOTICE '  SELECT assign_rider_to_order(''<order-id>'', ''<rider-id>'')';
  RAISE NOTICE '';
  RAISE NOTICE 'Next step: Update pages/cashier/orders-queue.js to call this function';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
END $$;
