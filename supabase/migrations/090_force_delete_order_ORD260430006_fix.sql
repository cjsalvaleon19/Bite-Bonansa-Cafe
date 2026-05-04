-- ============================================================================
-- Migration 090: Force Delete Order #ORD-260430-006 (retry with type-cast fix)
-- ============================================================================
-- Purpose: Migration 089 failed because order_items.order_id is TEXT while
--          the resolved v_order_id variable is UUID, causing:
--            "operator does not exist: text = uuid"
--          This migration retries the deletion with the correct ::TEXT cast
--          where needed.
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

  -- Step 2: Nullify cash_drawer_transactions references (reference_order_id is TEXT)
  UPDATE cash_drawer_transactions
  SET reference_order_id = NULL
  WHERE reference_order_id = v_order_id::TEXT;

  -- Step 3: Delete notifications referencing this order (related_id is UUID)
  DELETE FROM notifications
  WHERE related_id = v_order_id
    AND related_type = 'order';

  -- Step 4: Delete order_items (order_id is TEXT, so cast v_order_id to TEXT)
  DELETE FROM order_items
  WHERE order_id = v_order_id::TEXT;

  -- Step 5: Delete the order (cascade handles deliveries; SET NULL handles loyalty_transactions)
  DELETE FROM orders
  WHERE id = v_order_id;

  RAISE NOTICE 'Order ORD-260430-006 and all related records deleted successfully.';
END $$;
