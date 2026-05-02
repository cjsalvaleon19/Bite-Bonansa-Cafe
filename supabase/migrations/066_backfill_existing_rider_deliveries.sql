-- =============================================================================
-- Migration 066: Backfill Delivery Records for Existing Rider Assignments
-- =============================================================================
-- Purpose: Create delivery records for orders that were assigned to riders
--          BEFORE migration 065 was deployed
-- 
-- Problem: Migration 065 fixed assign_rider_to_order() to create delivery records,
--          but only for NEW assignments. Existing orders with riders don't have
--          delivery records, so they don't appear in rider interface.
--
-- Solution: Backfill deliveries table with records for all existing rider assignments
-- =============================================================================

-- Create delivery records for existing orders that have riders but no delivery record
DO $$
DECLARE
  v_inserted_count INT;
  v_orders_with_riders INT;
  v_existing_deliveries INT;
BEGIN
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Migration 066: Backfilling Delivery Records';
  RAISE NOTICE '================================================================';
  RAISE NOTICE '';
  
  -- Count orders with riders
  SELECT COUNT(*) INTO v_orders_with_riders
  FROM orders
  WHERE rider_id IS NOT NULL
    AND order_mode = 'delivery';
  
  RAISE NOTICE 'Found % orders with assigned riders', v_orders_with_riders;
  
  -- Count existing deliveries
  SELECT COUNT(*) INTO v_existing_deliveries
  FROM deliveries;
  
  RAISE NOTICE 'Found % existing delivery records', v_existing_deliveries;
  
  -- Insert delivery records for orders that have riders but no delivery record
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
    created_at,
    updated_at
  )
  SELECT 
    o.id,
    o.rider_id,
    o.customer_name,
    o.customer_phone,
    o.customer_address,
    o.customer_latitude,
    o.customer_longitude,
    COALESCE(o.delivery_fee, 50), -- Default to 50 if null, matching deliveries table DEFAULT
    CASE 
      WHEN o.status = 'out_for_delivery' THEN 'pending'
      WHEN o.status = 'order_delivered' THEN 'completed'
      ELSE 'pending'
    END,
    COALESCE(o.out_for_delivery_at, o.updated_at, o.created_at), -- Use best available timestamp
    NOW()
  FROM orders o
  WHERE o.rider_id IS NOT NULL
    AND o.order_mode = 'delivery'
    AND NOT EXISTS (
      SELECT 1 FROM deliveries d WHERE d.order_id = o.id
    );
  
  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Backfill Results:';
  RAISE NOTICE '  + Inserted % new delivery records', v_inserted_count;
  RAISE NOTICE '';
  
  IF v_inserted_count > 0 THEN
    RAISE NOTICE 'Successfully backfilled delivery records!';
    RAISE NOTICE 'Riders should now see their assigned deliveries.';
  ELSE
    RAISE NOTICE 'No backfill needed - all rider assignments already have delivery records.';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '================================================================';
  RAISE NOTICE 'Migration 066 Complete';
  RAISE NOTICE '================================================================';
END $$;

-- Verify the results
DO $$
DECLARE
  v_total_deliveries INT;
  v_pending_deliveries INT;
  v_completed_deliveries INT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Verification:';
  RAISE NOTICE '================================================================';
  
  SELECT COUNT(*) INTO v_total_deliveries FROM deliveries;
  SELECT COUNT(*) INTO v_pending_deliveries FROM deliveries WHERE status = 'pending';
  SELECT COUNT(*) INTO v_completed_deliveries FROM deliveries WHERE status = 'completed';
  
  RAISE NOTICE 'Total deliveries: %', v_total_deliveries;
  RAISE NOTICE 'Pending deliveries: %', v_pending_deliveries;
  RAISE NOTICE 'Completed deliveries: %', v_completed_deliveries;
  RAISE NOTICE '';
  RAISE NOTICE 'Check rider interface - deliveries should now appear!';
  RAISE NOTICE '================================================================';
END $$;
