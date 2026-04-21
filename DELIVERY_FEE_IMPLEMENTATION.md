# Delivery Fee Calculator - Implementation Summary

## Overview

This system now includes both JavaScript and SQL implementations for calculating delivery fees, ensuring consistency across client-side and server-side operations.

## Quick Reference

### Store Location
```
Bite Bonansa Cafe
Laconon-Salacafe Rd, Brgy. Poblacion, T'boli, South Cotabato
Coordinates: 6.2178483, 124.8221226
```

### Fee Structure
- **Base Fare:** ₱30 (constant for all distances)
- **Additional Fee:** Range-based lookup (₱0-68 depending on distance)
- **Total Delivery Fee:** Base Fare + Additional Fee

## Files

| File | Purpose |
|------|---------|
| `database_schema_updates.sql` | SQL function definitions (section 11) |
| `delivery_fee_calculator_test.sql` | SQL test queries and examples |
| `DELIVERY_FEE_CALCULATOR_SQL.md` | Complete SQL usage documentation |
| `utils/deliveryCalculator.js` | JavaScript implementation |

## Implementation

### SQL Functions (Database)

```sql
-- Calculate distance in meters
SELECT calculate_distance_meters(
  6.2178483, 124.8221226,  -- Store
  6.2200000, 124.8250000   -- Customer
) AS distance;

-- Calculate delivery fee
SELECT calculate_delivery_fee(1500) AS fee;  -- Returns: 35.00

-- Calculate fee from store location
SELECT calculate_delivery_fee_from_store(
  6.2200000,  -- Customer latitude
  124.8250000 -- Customer longitude
) AS fee;
```

### JavaScript (Client-side)

```javascript
import { 
  calculateDeliveryFee, 
  getDistanceBetweenCoordinates, 
  STORE_LOCATION 
} from '@/utils/deliveryCalculator';

// Calculate distance
const distance = getDistanceBetweenCoordinates(
  STORE_LOCATION.latitude,
  STORE_LOCATION.longitude,
  customerLat,
  customerLon
);

// Calculate fee
const fee = calculateDeliveryFee(distance);
```

## Deployment Steps

### 1. Deploy SQL Functions

1. Open Supabase Dashboard → SQL Editor
2. Copy section 11 from `database_schema_updates.sql`:
   - Lines 293-376 (delivery fee calculator functions)
3. Click "Run" to create the functions

### 2. Test Functions

Run queries from `delivery_fee_calculator_test.sql` to verify:

```sql
-- Quick test
SELECT 
  calculate_delivery_fee(500) AS test_500m,      -- Should be ₱30
  calculate_delivery_fee(1500) AS test_1_5km,    -- Should be ₱35
  calculate_delivery_fee(2000) AS test_2km;      -- Should be ₱40
```

### 3. Verify JavaScript Still Works

The JavaScript implementation remains unchanged and continues to work:

```bash
npm run build
```

## Use Cases

### 1. Auto-calculate fees on insert

```sql
INSERT INTO orders (
  delivery_latitude,
  delivery_longitude,
  delivery_fee
)
VALUES (
  6.2250000,
  124.8300000,
  calculate_delivery_fee_from_store(6.2250000, 124.8300000)
);
```

### 2. Bulk update existing orders

```sql
UPDATE orders
SET delivery_fee = calculate_delivery_fee_from_store(
  delivery_latitude,
  delivery_longitude
)
WHERE delivery_latitude IS NOT NULL
  AND delivery_longitude IS NOT NULL
  AND order_mode = 'delivery';
```

### 3. Create database trigger

```sql
CREATE OR REPLACE FUNCTION auto_calculate_delivery_fee()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.delivery_latitude IS NOT NULL 
     AND NEW.delivery_longitude IS NOT NULL THEN
    NEW.delivery_fee := calculate_delivery_fee_from_store(
      NEW.delivery_latitude,
      NEW.delivery_longitude
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_delivery_fee
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_delivery_fee();
```

### 4. Generate delivery fee reports

