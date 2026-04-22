# Google Maps Integration Guide

This guide explains how to set up and use Google Maps integration for delivery address selection in the Bite Bonansa Cafe application.

## Overview

The application now includes an interactive Google Maps location picker that allows customers to:
- Search for their delivery address
- Pin their exact location on the map
- Use their current location (GPS)
- Get automatic delivery fee calculation based on distance from the store

## Features

### LocationPicker Component

The `LocationPicker` component provides:

1. **Address Search**
   - Google Places autocomplete
   - Restricted to Philippines addresses
   - Real-time suggestions as you type

2. **Interactive Map**
   - Click anywhere to place a marker
   - Drag the marker to adjust location
   - Zoom and pan to explore the area
   - Default center: Bite Bonansa Cafe store location

3. **Current Location**
   - One-click button to use device GPS
   - Automatic marker placement
   - Address reverse geocoding

4. **Delivery Fee Calculation**
   - Automatic calculation using GPS coordinates
   - Uses Supabase function `calculate_delivery_fee_from_store()`
   - Based on Haversine formula for accurate distance
   - Tiered pricing structure (₱30 base + additional fees)

## Setup Instructions

### Step 1: Get Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services > Credentials**
4. Click **Create Credentials > API Key**
5. Copy the API key

### Step 2: Enable Required APIs

Enable these APIs for your project:

1. **Maps JavaScript API**
   - Navigate to **APIs & Services > Library**
   - Search for "Maps JavaScript API"
   - Click **Enable**

2. **Places API**
   - Search for "Places API"
   - Click **Enable**

3. **Geocoding API**
   - Search for "Geocoding API"
   - Click **Enable**

### Step 3: Restrict API Key (Recommended)

For security, restrict your API key:

1. Go to **APIs & Services > Credentials**
2. Click on your API key
3. Under **Application restrictions**:
   - Select "HTTP referrers (web sites)"
   - Add your domain (e.g., `yourdomain.com/*`)
   - For development: `localhost:3000/*`

4. Under **API restrictions**:
   - Select "Restrict key"
   - Choose: Maps JavaScript API, Places API, Geocoding API

### Step 4: Configure Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Add your Google Maps API key to `.env.local`:
   ```env
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here
   ```

3. **Important**: Never commit `.env.local` to version control

### Step 5: Verify Database Functions

