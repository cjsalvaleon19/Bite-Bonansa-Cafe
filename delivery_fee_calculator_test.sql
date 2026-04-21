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
  '₱30 (base fare for 0-1000m)' AS description
UNION ALL
SELECT 
  1000,
  calculate_delivery_fee(1000),
  '₱30 (base fare for exactly 1000m)'
UNION ALL
SELECT 
  1200,
  calculate_delivery_fee(1200),
  '₱35 (₱30 + ₱5 for 1001-1500m)'
UNION ALL
SELECT 
  1500,
  calculate_delivery_fee(1500),
  '₱35 (₱30 + ₱5 for 1001-1500m)'
UNION ALL
SELECT 
  1800,
  calculate_delivery_fee(1800),
  '₱40 (₱30 + ₱10 for 1501-2000m)'
UNION ALL
SELECT 
  2000,
  calculate_delivery_fee(2000),
  '₱40 (₱30 + ₱10 for 1501-2000m)'
UNION ALL
SELECT 
  3000,
  calculate_delivery_fee(3000),
  '₱50 (₱30 + ₱20 for 2501-3000m)'
UNION ALL
SELECT 
  5000,
  calculate_delivery_fee(5000),
  '₱66 (₱30 + ₱36 for 4501-5000m)'
UNION ALL
SELECT 
  10000,
  calculate_delivery_fee(10000),
  '₱98 (₱30 + ₱68 for 9501-10000m)';

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
-- Expected Delivery Fee Schedule (Range-Based Lookup)
-- ============================================================================
-- Distance Range        | Base Fare | Additional | Total Fee
-- ---------------------|-----------|------------|----------
-- 0 – 1,000 m          | ₱30       | ₱0         | ₱30
-- 1,001 – 1,500 m      | ₱30       | ₱5         | ₱35
-- 1,501 – 2,000 m      | ₱30       | ₱10        | ₱40
-- 2,001 – 2,500 m      | ₱30       | ₱15        | ₱45
-- 2,501 – 3,000 m      | ₱30       | ₱20        | ₱50
-- 3,001 – 3,500 m      | ₱30       | ₱24        | ₱54
-- 3,501 – 4,000 m      | ₱30       | ₱28        | ₱58
-- 4,001 – 4,500 m      | ₱30       | ₱32        | ₱62
-- 4,501 – 5,000 m      | ₱30       | ₱36        | ₱66
-- 5,001 – 5,500 m      | ₱30       | ₱40        | ₱70
-- 5,501 – 6,000 m      | ₱30       | ₱44        | ₱74
-- 6,001 – 6,500 m      | ₱30       | ₱47        | ₱77
-- 6,501 – 7,000 m      | ₱30       | ₱50        | ₱80
-- 7,001 – 7,500 m      | ₱30       | ₱53        | ₱83
-- 7,501 – 8,000 m      | ₱30       | ₱56        | ₱86
-- 8,001 – 8,500 m      | ₱30       | ₱59        | ₱89
-- 8,501 – 9,000 m      | ₱30       | ₱62        | ₱92
-- 9,001 – 9,500 m      | ₱30       | ₱65        | ₱95
-- 9,501 – 10,000 m     | ₱30       | ₱68        | ₱98
-- > 10,000 m           | ₱30       | ₱68        | ₱98 (capped)
-- ============================================================================