```sql
SELECT 
  DATE(created_at) AS order_date,
  COUNT(*) AS total_deliveries,
  AVG(delivery_fee) AS avg_fee,
  MIN(delivery_fee) AS min_fee,
  MAX(delivery_fee) AS max_fee,
  SUM(delivery_fee) AS total_fees
FROM orders
WHERE order_mode = 'delivery'
  AND delivery_latitude IS NOT NULL
GROUP BY DATE(created_at)
ORDER BY order_date DESC;
```

## Testing

### Expected Results

| Distance (m) | Fee (₱) | Calculation |
|-------------|--------|-------------|
| 500 | 30 | Base fare only |
| 1000 | 30 | Base fare only |
| 1500 | 35 | 30 + 5 (1001-1500m) |
| 2000 | 40 | 30 + 10 (1501-2000m) |
| 3000 | 50 | 30 + 20 (2501-3000m) |
| 5000 | 66 | 30 + 36 (4501-5000m) |
| 10000 | 98 | 30 + 68 (9501-10000m) |

### Full Fee Schedule

| Distance Range | Base Fare | Additional | Total Fee |
|----------------|-----------|------------|-----------|
| 0 – 1,000 m | ₱30 | ₱0 | ₱30 |
| 1,001 – 1,500 m | ₱30 | ₱5 | ₱35 |
| 1,501 – 2,000 m | ₱30 | ₱10 | ₱40 |
| 2,001 – 2,500 m | ₱30 | ₱15 | ₱45 |
| 2,501 – 3,000 m | ₱30 | ₱20 | ₱50 |
| 3,001 – 3,500 m | ₱30 | ₱24 | ₱54 |
| 3,501 – 4,000 m | ₱30 | ₱28 | ₱58 |
| 4,001 – 4,500 m | ₱30 | ₱32 | ₱62 |
| 4,501 – 5,000 m | ₱30 | ₱36 | ₱66 |
| 5,001 – 5,500 m | ₱30 | ₱40 | ₱70 |
| 5,501 – 6,000 m | ₱30 | ₱44 | ₱74 |
| 6,001 – 6,500 m | ₱30 | ₱47 | ₱77 |
| 6,501 – 7,000 m | ₱30 | ₱50 | ₱80 |
| 7,001 – 7,500 m | ₱30 | ₱53 | ₱83 |
| 7,501 – 8,000 m | ₱30 | ₱56 | ₱86 |
| 8,001 – 8,500 m | ₱30 | ₱59 | ₱89 |
| 8,501 – 9,000 m | ₱30 | ₱62 | ₱92 |
| 9,001 – 9,500 m | ₱30 | ₱65 | ₱95 |
| 9,501 – 10,000 m | ₱30 | ₱68 | ₱98 |
| > 10,000 m | ₱30 | ₱68 | ₱98 (capped) |

### Verify Consistency

Both implementations should produce identical results:

```javascript
// JavaScript test
console.log(calculateDeliveryFee(1500)); // 35

// SQL test
SELECT calculate_delivery_fee(1500); -- 35.00
```

## Troubleshooting

**Problem:** Function not found in Supabase
- **Solution:** Ensure you've run the SQL from `database_schema_updates.sql` section 11

**Problem:** Different results between JS and SQL
- **Solution:** Both use the same range-based lookup. Check for:
  - Latitude/longitude order (must be lat, lon)
  - Null values
  - Decimal precision

**Problem:** Unexpected fee amounts
- **Solution:** Verify:
  - Distance calculation is working (test `calculate_distance_meters`)
  - Coordinates are correct (lat: ~6.21, lon: ~124.82 for T'boli area)
  - Fee Structure: Base ₱30 + range-based additional fee (₱0-68)

## Benefits

1. ✅ **Consistency:** Same calculation logic in database and application
2. ✅ **Performance:** Can calculate fees server-side for bulk operations
3. ✅ **Data Integrity:** Can use triggers to auto-calculate fees
4. ✅ **Reporting:** Can generate fee reports purely in SQL
5. ✅ **Migration:** Can update historical data with correct fees

## Next Steps

1. ✅ Deploy SQL functions to Supabase
2. ✅ Test with sample data
3. ⏳ Optional: Add database trigger for auto-calculation
4. ⏳ Optional: Update historical delivery fees
5. ⏳ Optional: Create views for delivery fee analytics

---

**Last Updated:** 2026-04-21
**Status:** ✅ Complete and Ready for Deployment
