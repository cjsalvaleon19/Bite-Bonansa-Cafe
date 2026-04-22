# Fixes Applied Summary

This document summarizes the fixes applied to resolve the customer portal errors and add Google Maps integration.

## Issues Fixed

### 1. Supabase Query Syntax Error (400 Error)

**Problem:** The dashboard was using chained `.not()` calls which caused a 400 error:
```javascript
.not('status', 'eq', 'order_delivered')
.not('status', 'eq', 'cancelled')
```

**Solution:** Changed to proper syntax using `.not()` with `in` operator:
```javascript
.not('status', 'in', '(order_delivered,cancelled)')
```

**File:** `pages/customer/dashboard.js`

---

### 2. Service Worker Cache Error (503 Service Unavailable)

**Problem:** The `/customer/order-portal` route was not included in the service worker's pre-cache list, causing 503 errors when offline or on first load.

**Solution:** Added customer portal routes to the pre-cache list:
```javascript
const PRECACHE_URLS = [
  '/',
  '/login',
  '/dashboard',
  '/customer/dashboard',      // Added
  '/customer/order-portal',   // Added
  '/rider/dashboard',
  '/rider/deliveries',
  '/rider/reports',
  '/rider/profile',
  '/offline',
  '/favicon.svg',
];
```

**File:** `public/service-worker.js`

---

### 3. Google Maps Integration for Delivery Address

**Problem:** The checkout page did not have location selection functionality. Customers had to manually type their address without GPS coordinates.

**Solution:** Implemented Google Maps integration with the following features:

#### Features Added:
1. **Location Search with Autocomplete**
   - Google Places API autocomplete for easy address search
   - Restricted to Philippines (`country: 'ph'`)

2. **Interactive Map**
   - Click anywhere on the map to pin delivery location
   - Draggable marker for precise location adjustment
   - Automatic reverse geocoding to get address from coordinates

3. **Automatic Delivery Fee Calculation**
   - Calculates distance from store to delivery location
   - Uses the Haversine formula for accurate distance calculation
   - Applies tiered pricing (₱30 base + distance-based fees, capped at ₱98)
   - Real-time delivery fee updates as location changes

4. **Coordinate Storage**
   - Stores latitude and longitude with each order
   - Enables accurate delivery fee calculation via Supabase function

#### Files Modified:
- `pages/customer/checkout.js` - Complete Google Maps integration
- `.env.example` - Added `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` variable

#### New Features in Checkout:
- Location search input with autocomplete
- 400px interactive map centered on Bite Bonansa Cafe
- Draggable marker for location selection
- Auto-populated delivery address from coordinates
- Display of selected coordinates (latitude, longitude)
- Real-time delivery fee calculation and display
- Helper text to guide users on how to use the map

---

## Database Schema Verification

### Required Tables (Already Defined in `database_complete_schema.sql`):

1. **loyalty_transactions** - Customer points tracking
   - Columns: id, customer_id, order_id, transaction_type, amount, balance_after, description, created_at
   - RLS policies enabled
   - Trigger: Automatically adds points when order is delivered

2. **customer_item_purchases** - Purchase history tracking
   - Columns: id, customer_id, menu_item_id, purchase_count, last_purchased_at, total_spent
   - RLS policies enabled
   - Trigger: Automatically tracks purchases when order is delivered

3. **customer_reviews** - Customer feedback
   - Columns: id, customer_id, title, review_text, star_rating, image_urls, status, published_at, created_at, updated_at
   - RLS policies enabled
   - Storage bucket integration for review images

### Orders Table Updates (Already in `database_schema_updates.sql`):

The following columns are required for the checkout functionality:
- `delivery_latitude` (DECIMAL(10,8)) - GPS latitude coordinate
- `delivery_longitude` (DECIMAL(11,8)) - GPS longitude coordinate
- `delivery_address` (TEXT) - Full delivery address
- `order_mode` (VARCHAR(50)) - 'delivery', 'dine-in', 'take-out', 'pick-up'
- `contact_number` (VARCHAR(20)) - Customer contact number

### SQL Functions (Already in `database_complete_schema.sql`):

