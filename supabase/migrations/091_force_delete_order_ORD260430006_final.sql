-- ============================================================================
-- Migration 091: Force Delete Order #ORD-260430-006 (final fix)
-- ============================================================================
-- Purpose: Migrations 089 and 090 both failed with "operator does not exist:
--          text = uuid" because both orders.id and order_items.order_id are
--          stored as TEXT, not UUID.
--          This migration declares v_order_id as TEXT to avoid all type
--          mismatch issues across every DELETE/UPDATE statement.
-- ============================================================================

DO $$
DECLARE
  v_order_id TEXT;
BEGIN
  -- Step 1: Resolve order id (stored as TEXT in orders table)
  SELECT id::TEXT INTO v_order_id
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
  WHERE reference_order_id = v_order_id;

  -- Step 3: Delete notifications referencing this order
  DELETE FROM notifications
  WHERE related_id::TEXT = v_order_id
    AND related_type = 'order';

  -- Step 4: Delete order_items (order_id is TEXT)
  DELETE FROM order_items
  WHERE order_id = v_order_id;

  -- Step 5: Delete the order (id is TEXT; cascade handles deliveries; SET NULL handles loyalty_transactions)
  DELETE FROM orders
  WHERE id = v_order_id;

  RAISE NOTICE 'Order ORD-260430-006 and all related records deleted successfully.';
END $$;
