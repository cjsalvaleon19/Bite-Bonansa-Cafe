# Build Error Fix - Cashier POS Page

## Problem
The Next.js build was failing with the following error:
```
> Build error occurred
[Error: Failed to collect page data for /cashier/pos] { type: 'Error' }
Error: Command "npm run build" exited with 1
```

Root cause: `ReferenceError: window is not defined`

## Root Cause Analysis
The `OpenStreetMapPicker` component uses `react-leaflet`, which depends on the Leaflet library. Leaflet requires browser-specific APIs (like `window`) that are not available during Next.js server-side rendering (SSR).

When the POS page imported `OpenStreetMapPicker` directly:
```javascript
import OpenStreetMapPicker from '../../components/OpenStreetMapPicker';
```

Next.js attempted to render the component on the server during the build process, causing the build to fail.

## Solution
Changed the import to use Next.js dynamic import with `ssr: false`:

```javascript
import dynamic from 'next/dynamic';

const OpenStreetMapPicker = dynamic(
  () => import('../../components/OpenStreetMapPicker'),
  { ssr: false }
);
```

This tells Next.js to:
1. Skip rendering this component during server-side rendering
2. Only load and render it on the client-side (in the browser)

## Additional Fixes
Also corrected the component props to match the actual interface:

**Before:**
```javascript
<OpenStreetMapPicker
  onLocationSelect={(lat, lng, address) => {...}}
  initialPosition={deliveryCoordinates}
/>
```

**After:**
```javascript
<OpenStreetMapPicker
  initialLat={deliveryCoordinates?.lat}
  initialLng={deliveryCoordinates?.lng}
  onLocationChange={(lat, lng, address) => {...}}
/>
```

## Verification
Build now completes successfully:
```
✓ Compiled successfully in 4.4s
✓ Generating static pages (36/36)
Route (pages)                                Size  First Load JS
├ ○ /cashier/pos                          12.1 kB         156 kB
```

## Best Practices for Future Development

### When to Use Dynamic Imports
Use dynamic imports with `ssr: false` for components that:
1. Use browser-only APIs (window, document, navigator, etc.)
2. Depend on libraries that require the DOM
3. Use third-party map libraries (Leaflet, Mapbox, Google Maps)
4. Use canvas or WebGL
5. Access localStorage or sessionStorage

### Example Pattern
```javascript
import dynamic from 'next/dynamic';

const BrowserOnlyComponent = dynamic(
  () => import('./BrowserOnlyComponent'),
  { 
    ssr: false,
    loading: () => <p>Loading map...</p> // Optional loading state
  }
);
```

## Files Modified
- `pages/cashier/pos.js` - Changed import to dynamic and fixed props

## Related Components
- `components/OpenStreetMapPicker.js` - Uses react-leaflet (requires browser)
- `utils/deliveryCalculator.js` - Works fine with SSR (pure functions)

## Testing Checklist
- [x] Build completes without errors
- [x] POS page loads in browser
- [ ] Map picker functionality works correctly (runtime test needed)
- [ ] Delivery fee calculation based on coordinates works (runtime test needed)

## Notes
The OpenStreetMapPicker component itself already has defensive checks:
```javascript
if (typeof window === 'undefined') return null;
```

However, the import itself needs to be dynamic to prevent the entire module from being evaluated during SSR.
