-- ============================================================================
-- Delivery Fee Calculator SQL Functions - Test & Usage Examples
-- ============================================================================

-- Test 1: Calculate distance between store and a customer location
-- Store: 6.2178483, 124.8221226 (Bite Bonansa Cafe, T'boli)
-- Example customer: 6.2200000, 124.8250000 (approximately 300m away)

SELECT calculate_distance_meters(
  6.2178483,  -- Store latitude
  124.8221226, -- Store longitude
  6.2200000,   -- Customer latitude
  124.8250000  -- Customer longitude
) AS distance_in_meters;

-- Expected result: approximately 300 meters

-- Test 2: Calculate delivery fee for various distances
SELECT 
  500 AS distance_meters,
  calculate_delivery_fee(500) AS fee,
  '₱35 (base fee for 0-1000m)' AS description
UNION ALL
SELECT 
  1000,
  calculate_delivery_fee(1000),
  '₱35 (base fee for exactly 1000m)'
UNION ALL
SELECT 
  1200,
  calculate_delivery_fee(1200),
  '₱45 (₱35 + ₱10 for 1001-1200m)'
UNION ALL
SELECT 
  1400,
  calculate_delivery_fee(1400),
  '₱55 (₱35 + ₱20 for 1201-1400m)'
UNION ALL
SELECT 
  1600,
  calculate_delivery_fee(1600),
  '₱65 (₱35 + ₱30 for 1401-1600m)'
UNION ALL
SELECT 
  2000,
  calculate_delivery_fee(2000),
  '₱85 (₱35 + ₱50 for 1601-2000m)';

-- Test 3: Calculate delivery fee directly from customer location
SELECT 
  'Customer at 6.2200000, 124.8250000' AS customer_location,
  calculate_delivery_fee_from_store(6.2200000, 124.8250000) AS delivery_fee;

-- Test 4: Real-world example - Calculate fees for multiple customer locations
SELECT 
  customer_name,
  customer_latitude,
  customer_longitude,
  calculate_distance_meters(
    6.2178483, 124.8221226,
    customer_latitude, customer_longitude
  ) AS distance_meters,
  calculate_delivery_fee_from_store(
    customer_latitude, customer_longitude
  ) AS delivery_fee
FROM (
  VALUES 
    ('Customer A - Near', 6.2180000::DECIMAL, 124.8225000::DECIMAL),
    ('Customer B - 1km away', 6.2270000::DECIMAL, 124.8221226::DECIMAL),
    ('Customer C - 2km away', 6.2360000::DECIMAL, 124.8221226::DECIMAL),
    ('Customer D - 500m away', 6.2135000::DECIMAL, 124.8221226::DECIMAL)
) AS customers(customer_name, customer_latitude, customer_longitude);

-- Test 5: Use in an UPDATE statement to set delivery fees
-- Example: Update deliveries table with calculated fees
-- UPDATE deliveries
-- SET 
--   distance_meters = calculate_distance_meters(
--     6.2178483, 124.8221226,
--     customer_latitude, customer_longitude
--   ),
--   delivery_fee = calculate_delivery_fee_from_store(
--     customer_latitude, customer_longitude
--   )
-- WHERE customer_latitude IS NOT NULL 
--   AND customer_longitude IS NOT NULL
--   AND delivery_fee = 0;

-- Test 6: Use in a SELECT to preview calculated fees for orders
-- SELECT 
--   id,
--   customer_name,
--   delivery_address,
--   delivery_latitude,
--   delivery_longitude,
--   calculate_delivery_fee_from_store(
--     delivery_latitude, delivery_longitude
--   ) AS calculated_fee,
--   delivery_fee AS current_fee
-- FROM orders
-- WHERE delivery_latitude IS NOT NULL
--   AND delivery_longitude IS NOT NULL
--   AND order_mode = 'delivery';

-- ============================================================================
-- Expected Delivery Fee Schedule
-- ============================================================================
-- Distance Range        | Fee
-- ---------------------|------
-- 0 – 1,000 m          | ₱35
-- 1,001 – 1,200 m      | ₱45
-- 1,201 – 1,400 m      | ₱55
-- 1,401 – 1,600 m      | ₱65
-- 1,601 – 1,800 m      | ₱75
-- 1,801 – 2,000 m      | ₱85
-- + ₱10 per additional 200m
-- ============================================================================
