-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 059: Fix Type Mismatch in assign_rider_to_order Function
-- ═══════════════════════════════════════════════════════════════════════════
-- Purpose: Fix the type mismatch error in assign_rider_to_order function
--
-- Problem: Migration 058 incorrectly defined p_order_id as UUID type,
--          but orders.id is TEXT type. This causes the error:
--          "operator does not exist: text = uuid"
--
-- Solution: Drop the incorrect function and recreate with correct types:
--          - p_order_id TEXT (not UUID)
--          - p_rider_id UUID (correct)
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop the incorrect function signatures
DROP FUNCTION IF EXISTS assign_rider_to_order(UUID, UUID);
DROP FUNCTION IF EXISTS assign_rider_to_order(TEXT, UUID);

-- Recreate the function with correct types
CREATE OR REPLACE FUNCTION assign_rider_to_order(
  p_order_id TEXT,    -- TEXT to match orders.id type
  p_rider_id UUID     -- UUID to match users.id type
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
  -- Note: 'out_for_delivery' status is consistent with notification trigger expectations
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
COMMENT ON FUNCTION assign_rider_to_order(TEXT, UUID) IS 
  'Atomically assigns a rider to a delivery order with validation. '
  'Returns JSON with success status and details. '
  'Validates rider exists and has role=''rider'' within the same transaction as the update. '
  'IMPORTANT: order_id is TEXT type to match orders.id column type (not UUID).';

-- Grant execute permission to authenticated users (cashiers)
GRANT EXECUTE ON FUNCTION assign_rider_to_order(TEXT, UUID) TO authenticated;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Migration 059: Fix assign_rider_to_order Type Mismatch';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Fixed function signature:';
  RAISE NOTICE '  ✓ p_order_id: UUID → TEXT (to match orders.id)';
  RAISE NOTICE '  ✓ p_rider_id: UUID (correct)';
  RAISE NOTICE '';
  RAISE NOTICE 'This fixes the error: "operator does not exist: text = uuid"';
  RAISE NOTICE '';
  RAISE NOTICE 'Function is now ready to use with correct types.';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
END $$;
