# Technical Notes - Delivery Fee Calculation

## Dual Calculation Strategy (Client + Server)

### Why Two Implementations?

The delivery fee calculation is intentionally implemented in two places:

1. **Client-Side** (`pages/customer/checkout.js` - `calculateDeliveryFee()`)
   - **Purpose:** Real-time UI feedback
   - **Benefit:** Instant updates as user selects location
   - **Implementation:** JavaScript with Haversine formula
   - **Used for:** Display only

2. **Server-Side** (`database_complete_schema.sql` - `calculate_delivery_fee()`)
   - **Purpose:** Authoritative calculation
   - **Benefit:** Cannot be tampered with by client
   - **Implementation:** PostgreSQL/PL/pgSQL
   - **Used for:** Actual order submission

### Benefits of This Approach:

1. **User Experience:** Users see delivery fee update instantly as they drag the marker or select a location
2. **Security:** Final fee is calculated server-side and cannot be manipulated
3. **Accuracy:** Server-side calculation is the source of truth
4. **Performance:** No need for API call on every map interaction

### Maintaining Consistency:

Both implementations use identical fee tiers:
- Base fee: ₱30.00
- Distance tiers: 0-1000m, 1001-1500m, ..., 9501-10000m
- Additional fees: ₱0 to ₱68 (capped)

**Important:** When updating fee structure, update BOTH:
1. Client: `calculateDeliveryFee()` in `pages/customer/checkout.js`
2. Server: `calculate_delivery_fee()` in `database_complete_schema.sql`

### Error Handling:

If server-side calculation fails during order submission:
- Falls back to `BASE_DELIVERY_FEE` (₱30.00)
- Error is logged to console
- User sees error message: "Failed to calculate delivery fee"
- Order submission is blocked until location is valid

This ensures:
- User is aware of the issue
- Order is not submitted with incorrect fee
- Default base fee prevents complete failure

### Code Review Considerations:

**Comment:** "Duplication creates maintenance burden"
**Response:** This is intentional design for UX. The benefit of instant feedback outweighs the maintenance cost. Fee structure changes are infrequent.

**Comment:** "Fallback masks error"
**Response:** Error is not masked - it's caught, logged, and displayed to user. Order submission requires valid coordinates, so fallback only applies to display.

## Alternative Approaches Considered:

### Option 1: Server-Only Calculation
- ❌ Requires API call on every map interaction
- ❌ Poor UX (delay before fee updates)
- ❌ Higher server load
- ✅ Single source of truth

### Option 2: Client-Only Calculation
- ❌ Can be tampered with
- ❌ Security risk
- ✅ Fast and responsive
- ❌ Not authoritative

### Option 3: Current Approach (Client + Server) ✅
- ✅ Fast and responsive UX
- ✅ Secure and authoritative
- ✅ Best of both worlds
- ⚠️ Requires maintaining consistency (acceptable trade-off)

## Implementation Details:

### Client-Side Calculation:
```javascript
// Haversine formula for distance
const R = 6371; // Earth's radius in km
const dLat = (lat2 - lat1) * Math.PI / 180;
const dLng = (lng2 - lng1) * Math.PI / 180;
const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLng/2) * Math.sin(dLng/2);
const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
const distance = R * c * 1000; // meters

// Apply fee tiers
if (distance <= 1000) return 30.00;
else if (distance <= 1500) return 35.00;
// ... etc
```

### Server-Side Calculation:
```sql
-- Haversine formula in PL/pgSQL
dLat := RADIANS(lat2 - lat1);
dLon := RADIANS(lon2 - lon1);
a := SIN(dLat / 2) * SIN(dLat / 2) + 
     COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * 
     SIN(dLon / 2) * SIN(dLon / 2);
c := 2 * ATAN2(SQRT(a), SQRT(1 - a));
distance_km := R * c;

-- Apply fee tiers
IF distance_meters <= 1000 THEN
  RETURN 30.00;
ELSIF distance_meters <= 1500 THEN
  RETURN 35.00;
-- ... etc
```

### Order Submission Flow:
1. User selects location on map
2. Client calculates fee instantly (for display)
3. User clicks "Place Order"
4. Server calculates fee via RPC: `calculate_delivery_fee_from_store(lat, lng)`
5. Server fee is used in order record
6. If server calculation fails, order is blocked with error message

## Testing:

### Test Case 1: Client-Server Consistency
```javascript
// Test that both give same result
const testLat = 6.2188483;
const testLng = 124.8231226;

// Client calculation
const clientFee = calculateDeliveryFee(); // when coords are set

// Server calculation
const { data: serverFee } = await supabase.rpc(
  'calculate_delivery_fee_from_store',
  { customer_latitude: testLat, customer_longitude: testLng }
);

// Should match
console.assert(clientFee === serverFee, 'Fee mismatch!');
```

### Test Case 2: Error Handling
```javascript
// Test with invalid coordinates
const { data, error } = await supabase.rpc(
  'calculate_delivery_fee_from_store',
  { customer_latitude: null, customer_longitude: null }
);

// Should handle error gracefully
console.assert(error !== null, 'Should return error for invalid coords');
```

## Future Improvements:

1. **Configuration-Based Tiers:** Store fee tiers in database table instead of hardcoded
   - Benefit: Can update fees without code changes
   - Drawback: Adds complexity

2. **API Endpoint for Client Calculation:** Create `/api/calculate-delivery-fee` endpoint
   - Benefit: Single source of truth
   - Drawback: Requires API call (slower UX)

3. **Caching:** Cache calculated fees based on rounded coordinates
   - Benefit: Faster for repeated locations
   - Drawback: Adds complexity

For now, the dual implementation provides the best balance of UX, security, and simplicity.
