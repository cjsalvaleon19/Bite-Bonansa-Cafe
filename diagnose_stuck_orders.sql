-- ============================================================================
-- Diagnose and Fix Stuck Orders in Order Queue
-- ============================================================================
-- Purpose: This script helps diagnose and fix orders that show as complete
-- but are not clearing from the Order Queue.
--
-- Problem: Orders appear stuck in the queue even though the system says 
-- they are complete.
-- ============================================================================

-- Define the problematic order numbers here (modify as needed)
WITH stuck_orders AS (
  SELECT unnest(ARRAY[
    'ORD-260430-006',
    'ORD-260504-002', 
    'ORD-260504-004'
  ]) AS order_number
)

-- STEP 1: Check the current status of the problematic orders
SELECT 
  o.order_number,
  o.status,
  o.order_mode,
  o.created_at,
  o.delivered_at,
  o.items IS NOT NULL as has_items_column,
  CASE 
    WHEN o.items IS NULL THEN 'NULL'
    WHEN o.items::text = '[]' THEN 'EMPTY ARRAY'
    ELSE jsonb_array_length(o.items)::text || ' items'
  END as items_status,
  o.delivery_fee,
  o.cash_amount,
  o.customer_name,
  o.customer_phone
FROM orders o
INNER JOIN stuck_orders so ON o.order_number = so.order_number
ORDER BY o.created_at;

-- STEP 2: Check if there are deliveries for these orders
SELECT 
  d.id as delivery_id,
  d.status as delivery_status,
  d.created_at as delivery_created,
  d.completed_at as delivery_completed,
  d.order_id,
  o.order_number,
  o.status as order_status,
  o.order_mode
FROM deliveries d
JOIN orders o ON o.id = d.order_id
INNER JOIN stuck_orders so ON o.order_number = so.order_number
ORDER BY d.created_at;

-- STEP 3: Check all orders currently in the queue
-- These are orders that would show in the Order Queue interface
SELECT 
  o.order_number,
  o.status,
  o.order_mode,
  o.created_at,
  CASE 
    WHEN o.items IS NULL THEN 'NULL'
    WHEN o.items::text = '[]' THEN 'EMPTY ARRAY'
    ELSE jsonb_array_length(o.items)::text || ' items'
  END as items_status,
  o.delivery_fee,
  o.cash_amount
FROM orders o
INNER JOIN stuck_orders so ON o.order_number = so.order_number
WHERE o.status IN ('order_in_queue', 'order_in_process', 'proceed_to_cashier', 'out_for_delivery')
ORDER BY o.created_at;

-- STEP 4: FIX - Update stuck orders to 'order_delivered' status
-- Uncomment the following lines to execute the fix:

/*
WITH stuck_orders AS (
  SELECT unnest(ARRAY[
    'ORD-260430-006',
    'ORD-260504-002', 
    'ORD-260504-004'
  ]) AS order_number
)
UPDATE orders o
SET 
  status = 'order_delivered',
  delivered_at = COALESCE(o.delivered_at, NOW())
FROM stuck_orders so
WHERE o.order_number = so.order_number
  AND o.status IN ('out_for_delivery', 'order_in_process', 'proceed_to_cashier', 'order_in_queue')
RETURNING o.order_number, o.status, o.delivered_at;
*/

-- STEP 5: Check if order_items table has items for these orders
SELECT 
  o.order_number,
  o.status,
  oi.id as order_item_id,
  oi.name as item_name,
  oi.quantity,
  oi.price,
  oi.served
FROM orders o
INNER JOIN stuck_orders so ON o.order_number = so.order_number
LEFT JOIN order_items oi ON oi.order_id = o.id
ORDER BY o.order_number, oi.id;

-- STEP 6: Check if items JSONB column has data
SELECT 
  o.order_number,
  o.status,
  o.items
FROM orders o
INNER JOIN stuck_orders so ON o.order_number = so.order_number;
