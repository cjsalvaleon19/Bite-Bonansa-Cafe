# Cashier POS - Delivery Fee Integration with OpenStreetMap

## Overview

The Cashier POS system now includes automatic delivery fee calculation using OpenStreetMap + Nominatim for address selection and distance-based pricing. This replaces the previous fixed delivery fee of ₱30 with a dynamic, distance-based calculation.

## Features Implemented

### 1. Interactive Map for Address Selection
- **OpenStreetMap Integration**: Uses OpenStreetMap tiles instead of Google Maps (no API key required)
- **Nominatim Geocoding**: Free address search and reverse geocoding
- **Interactive Marker**: Customers can click or drag the map marker to precise locations
- **Address Search**: Type-ahead search for Philippine addresses
- **Real-time Updates**: Address and coordinates update automatically

### 2. Dynamic Delivery Fee Calculation
- **Distance-Based Pricing**: Automatically calculates distance from store to delivery address
- **Tiered Pricing**: Uses established fee structure (₱30 base + incremental increases)
- **Live Updates**: Delivery fee updates immediately when address changes
- **Visual Feedback**: Shows distance and calculated fee below the map

### 3. Coordinate Storage
- **Latitude & Longitude**: Stored with each delivery order
- **Future Use**: Enables delivery route optimization, rider assignment, and analytics

## How It Works

### User Flow (Cashier Side)

1. **Select Delivery Mode**: Choose "Delivery" from order mode options
2. **Search or Pin Location**:
   - Type an address in the search box
   - Click a search result, OR
   - Click anywhere on the map, OR
   - Drag the marker to the exact location
3. **Auto-Calculate Fee**: System automatically:
   - Calculates distance from store
   - Applies tiered pricing
   - Updates delivery fee
   - Displays distance and fee
4. **Complete Order**: Proceed with checkout as normal

### Technical Flow

```javascript
// 1. User selects location on map
handleLocationChange(lat, lng, address)
  ↓
// 2. Update coordinates in state
setDeliveryCoordinates({ latitude, longitude })
  ↓
// 3. useEffect triggers on coordinates change
getDistanceBetweenCoordinates(store, delivery)
  ↓
// 4. Calculate fee from distance
calculateDeliveryFee(distance)
  ↓
// 5. Update UI and total
setDeliveryFee(fee)
```

## Fee Structure

The system uses the same tiered pricing as defined in `utils/deliveryCalculator.js`:

| Distance Range | Delivery Fee |
|---------------|--------------|
| 0 – 1,000 m | ₱30 |
| 1,001 – 1,500 m | ₱35 |
| 1,501 – 2,000 m | ₱40 |
| 2,001 – 2,500 m | ₱45 |
| 2,501 – 3,000 m | ₱50 |
| 3,001 – 3,500 m | ₱54 |
| ... | ... |
| 10,000+ m | ₱98 (capped) |

See `DELIVERY_FEE_IMPLEMENTATION.md` for complete fee table.

## Data Stored in Orders

When a delivery order is placed, the following fields are saved:

```javascript
{
  order_mode: 'delivery',
  delivery_address: "Full text address",
  delivery_latitude: 6.220000,      // NEW
  delivery_longitude: 124.825000,   // NEW
  delivery_fee: 65.00,              // Calculated dynamically
  // ... other order fields
}
```

## Code Changes

### Files Modified

1. **`pages/cashier/pos.js`**
   - Added OpenStreetMapPicker component import
   - Added delivery calculator utility imports
   - Added state for delivery coordinates
   - Added state for address search query
   - Added state for calculated distance
   - Added `handleLocationChange` function
   - Updated `useEffect` for delivery fee calculation
   - Updated order data to include coordinates
   - Updated UI with map component
   - Added Leaflet CSS to Head

### New State Variables

```javascript
const [deliveryCoordinates, setDeliveryCoordinates] = useState({
  latitude: null,
  longitude: null,
});
const [deliveryDistance, setDeliveryDistance] = useState(null);
const [addressSearchQuery, setAddressSearchQuery] = useState('');
```

