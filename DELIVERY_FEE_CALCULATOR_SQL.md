# Delivery Fee Calculator SQL Functions

This document describes the SQL functions added to Supabase for calculating delivery fees based on GPS coordinates.

## Overview

Three SQL functions have been added to automate delivery fee calculation in the database:

1. `calculate_distance_meters()` - Calculate distance between two GPS coordinates
2. `calculate_delivery_fee()` - Calculate fee based on distance
3. `calculate_delivery_fee_from_store()` - Convenience function using store location

## Store Location

**Bite Bonansa Cafe**
- Address: Laconon-Salacafe Rd, Brgy. Poblacion, T'boli, South Cotabato
- Latitude: `6.2178483`
- Longitude: `124.8221226`

## Fee Structure

| Distance Range | Delivery Fee |
|---------------|--------------|
| 0 – 1,000 m | ₱35 (base fee) |
| 1,001 – 1,200 m | ₱45 |
| 1,201 – 1,400 m | ₱55 |
| 1,401 – 1,600 m | ₱65 |
| 1,601 – 1,800 m | ₱75 |
| 1,801 – 2,000 m | ₱85 |

**Formula:** Base ₱35 + ₱10 per additional 200 meters after 1km

## SQL Functions

### 1. calculate_distance_meters(lat1, lon1, lat2, lon2)

Calculates the distance in meters between two GPS coordinates using the Haversine formula.

**Parameters:**
- `lat1` (DECIMAL): Starting point latitude
- `lon1` (DECIMAL): Starting point longitude
- `lat2` (DECIMAL): Destination latitude
- `lon2` (DECIMAL): Destination longitude

**Returns:** INT (distance in meters)

**Example:**
```sql
SELECT calculate_distance_meters(
  6.2178483,  -- Store latitude
  124.8221226, -- Store longitude
  6.2200000,   -- Customer latitude
  124.8250000  -- Customer longitude
) AS distance;
-- Returns: ~300 (meters)
```

### 2. calculate_delivery_fee(distance_meters)

Calculates the delivery fee based on distance in meters.

**Parameters:**
- `distance_meters` (INT): Distance in meters

**Returns:** DECIMAL (delivery fee in pesos)

**Example:**
```sql
SELECT calculate_delivery_fee(1500) AS fee;
-- Returns: 65.00 (₱35 base + ₱30 for 500m extra)
```

### 3. calculate_delivery_fee_from_store(customer_latitude, customer_longitude)

Convenience function that calculates delivery fee from the store to a customer location.

**Parameters:**
- `customer_latitude` (DECIMAL): Customer's latitude
- `customer_longitude` (DECIMAL): Customer's longitude

**Returns:** DECIMAL (delivery fee in pesos)

**Example:**
```sql
SELECT calculate_delivery_fee_from_store(6.2200000, 124.8250000) AS fee;
-- Returns: 35.00 (within 1km)
```

## Usage in Application

### Updating Delivery Fees in Bulk

Update all deliveries with calculated fees:

```sql
UPDATE deliveries
SET 
  distance_meters = calculate_distance_meters(
    6.2178483, 124.8221226,
    customer_latitude, customer_longitude
  ),
  delivery_fee = calculate_delivery_fee_from_store(
    customer_latitude, customer_longitude
  )
WHERE customer_latitude IS NOT NULL 
  AND customer_longitude IS NOT NULL;
```

### Preview Fees Before Insert

```sql
SELECT 
  'Sample Order' AS order_name,
  6.2250000 AS customer_lat,
  124.8300000 AS customer_lon,
  calculate_distance_meters(
    6.2178483, 124.8221226,
    6.2250000, 124.8300000
  ) AS distance_m,
  calculate_delivery_fee_from_store(
    6.2250000, 124.8300000
  ) AS delivery_fee;
```

### Insert Order with Auto-calculated Fee

```sql
INSERT INTO orders (
  customer_id,
  items,
  delivery_address,
  delivery_latitude,
  delivery_longitude,
  delivery_fee,
  -- ... other fields
)
VALUES (
  'customer-uuid',
  '[{"id": "item1", "quantity": 2}]',
  'Customer Address',
  6.2250000,
  124.8300000,
  calculate_delivery_fee_from_store(6.2250000, 124.8300000),
  -- ... other values
);
```

### Query Orders with Calculated Fees

Compare stored fees with calculated fees:

```sql
SELECT 
  id,
  customer_name,
  delivery_address,
  delivery_latitude,
  delivery_longitude,
  delivery_fee AS stored_fee,
  calculate_delivery_fee_from_store(
    delivery_latitude, delivery_longitude
  ) AS calculated_fee,
  delivery_fee - calculate_delivery_fee_from_store(
    delivery_latitude, delivery_longitude
  ) AS difference
FROM orders
WHERE delivery_latitude IS NOT NULL
  AND delivery_longitude IS NOT NULL
  AND order_mode = 'delivery';
```

## Integration with Code

The JavaScript utility `utils/deliveryCalculator.js` implements the same logic for client-side calculations. Both should produce identical results:

**JavaScript:**
```javascript
import { calculateDeliveryFee, getDistanceBetweenCoordinates, STORE_LOCATION } from '@/utils/deliveryCalculator';

const distance = getDistanceBetweenCoordinates(
  STORE_LOCATION.latitude,
  STORE_LOCATION.longitude,
  customerLat,
  customerLon
);
const fee = calculateDeliveryFee(distance);
```

**SQL:**
```sql
SELECT calculate_delivery_fee_from_store(customer_lat, customer_lon);
```

## Testing

Run the test file to verify functions work correctly:

```bash
# In Supabase SQL Editor, run:
cat delivery_fee_calculator_test.sql
```

Or test individual functions:

```sql
-- Test distance calculation
SELECT calculate_distance_meters(6.2178483, 124.8221226, 6.2200000, 124.8250000);

-- Test fee calculation
SELECT calculate_delivery_fee(500);   -- Should return 35.00
SELECT calculate_delivery_fee(1500);  -- Should return 65.00
SELECT calculate_delivery_fee(2000);  -- Should return 85.00

-- Test convenience function
SELECT calculate_delivery_fee_from_store(6.2200000, 124.8250000);
```

## Deployment

1. Open Supabase Dashboard → SQL Editor
2. Copy the SQL from `database_schema_updates.sql` (section 11)
3. Run the SQL to create the functions
4. Test using `delivery_fee_calculator_test.sql`

## Notes

- Functions are marked as `IMMUTABLE` for better performance (results depend only on inputs)
- Distance calculations use the Haversine formula (accurate for short distances)
- Fee calculations use `CEIL()` to round up partial 200m increments
- All functions handle NULL inputs gracefully

## Troubleshooting

**Issue:** Function not found
- **Solution:** Ensure functions are created in the correct schema (usually `public`)

**Issue:** Incorrect distance calculations
- **Solution:** Verify latitude/longitude order (lat, lon, not lon, lat)

**Issue:** Fee mismatch with JavaScript calculator
- **Solution:** Both use the same formula; check for rounding differences
