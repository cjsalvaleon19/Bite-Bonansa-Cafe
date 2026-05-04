-- ============================================================================
-- Migration 089: Force Delete Order #ORD-260430-006
-- ============================================================================
-- Purpose: Permanently remove order ORD-260430-006 and all its related records
--          from the system.
-- Steps:
--   1. Resolve the order UUID from order_number
--   2. Nullify cash_drawer_transactions.reference_order_id (no ON DELETE clause)
--   3. Delete notifications referencing this order (no FK, just cleanup)
--   4. Delete order_items for this order
--   5. Delete the order itself
--      - deliveries.order_id  ON DELETE CASCADE → auto-deleted
--      - loyalty_transactions.order_id  ON DELETE SET NULL → auto-nulled
-- ============================================================================

DO $$
DECLARE
  v_order_id UUID;
BEGIN
  -- Step 1: Resolve order UUID
  SELECT id INTO v_order_id
  FROM orders
  WHERE order_number = 'ORD-260430-006'
  LIMIT 1;

  IF v_order_id IS NULL THEN
    RAISE NOTICE 'Order ORD-260430-006 not found – nothing to delete.';
    RETURN;
  END IF;

  RAISE NOTICE 'Deleting order ORD-260430-006 (id: %)', v_order_id;

  -- Step 2: Nullify cash_drawer_transactions references (no ON DELETE clause)
  UPDATE cash_drawer_transactions
  SET reference_order_id = NULL
  WHERE reference_order_id = v_order_id::TEXT;

  -- Step 3: Delete notifications referencing this order
  DELETE FROM notifications
  WHERE related_id = v_order_id
    AND related_type = 'order';

  -- Step 4: Delete order_items (may have no ON DELETE CASCADE depending on schema)
  DELETE FROM order_items
  WHERE order_id = v_order_id;

  -- Step 5: Delete the order (cascade handles deliveries; SET NULL handles loyalty_transactions)
  DELETE FROM orders
  WHERE id = v_order_id;

  RAISE NOTICE 'Order ORD-260430-006 and related records deleted successfully.';
END $$;
