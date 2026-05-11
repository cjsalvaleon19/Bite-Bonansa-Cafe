-- ============================================================================
-- Migration 136: Delete trial orders from April 27, 2026 to May 10, 2026
-- ============================================================================
-- Purpose:
--   Permanently remove trial-and-error orders that should not be treated as
--   real transactions.
--
-- Scope (inclusive, Asia/Manila calendar date):
--   2026-04-27 through 2026-05-10
-- ============================================================================

DO $$
DECLARE
  v_orders_targeted        INTEGER := 0;
  v_cash_drawer_nulled     INTEGER := 0;
  v_notifications_deleted  INTEGER := 0;
  v_journal_deleted        INTEGER := 0;
  v_loyalty_deleted        INTEGER := 0;
  v_order_items_deleted    INTEGER := 0;
  v_orders_deleted         INTEGER := 0;
BEGIN
  CREATE TEMP TABLE tmp_trial_orders ON COMMIT DROP AS
  SELECT
    o.id::TEXT          AS order_id,
    o.order_number::TEXT AS order_number
  FROM orders o
  WHERE DATE(o.created_at AT TIME ZONE 'Asia/Manila')
        BETWEEN DATE '2026-04-27' AND DATE '2026-05-10';

  SELECT COUNT(*) INTO v_orders_targeted FROM tmp_trial_orders;

  IF v_orders_targeted = 0 THEN
    RAISE NOTICE 'No trial orders found in range 2026-04-27 to 2026-05-10 (Asia/Manila).';
    RETURN;
  END IF;

  UPDATE cash_drawer_transactions cdt
  SET reference_order_id = NULL
  WHERE cdt.reference_order_id IN (
    SELECT t.order_id FROM tmp_trial_orders t
  );
  GET DIAGNOSTICS v_cash_drawer_nulled = ROW_COUNT;

  DELETE FROM notifications n
  WHERE n.related_type = 'order'
    AND n.related_id::TEXT IN (
      SELECT t.order_id FROM tmp_trial_orders t
    );
  GET DIAGNOSTICS v_notifications_deleted = ROW_COUNT;

  DELETE FROM journal_entries je
  WHERE je.reference_type = 'order'
    AND (
      je.reference IN (
        SELECT t.order_number
        FROM tmp_trial_orders t
        WHERE t.order_number IS NOT NULL AND t.order_number <> ''
      )
      OR je.reference IN (
        SELECT t.order_id FROM tmp_trial_orders t
      )
    );
  GET DIAGNOSTICS v_journal_deleted = ROW_COUNT;

  DELETE FROM loyalty_transactions lt
  WHERE lt.order_id::TEXT IN (
    SELECT t.order_id FROM tmp_trial_orders t
  );
  GET DIAGNOSTICS v_loyalty_deleted = ROW_COUNT;

  DELETE FROM order_items oi
  WHERE oi.order_id IN (
    SELECT t.order_id FROM tmp_trial_orders t
  );
  GET DIAGNOSTICS v_order_items_deleted = ROW_COUNT;

  DELETE FROM orders o
  WHERE o.id::TEXT IN (
    SELECT t.order_id FROM tmp_trial_orders t
  );
  GET DIAGNOSTICS v_orders_deleted = ROW_COUNT;

  RAISE NOTICE 'Deleted trial orders in range 2026-04-27 to 2026-05-10 (Asia/Manila):';
  RAISE NOTICE '  Orders targeted: %', v_orders_targeted;
  RAISE NOTICE '  Cash drawer refs nulled: %', v_cash_drawer_nulled;
  RAISE NOTICE '  Notifications deleted: %', v_notifications_deleted;
  RAISE NOTICE '  Journal entries deleted: %', v_journal_deleted;
  RAISE NOTICE '  Loyalty transactions deleted: %', v_loyalty_deleted;
  RAISE NOTICE '  Order items deleted: %', v_order_items_deleted;
  RAISE NOTICE '  Orders deleted: %', v_orders_deleted;
END $$;
