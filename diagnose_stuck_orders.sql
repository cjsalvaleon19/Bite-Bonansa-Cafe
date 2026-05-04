-- ============================================================================
-- Diagnose and Fix Stuck Orders in Order Queue
-- ============================================================================
-- Purpose: This script helps diagnose and fix orders that show as complete
-- but are not clearing from the Order Queue.
--
-- Problem: Orders ORD-260430-006, ORD-260504-002, ORD-260504-004 are stuck
-- in the queue even though the system says they are complete.
-- ============================================================================

-- STEP 1: Check the current status of the problematic orders
SELECT 
  order_number,
  status,
  order_mode,
  created_at,
  delivered_at,
  items IS NOT NULL as has_items_column,
  CASE 
    WHEN items IS NULL THEN 'NULL'
    WHEN items::text = '[]' THEN 'EMPTY ARRAY'
    ELSE jsonb_array_length(items)::text || ' items'
  END as items_status,
  delivery_fee,
  cash_amount,
  customer_name,
  customer_phone
FROM orders 
WHERE order_number IN ('ORD-260430-006', 'ORD-260504-002', 'ORD-260504-004')
ORDER BY created_at;

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
WHERE o.order_number IN ('ORD-260430-006', 'ORD-260504-002', 'ORD-260504-004')
ORDER BY d.created_at;

-- STEP 3: Check all orders currently in the queue
-- These are orders that would show in the Order Queue interface
SELECT 
  order_number,
  status,
  order_mode,
  created_at,
  CASE 
    WHEN items IS NULL THEN 'NULL'
    WHEN items::text = '[]' THEN 'EMPTY ARRAY'
    ELSE jsonb_array_length(items)::text || ' items'
  END as items_status,
  delivery_fee,
  cash_amount
FROM orders 
WHERE status IN ('order_in_queue', 'order_in_process', 'proceed_to_cashier', 'out_for_delivery')
  AND order_number IN ('ORD-260430-006', 'ORD-260504-002', 'ORD-260504-004')
ORDER BY created_at;

-- STEP 4: FIX - Update stuck orders to 'order_delivered' status
-- Uncomment the following lines to execute the fix:

/*
UPDATE orders
SET 
  status = 'order_delivered',
  delivered_at = COALESCE(delivered_at, NOW())
WHERE order_number IN ('ORD-260430-006', 'ORD-260504-002', 'ORD-260504-004')
  AND status IN ('out_for_delivery', 'order_in_process', 'proceed_to_cashier', 'order_in_queue')
RETURNING order_number, status, delivered_at;
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
LEFT JOIN order_items oi ON oi.order_id = o.id
WHERE o.order_number IN ('ORD-260430-006', 'ORD-260504-002', 'ORD-260504-004')
ORDER BY o.order_number, oi.id;

-- STEP 6: Check if items JSONB column has data
SELECT 
  order_number,
  status,
  items
FROM orders 
WHERE order_number IN ('ORD-260430-006', 'ORD-260504-002', 'ORD-260504-004');