Ensure these Supabase functions exist (they're in `database_complete_schema.sql`):

```sql
-- Calculate distance between two GPS coordinates
calculate_distance_meters(lat1, lon1, lat2, lon2)

-- Calculate delivery fee based on distance
calculate_delivery_fee(distance_meters)

-- Calculate delivery fee from store to customer
calculate_delivery_fee_from_store(customer_latitude, customer_longitude)
```

## Usage

### In Checkout Page

The `LocationPicker` is integrated into the checkout page:

```jsx
import LocationPicker from '../../components/LocationPicker';

<LocationPicker
  onLocationSelect={handleLocationSelect}
  initialAddress={formData.deliveryAddress}
  apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
/>
```

### Location Selection Flow

1. **Customer opens checkout page**
   - Map loads with default center at store location
   - Pre-filled address (if available from user profile)

2. **Customer selects location** (3 ways):
   - Search for address using autocomplete
   - Click on the map to place marker
   - Click "Use Current Location" button

3. **Automatic delivery fee calculation**
   - GPS coordinates sent to Supabase
   - Distance calculated using Haversine formula
   - Delivery fee determined from tiered pricing
   - Fee displayed in order summary

4. **Order submission**
   - Delivery address, latitude, and longitude saved
   - Total amount includes calculated delivery fee

### handleLocationSelect Function

```javascript
const handleLocationSelect = async (location) => {
  // Update form data with selected location
  setFormData(prev => ({
    ...prev,
    deliveryAddress: location.address,
    deliveryLatitude: location.latitude,
    deliveryLongitude: location.longitude,
  }));

  // Calculate delivery fee
  const { data, error } = await supabase.rpc('calculate_delivery_fee_from_store', {
    customer_latitude: location.latitude,
    customer_longitude: location.longitude,
  });

  if (!error) {
    setDeliveryFee(parseFloat(data));
  }
};
```

## Delivery Fee Calculation

### Pricing Structure

The delivery fee uses a tiered pricing model:

| Distance Range | Base Fee | Additional Fee | Total Fee |
|---------------|----------|----------------|-----------|
| 0 - 1,000m    | ₱30      | ₱0             | ₱30       |
| 1,001 - 1,500m| ₱30      | ₱5             | ₱35       |
| 1,501 - 2,000m| ₱30      | ₱10            | ₱40       |
| 2,001 - 2,500m| ₱30      | ₱15            | ₱45       |
| ... (continues) | ... | ... | ... |
| 9,501 - 10,000m+ | ₱30   | ₱68 (capped)  | ₱98       |

### Distance Calculation

Uses the Haversine formula for accurate GPS distance:

```sql
-- Example calculation from store to customer
SELECT calculate_delivery_fee_from_store(6.2200000, 124.8300000);
-- Returns delivery fee in PHP
```

Store coordinates:
- Latitude: 6.2178483
- Longitude: 124.8221226

## Component Props

### LocationPicker

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `onLocationSelect` | Function | Yes | Callback when location is selected. Receives `{address, latitude, longitude}` |
| `initialAddress` | String | No | Pre-filled address to display |
| `apiKey` | String | Yes | Google Maps API key |

### Location Object

```typescript
{
  address: string,      // Full formatted address
  latitude: number,     // GPS latitude
  longitude: number,    // GPS longitude
}
```

## Styling

The component uses inline styles that match the app theme:

- Dark background: `#0a0a0a`, `#1a1a1a`, `#2a2a2a`
- Accent color: `#ffc107` (gold)
- Font family: `'Poppins', sans-serif`

To customize styles, modify the `styles` object in `components/LocationPicker.js`.

## Error Handling

The component handles these error cases:

1. **Missing API key**
   - Displays: "Google Maps API key is not configured"
   - Action: Configure API key in `.env.local`

2. **Failed to load map**
   - Displays: "Failed to load Google Maps"
   - Action: Check API key and internet connection

3. **Geolocation error**
   - Displays: "Unable to retrieve your location"
   - Action: Use search or click on map instead

4. **Reverse geocoding error**
   - Displays: "Failed to get address for the selected location"
   - Action: Try searching for address manually

## Testing

### Local Development

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to checkout page:
   ```
   http://localhost:3000/customer/checkout
   ```

3. Test the location picker:
   - Search for an address
   - Click on the map
   - Use current location
   - Verify delivery fee calculation

### Test Locations

Use these test addresses in the Philippines:

1. **Near store** (< 1km):
   - Address: "Iligan City, Philippines"
   - Expected fee: ~₱30

2. **Medium distance** (~2km):
   - Address: "MSU-IIT, Iligan City"
   - Expected fee: ~₱40-₱45

3. **Far distance** (~5km):
   - Address: "Tubod, Iligan City"
   - Expected fee: ~₱60-₱70

## Database Schema

### Orders Table

The orders table includes these GPS-related fields:

```sql
CREATE TABLE orders (
  ...
  delivery_address TEXT,
  delivery_latitude DECIMAL(10,8),
  delivery_longitude DECIMAL(11,8),
  delivery_fee DECIMAL(10,2),
  ...
);
```

## Troubleshooting

### Map not loading

**Symptom**: Map shows gray area or loading spinner forever

**Solutions**:
1. Verify API key is correct in `.env.local`
2. Check that Maps JavaScript API is enabled
3. Check browser console for errors
4. Verify domain restrictions on API key

### "This page can't load Google Maps correctly"

**Symptom**: Map loads but shows error overlay

**Solutions**:
1. Verify billing is enabled on Google Cloud project
2. Check API key restrictions
3. Ensure all required APIs are enabled

### Delivery fee not calculating

**Symptom**: Fee shows "Select location" or error

**Solutions**:
1. Verify Supabase functions exist (`calculate_delivery_fee_from_store`)
2. Check Supabase connection
3. Verify GPS coordinates are valid numbers
4. Check browser console for RPC errors

### Autocomplete not working

**Symptom**: Search box doesn't show suggestions

**Solutions**:
1. Verify Places API is enabled
2. Check API key has Places API access
3. Check country restriction (currently set to Philippines)

## Security Best Practices

1. **Never expose API key in client-side code**
   - Use `NEXT_PUBLIC_` prefix for Next.js environment variables
   - These are exposed to the browser, so use API restrictions

2. **Restrict API key**
   - Add HTTP referrer restrictions
   - Limit to required APIs only
   - Monitor usage in Google Cloud Console

3. **Use HTTPS**
   - Always serve over HTTPS in production
   - Required for geolocation API

4. **Rate limiting**
   - Monitor API usage
   - Set up billing alerts
   - Consider implementing backend proxy for API calls

## Cost Considerations

Google Maps API pricing (as of 2024):

- Maps JavaScript API: $7 per 1,000 loads
- Places API (Autocomplete): $2.83 per 1,000 requests
- Geocoding API: $5 per 1,000 requests

**Free tier**: $200 monthly credit (covers ~28,000 map loads)

**Cost optimization**:
- Use API key restrictions
- Cache geocoding results when possible
- Monitor usage in Google Cloud Console
- Set up billing alerts

## Related Files

- `components/LocationPicker.js` - Main component
- `pages/customer/checkout.js` - Integration example
- `database_complete_schema.sql` - Delivery fee functions
- `.env.example` - Environment variable template

## Support

For issues or questions:
1. Check browser console for error messages
2. Verify API key configuration
3. Review Supabase function logs
4. Check Google Cloud Console for API errors
