-- ============================================================================
-- Migration 092: Create reusable delete_order() function
-- ============================================================================
-- Purpose: Provide a safe, reusable function to permanently delete any order
--          and all its related records.
--
-- Root cause addressed: orders.id and order_items.order_id are stored as TEXT
-- in this database.  Previous ad-hoc scripts (089/090) declared v_order_id as
-- UUID, which caused:
--   "operator does not exist: text = uuid"
-- when comparing against those TEXT columns.
--
-- Fix: all internal variables use TEXT so every comparison is TEXT = TEXT.
--
-- Usage (run in Supabase SQL editor):
--   SELECT delete_order('ORD-260430-007');
-- ============================================================================

CREATE OR REPLACE FUNCTION delete_order(p_order_number TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id TEXT;  -- TEXT, not UUID – orders.id is stored as TEXT
  v_deleted_items  INTEGER := 0;
  v_deleted_notifs INTEGER := 0;
BEGIN
  -- ── Step 1: Resolve the order id (TEXT) from order_number ─────────────────
  SELECT id::TEXT INTO v_order_id
  FROM orders
  WHERE order_number = p_order_number
  LIMIT 1;

  IF v_order_id IS NULL THEN
    RETURN format('Order %s not found – nothing to delete.', p_order_number);
  END IF;

  -- ── Step 2: Nullify cash_drawer_transactions.reference_order_id ───────────
  -- (reference_order_id is TEXT; no ON DELETE clause on that FK)
  UPDATE cash_drawer_transactions
  SET reference_order_id = NULL
  WHERE reference_order_id = v_order_id;

  -- ── Step 3: Delete notifications referencing this order ───────────────────
  -- (notifications.related_id may be UUID-typed; cast it to TEXT for comparison)
  DELETE FROM notifications
  WHERE related_id::TEXT = v_order_id
    AND related_type = 'order';
  GET DIAGNOSTICS v_deleted_notifs = ROW_COUNT;

  -- ── Step 4: Delete order_items ────────────────────────────────────────────
  -- (order_items.order_id is TEXT)
  DELETE FROM order_items
  WHERE order_id = v_order_id;
  GET DIAGNOSTICS v_deleted_items = ROW_COUNT;

  -- ── Step 5: Delete the order itself ───────────────────────────────────────
  -- deliveries.order_id            ON DELETE CASCADE → auto-deleted
  -- loyalty_transactions.order_id  ON DELETE SET NULL → auto-nulled
  DELETE FROM orders
  WHERE id = v_order_id;  -- TEXT = TEXT ✓

  RETURN format(
    'Order %s (id: %s) deleted successfully. '
    'Removed %s order_item(s) and %s notification(s).',
    p_order_number, v_order_id, v_deleted_items, v_deleted_notifs
  );

EXCEPTION WHEN OTHERS THEN
  RETURN format(
    'Failed to delete order %s: %s',
    p_order_number, SQLERRM
  );
END;
$$;

-- Grant execute to authenticated roles so admins can call it from the dashboard
GRANT EXECUTE ON FUNCTION delete_order(TEXT) TO authenticated;

COMMENT ON FUNCTION delete_order(TEXT) IS
  'Permanently deletes an order and all related records (order_items, '
  'notifications, cash_drawer_transaction refs). '
  'Deliveries are removed via ON DELETE CASCADE; loyalty_transactions.order_id '
  'is set to NULL via ON DELETE SET NULL. '
  'Uses TEXT variables throughout to match the TEXT storage type of orders.id.';