1. **calculate_distance_meters(lat1, lon1, lat2, lon2)**
   - Calculates distance using Haversine formula
   - Returns distance in meters

2. **calculate_delivery_fee(distance_meters)**
   - Calculates delivery fee based on distance
   - ₱30 base fare + tiered additional fees
   - Capped at ₱98 for 10km+

3. **calculate_delivery_fee_from_store(customer_latitude, customer_longitude)**
   - Convenience function that calculates delivery fee from store location
   - Store coordinates: 6.2178483, 124.8221226

---

## Setup Instructions

### 1. Run Database Schema Updates

Execute the following SQL files in your Supabase SQL Editor in this order:

1. **`database_complete_schema.sql`** - Creates missing tables and functions
   - Creates `loyalty_transactions` table
   - Creates `customer_item_purchases` table
   - Creates `customer_reviews` table
   - Creates triggers for automatic tracking
   - Creates delivery fee calculation functions

2. **`database_schema_updates.sql`** - Updates existing tables
   - Adds `delivery_latitude`, `delivery_longitude` to orders table
   - Adds other required columns if not exists

### 2. Configure Google Maps API

1. Go to [Google Cloud Console](https://console.cloud.google.com/google/maps-apis)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Maps JavaScript API
   - Places API
   - Geocoding API
4. Create an API key (Credentials → Create Credentials → API Key)
5. Restrict the API key:
   - Application restrictions: HTTP referrers
   - Add your domain(s): `localhost:3000`, `yourdomain.com`
   - API restrictions: Select the 3 APIs listed above
6. Copy the API key

### 3. Update Environment Variables

Add the Google Maps API key to your `.env.local` file:

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-actual-google-maps-api-key
```

**Note:** Never commit your actual API key to the repository. The `.env.local` file is already in `.gitignore`.

---

## Testing Checklist

- [ ] Verify all three tables exist in Supabase (loyalty_transactions, customer_item_purchases, customer_reviews)
- [ ] Verify SQL functions are created (calculate_distance_meters, calculate_delivery_fee, calculate_delivery_fee_from_store)
- [ ] Test customer dashboard loads without errors
- [ ] Test order portal loads without errors
- [ ] Test Google Maps loads on checkout page
- [ ] Test location search/autocomplete works
- [ ] Test clicking on map updates location
- [ ] Test dragging marker updates location
- [ ] Test delivery fee calculates correctly
- [ ] Test order submission with coordinates
- [ ] Verify orders table has latitude/longitude data after checkout

---

## Error Resolution Summary

### Before Fixes:
- ❌ 400 error on orders query (bad syntax)
- ❌ 404 errors on loyalty_transactions (table not found)
- ❌ 404 errors on customer_item_purchases (table not found)
- ❌ 503 error on /customer/order-portal (not cached)
- ❌ No GPS location selection for delivery
- ❌ Delivery fee not calculated automatically

### After Fixes:
- ✅ Orders query uses correct syntax
- ✅ All required tables defined in schema
- ✅ Customer portal routes cached in service worker
- ✅ Google Maps integration with location search
- ✅ Interactive map with draggable marker
- ✅ Automatic delivery fee calculation
- ✅ Coordinates stored with each order

---

## Notes

1. **Google Maps API Key**: You must add your own Google Maps API key to `.env.local` for the maps to work. The key in `.env.example` is just a placeholder.

2. **Database Schema**: All required tables and functions are defined in the SQL files. You just need to run them in Supabase.

3. **Error Handling**: The dashboard gracefully handles missing tables (PGRST116 error) so the app won't crash if tables aren't created yet, but functionality will be limited.

4. **Service Worker**: After deploying, users may need to hard refresh (Ctrl+Shift+R) to get the updated service worker with the new cache list.

5. **Delivery Fee**: The calculation is done both client-side (for display) and server-side (via Supabase function) to ensure accuracy and prevent tampering.

---

## Additional Resources

- [Google Maps JavaScript API Documentation](https://developers.google.com/maps/documentation/javascript)
- [Supabase PostGIS Documentation](https://supabase.com/docs/guides/database/extensions/postgis)
- [Service Workers MDN Guide](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
