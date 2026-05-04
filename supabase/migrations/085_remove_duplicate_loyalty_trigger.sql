-- ============================================================================
-- Migration 085: Remove Duplicate Loyalty Trigger
-- ============================================================================
-- Purpose: Drop old trg_award_loyalty_points trigger to prevent duplicate loyalty awards
-- Problem: Two loyalty triggers are active on orders table:
--          1. trg_award_loyalty_points (old, no ON CONFLICT handling)
--          2. trg_award_loyalty_points_on_order_completion (new, has ON CONFLICT)
--          Both fire on order updates, causing duplicate key errors
-- Solution: Keep only trg_award_loyalty_points_on_order_completion
-- ============================================================================

-- Drop the old trigger that doesn't have ON CONFLICT handling
DROP TRIGGER IF EXISTS trg_award_loyalty_points ON orders;

-- Also drop the old function if it exists (different from award_loyalty_points_on_order_completion)
DROP FUNCTION IF EXISTS award_loyalty_points();

-- Verify that only the correct trigger remains active
-- The remaining trigger should be: trg_award_loyalty_points_on_order_completion
-- which uses the award_loyalty_points_on_order_completion() function with ON CONFLICT

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Migration 085: Remove Duplicate Loyalty Trigger - COMPLETE';
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Changes applied:';
  RAISE NOTICE '  ✓ Dropped trg_award_loyalty_points trigger';
  RAISE NOTICE '  ✓ Dropped award_loyalty_points() function';
  RAISE NOTICE '  ✓ Only trg_award_loyalty_points_on_order_completion remains';
  RAISE NOTICE '  ✓ Prevents duplicate loyalty transaction errors';
  RAISE NOTICE '';
  RAISE NOTICE 'Active trigger: trg_award_loyalty_points_on_order_completion';
  RAISE NOTICE 'Active function: award_loyalty_points_on_order_completion()';
  RAISE NOTICE '  - Has ON CONFLICT (order_id, transaction_type) DO NOTHING';
  RAISE NOTICE '  - Safe from duplicate key violations';
  RAISE NOTICE '================================================================';
END $$;