### New Imports

```javascript
import OpenStreetMapPicker from '../../components/OpenStreetMapPicker';
import { 
  calculateDeliveryFee, 
  getDistanceBetweenCoordinates, 
  STORE_LOCATION, 
  formatDistance 
} from '../../utils/deliveryCalculator';
```

## UI Components

### Map Display
When delivery mode is selected, the POS shows:
- **Map Component**: Interactive 400px height map
- **Search Box**: Address search with autocomplete
- **Marker**: Draggable pin for precise location
- **Info Box**: Shows coordinates, distance, and calculated fee

### Information Display
Below the map, a summary shows:
```
📍 Coordinates: 6.220000, 124.825000
📏 Distance from store: 2.5 km
💵 Delivery Fee: ₱65.00
```

## Benefits

### 1. Accuracy
- Precise GPS coordinates eliminate address ambiguity
- Distance calculated using Haversine formula
- Consistent fee calculation every time

### 2. Transparency
- Customer can see exact distance
- Fee is automatically calculated
- No manual entry errors

### 3. Future-Ready
- Coordinates enable delivery route optimization
- Can integrate with rider tracking
- Enables delivery analytics and reporting

### 4. Cost Savings
- No Google Maps API fees
- OpenStreetMap is free and open-source
- Nominatim geocoding is free

## Testing Checklist

- [x] Map loads correctly in delivery mode
- [x] Search finds Philippine addresses
- [x] Clicking map updates coordinates
- [x] Dragging marker updates coordinates
- [x] Distance calculates correctly
- [x] Delivery fee updates automatically
- [x] Coordinates saved in order data
- [x] Form clears after checkout
- [x] Works with all payment methods
- [ ] Manual testing by cashier

## Known Limitations

1. **Internet Required**: Map requires active internet connection
2. **Philippines Only**: Search restricted to Philippine addresses (by design)
3. **Default Fee Fallback**: If no coordinates selected, uses ₱30 default
4. **As-the-Crow-Flies**: Distance is straight-line, not road distance

## Future Enhancements

1. **Route Optimization**: Use actual road distance instead of straight-line
2. **Delivery Zones**: Define service areas and restrict out-of-zone orders
3. **Batch Routing**: Optimize multi-delivery routes for riders
4. **ETA Calculation**: Estimate delivery time based on distance
5. **Historical Data**: Show delivery heatmap for popular areas
6. **Custom Store Icon**: Replace default marker with cafe logo

## Troubleshooting

### Map Not Loading
**Symptom**: Blank space where map should be  
**Solution**: 
- Check internet connection
- Verify Leaflet CSS is loaded
- Check browser console for errors

### Search Not Working
**Symptom**: No results when typing address  
**Solution**:
- Ensure query is at least 3 characters
- Check internet connection to Nominatim
- Try clicking directly on map instead

### Wrong Delivery Fee
**Symptom**: Fee doesn't match distance  
**Solution**:
- Verify coordinates are correct
- Check fee calculation in deliveryCalculator.js
- Ensure delivery mode is selected

### Coordinates Not Saving
**Symptom**: Order has null coordinates  
**Solution**:
- Ensure location is selected on map before checkout
- Verify deliveryCoordinates state is populated
- Check database schema has latitude/longitude columns

## Related Documentation

- `OPENSTREETMAP_IMPLEMENTATION.md` - OpenStreetMap integration guide
- `DELIVERY_FEE_IMPLEMENTATION.md` - Delivery fee calculation details
- `utils/deliveryCalculator.js` - Fee calculation logic
- `components/OpenStreetMapPicker.js` - Map component code

## Support

For issues or questions:
1. Check browser console for errors
2. Verify internet connection
3. Review this documentation
4. Check related files for implementation details

---

**Status**: ✅ Complete and Ready for Testing  
**Last Updated**: 2026-04-28  
**Version**: 1.0
