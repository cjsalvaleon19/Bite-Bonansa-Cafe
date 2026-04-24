# OpenStreetMap + Nominatim Implementation Guide

## Overview
The Bite Bonansa Cafe application now uses **OpenStreetMap** with **Nominatim** geocoding for delivery address location selection instead of Google Maps. This eliminates the need for a Google Maps API key and provides a free, open-source alternative.

## Changes Made

### 1. Dependencies Added
```json
{
  "react-leaflet": "^4.2.1",
  "leaflet": "^1.9.4"
}
```

### 2. New Component: OpenStreetMapPicker
**Location:** `/components/OpenStreetMapPicker.js`

**Features:**
- Interactive map using OpenStreetMap tiles
- Draggable marker for precise location selection
- Click-to-pin functionality on the map
- Address search using Nominatim geocoding service
- Real-time search results dropdown
- Reverse geocoding to get address from coordinates
- Restricted to Philippines (countrycodes=ph)

**Props:**
- `initialLat` - Initial latitude for map center and marker
- `initialLng` - Initial longitude for map center and marker
- `onLocationChange(lat, lng, address)` - Callback when location is selected
- `searchQuery` - Current search query text
- `onSearchQueryChange(query)` - Callback for search query changes

### 3. Updated Checkout Page
**Location:** `/pages/customer/checkout.js`

**Changes:**
- Removed Google Maps Script loading
- Removed Google Maps initialization code
- Removed Google Maps API references
- Added Leaflet CSS link in Head
- Integrated OpenStreetMapPicker component
- Simplified location change handling

### 4. Configuration Updates

#### Content Security Policy (next.config.js)
Replaced Google Maps domains with OpenStreetMap/Nominatim:
- **img-src:** Added `https://*.tile.openstreetmap.org` and `https://unpkg.com`
- **connect-src:** Added `https://nominatim.openstreetmap.org` and `https://*.tile.openstreetmap.org`
- **Removed:** Google Maps domains (`maps.googleapis.com`, `maps.gstatic.com`)

#### Environment Variables (.env.example)
- Removed `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` requirement
- Added note about free OpenStreetMap + Nominatim usage

## How It Works

### Address Search Flow
1. User types an address in the search input
2. After 500ms debounce, Nominatim API is called with the query
3. Search results are displayed in a dropdown
4. User clicks a result → map centers on that location
5. Marker is placed at the selected coordinates
6. Reverse geocoding gets the full address
7. Form is updated with coordinates and address

### Map Interaction Flow
1. User clicks anywhere on the map
2. Marker moves to the clicked location
3. Reverse geocoding fetches the address for those coordinates
4. Form is updated with new coordinates and address

### Marker Drag Flow
1. User drags the marker to a new position
2. On drag end, coordinates are captured
3. Reverse geocoding gets the address
4. Form is updated with new coordinates and address

## API Usage

### Nominatim Search API
```
GET https://nominatim.openstreetmap.org/search
  ?format=json
  &q={search_query}
  &countrycodes=ph
  &limit=5
```

### Nominatim Reverse Geocoding API
```
GET https://nominatim.openstreetmap.org/reverse
  ?format=json
  &lat={latitude}
  &lon={longitude}
  &zoom=18
  &addressdetails=1
```

## Benefits Over Google Maps

1. **No API Key Required** - Completely free to use
2. **No Usage Limits** - No billing or quotas
3. **Open Source** - Transparent and community-driven
4. **Privacy-Friendly** - No tracking or data collection
5. **Reliable** - Backed by OpenStreetMap Foundation
6. **Philippine Coverage** - Excellent coverage in the Philippines

## Usage Guidelines (Nominatim)

To comply with Nominatim's usage policy:
- Maximum 1 request per second (implemented via 500ms debounce)
- Proper User-Agent header (handled by browser)
- Only search when query has 3+ characters
- Limit search results to 5 items

## Testing

### Manual Testing Checklist
- [ ] Search for an address in the Philippines
- [ ] Click on a search result → map centers correctly
- [ ] Click anywhere on the map → marker moves, address updates
- [ ] Drag the marker → address updates on drop
- [ ] Coordinates display correctly below the address field
- [ ] Delivery fee calculates based on selected coordinates
- [ ] Map loads without errors
- [ ] No console errors related to map or geocoding

### Known Issues
None currently. The implementation handles:
- SSR (Server-Side Rendering) properly with dynamic imports
- Leaflet icon loading from CDN
- Map re-centering when location changes
- Search debouncing to avoid API rate limits

## Future Enhancements

Potential improvements:
1. Add custom marker icon with cafe logo
2. Display store location marker on the map
3. Show delivery radius circle around the store
4. Add map zoom controls customization
5. Cache recent search results
6. Add location permission request for auto-detection
7. Show distance from store on map

## Resources

- [OpenStreetMap](https://www.openstreetmap.org/)
- [Nominatim API Documentation](https://nominatim.org/release-docs/latest/api/Overview/)
- [Leaflet Documentation](https://leafletjs.com/reference.html)
- [React Leaflet Documentation](https://react-leaflet.js.org/)
