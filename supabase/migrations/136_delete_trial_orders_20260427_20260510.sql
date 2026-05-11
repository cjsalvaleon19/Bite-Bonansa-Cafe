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
  v_trial_deliveries       INTEGER := 0;
  v_delivery_reports_seen  INTEGER := 0;
  v_cash_drawer_nulled     INTEGER := 0;
  v_bill_payments_deleted  INTEGER := 0;
  v_bill_payments_updated  INTEGER := 0;
  v_notifications_deleted  INTEGER := 0;
  v_report_notifs_deleted  INTEGER := 0;
  v_journal_deleted        INTEGER := 0;
  v_loyalty_deleted        INTEGER := 0;
  v_rider_earnings_fixed   INTEGER := 0;
  v_rider_delivery_stats   INTEGER := 0;
  v_delivery_reports_upd   INTEGER := 0;
  v_delivery_reports_del   INTEGER := 0;
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

  CREATE TEMP TABLE tmp_trial_deliveries ON COMMIT DROP AS
  SELECT
    d.id AS delivery_id,
    d.rider_id,
    d.status,
    COALESCE(o.delivery_fee, d.delivery_fee, 0)::DECIMAL(10,2) AS delivery_fee
  FROM deliveries d
  JOIN tmp_trial_orders t
    ON t.order_id = d.order_id
  LEFT JOIN orders o
    ON o.id::TEXT = d.order_id;

  SELECT COUNT(*) INTO v_trial_deliveries FROM tmp_trial_deliveries;

  CREATE TEMP TABLE tmp_affected_delivery_reports ON COMMIT DROP AS
  WITH affected_reports AS (
    SELECT DISTINCT dr.id
    FROM delivery_reports dr
    JOIN LATERAL unnest(COALESCE(dr.delivery_ids, ARRAY[]::UUID[])) AS did(delivery_id) ON true
    JOIN tmp_trial_deliveries td
      ON td.delivery_id = did.delivery_id
  ),
  report_rollup AS (
    SELECT
      dr.id AS report_id,
      dr.rider_id,
      dr.status,
      COALESCE(dr.rider_earnings, 0)::DECIMAL(10,2) AS old_rider_earnings,
      COALESCE(
        ARRAY_AGG(d_all.id ORDER BY COALESCE(d_all.completed_at, d_all.created_at), d_all.id)
          FILTER (WHERE td_remove.delivery_id IS NULL AND d_all.id IS NOT NULL),
        ARRAY[]::UUID[]
      ) AS remaining_delivery_ids,
      COUNT(d_all.id) FILTER (WHERE td_remove.delivery_id IS NULL) AS remaining_total_deliveries,
      COALESCE(
        SUM(COALESCE(o_all.delivery_fee, d_all.delivery_fee, 0)::DECIMAL(10,2))
          FILTER (WHERE td_remove.delivery_id IS NULL),
        0
      ) AS remaining_total_delivery_fees
    FROM delivery_reports dr
    JOIN affected_reports ar
      ON ar.id = dr.id
    LEFT JOIN LATERAL unnest(COALESCE(dr.delivery_ids, ARRAY[]::UUID[])) AS did(delivery_id) ON true
    LEFT JOIN deliveries d_all
      ON d_all.id = did.delivery_id
    LEFT JOIN orders o_all
      ON o_all.id::TEXT = d_all.order_id
    LEFT JOIN tmp_trial_deliveries td_remove
      ON td_remove.delivery_id = did.delivery_id
    GROUP BY dr.id, dr.rider_id, dr.status, dr.rider_earnings
  )
  SELECT
    rr.report_id,
    rr.rider_id,
    rr.status,
    rr.old_rider_earnings,
    rr.remaining_delivery_ids,
    rr.remaining_total_deliveries,
    rr.remaining_total_delivery_fees::DECIMAL(10,2) AS remaining_total_delivery_fees,
    ROUND((rr.remaining_total_delivery_fees * 0.60)::NUMERIC, 2)::DECIMAL(10,2) AS new_rider_earnings,
    ROUND((rr.remaining_total_delivery_fees * 0.40)::NUMERIC, 2)::DECIMAL(10,2) AS new_business_revenue
  FROM report_rollup rr;

  SELECT COUNT(*) INTO v_delivery_reports_seen FROM tmp_affected_delivery_reports;

  UPDATE cash_drawer_transactions cdt
  SET reference_order_id = NULL
  WHERE cdt.reference_order_id IN (
    SELECT t.order_id FROM tmp_trial_orders t
  );
  GET DIAGNOSTICS v_cash_drawer_nulled = ROW_COUNT;

  IF v_delivery_reports_seen > 0 THEN
    DELETE FROM notifications n
    WHERE n.related_type = 'delivery_report'
      AND n.related_id::TEXT IN (
        SELECT tr.report_id::TEXT
        FROM tmp_affected_delivery_reports tr
      );
    GET DIAGNOSTICS v_report_notifs_deleted = ROW_COUNT;

    DELETE FROM cash_drawer_transactions cdt
    WHERE cdt.bill_report_id IN (
      SELECT tr.report_id
      FROM tmp_affected_delivery_reports tr
      WHERE tr.remaining_total_deliveries = 0
    );
    GET DIAGNOSTICS v_bill_payments_deleted = ROW_COUNT;

    UPDATE cash_drawer_transactions cdt
    SET amount = tr.new_rider_earnings,
        updated_at = NOW()
    FROM tmp_affected_delivery_reports tr
    WHERE cdt.bill_report_id = tr.report_id
      AND tr.remaining_total_deliveries > 0
      AND cdt.amount IS DISTINCT FROM tr.new_rider_earnings;
    GET DIAGNOSTICS v_bill_payments_updated = ROW_COUNT;

    UPDATE riders r
    SET total_earnings = GREATEST(
          0,
          COALESCE(r.total_earnings, 0) - adj.earnings_to_reverse
        ),
        updated_at = NOW()
    FROM (
      SELECT
        tr.rider_id,
        SUM(
          CASE
            WHEN tr.status = 'paid' THEN GREATEST(0, tr.old_rider_earnings - tr.new_rider_earnings)
            ELSE 0
          END
        )::DECIMAL(10,2) AS earnings_to_reverse
      FROM tmp_affected_delivery_reports tr
      GROUP BY tr.rider_id
    ) adj
    WHERE r.user_id = adj.rider_id
      AND adj.earnings_to_reverse > 0;
    GET DIAGNOSTICS v_rider_earnings_fixed = ROW_COUNT;

    UPDATE riders r
    SET deliveries_completed = GREATEST(
          0,
          COALESCE(r.deliveries_completed, 0) - adj.completed_trial_deliveries
        ),
        updated_at = NOW()
    FROM (
      SELECT
        td.rider_id,
        COUNT(*)::INTEGER AS completed_trial_deliveries
      FROM tmp_trial_deliveries td
      WHERE td.status = 'completed'
      GROUP BY td.rider_id
    ) adj
    WHERE r.user_id = adj.rider_id;
    GET DIAGNOSTICS v_rider_delivery_stats = ROW_COUNT;

    UPDATE delivery_reports dr
    SET delivery_ids = tr.remaining_delivery_ids,
        total_deliveries = tr.remaining_total_deliveries,
        total_delivery_fees = tr.remaining_total_delivery_fees,
        rider_earnings = tr.new_rider_earnings,
        business_revenue = tr.new_business_revenue,
        updated_at = NOW()
    FROM tmp_affected_delivery_reports tr
    WHERE dr.id = tr.report_id
      AND tr.remaining_total_deliveries > 0;
    GET DIAGNOSTICS v_delivery_reports_upd = ROW_COUNT;

    DELETE FROM delivery_reports dr
    WHERE dr.id IN (
      SELECT tr.report_id
      FROM tmp_affected_delivery_reports tr
      WHERE tr.remaining_total_deliveries = 0
    );
    GET DIAGNOSTICS v_delivery_reports_del = ROW_COUNT;
  END IF;

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
  RAISE NOTICE '  Trial deliveries found: %', v_trial_deliveries;
  RAISE NOTICE '  Delivery reports affected: %', v_delivery_reports_seen;
  RAISE NOTICE '  Cash drawer refs nulled: %', v_cash_drawer_nulled;
  RAISE NOTICE '  Driver fee payments deleted: %', v_bill_payments_deleted;
  RAISE NOTICE '  Driver fee payments updated: %', v_bill_payments_updated;
  RAISE NOTICE '  Notifications deleted: %', v_notifications_deleted;
  RAISE NOTICE '  Delivery-report notifications deleted: %', v_report_notifs_deleted;
  RAISE NOTICE '  Journal entries deleted: %', v_journal_deleted;
  RAISE NOTICE '  Loyalty transactions deleted: %', v_loyalty_deleted;
  RAISE NOTICE '  Rider earnings rows adjusted: %', v_rider_earnings_fixed;
  RAISE NOTICE '  Rider delivery stat rows adjusted: %', v_rider_delivery_stats;
  RAISE NOTICE '  Delivery reports updated: %', v_delivery_reports_upd;
  RAISE NOTICE '  Delivery reports deleted: %', v_delivery_reports_del;
  RAISE NOTICE '  Order items deleted: %', v_order_items_deleted;
  RAISE NOTICE '  Orders deleted: %', v_orders_deleted;
END $$;
