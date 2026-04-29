# Customer Order Portal - Build Conflict Resolution

## Issue
Build was failing with routing conflict error:
```
⨯ Conflicting app and page file was found, please remove the conflicting files to continue:
 ⨯   "pages/customer/order.js" - "app/customer/order/page.tsx"
Error: Command "npm run build" exited with 1
```

## Root Cause
The repository uses **both** Next.js routing systems:
- **Pages Router** (`pages/` directory) - JavaScript files
- **App Router** (`app/` directory) - TypeScript files (PRIMARY)

A new `pages/customer/order.js` file was created, but `app/customer/order/page.tsx` already existed, causing a route conflict.

## Resolution
✅ **Deleted** `pages/customer/order.js` (the conflicting file)  
✅ **Kept** `app/customer/order/page.tsx` (the comprehensive implementation)

## Why App Router Version is Superior

The existing `app/customer/order/page.tsx` already has **all requested features**:

### ✅ Subvariant Selection
- Modal dialog for items with variants
- Variety, size, and add-on selection
- Price modifiers calculated in real-time
- Smart filtering (e.g., Hot drinks only available in 12oz)
- Only shows available variant options

### ✅ Cashier's Color Scheme Applied
Defined in `styles/globals.css`:
```css
--primary: 45 100% 51%;     /* #ffc107 - Yellow/Gold */
--background: 0 0% 6%;      /* #0f0f0f - Dark black */
--card: 0 0% 10%;           /* #1a1a1a - Card background */
```

The theme perfectly matches the cashier POS interface as shown in the reference image.

### ✅ Filters Deleted/Unavailable Items
```typescript
.eq('available', true)
.eq('is_deleted', false)
```

### ✅ Additional Features
Beyond the requirements, the App Router version includes:
- TypeScript for type safety
- shadcn/ui components for polished UI
- GCash payment with proof upload
- GPS-based delivery location picker
- Loyalty points integration
- Persistent cart (localStorage)
- Auto-add items from dashboard via URL parameters

## Verification Checklist

- [x] Build succeeds without routing conflicts
- [x] Menu items display with variant information
- [x] Subvariant selection modal works correctly
- [x] Deleted/unavailable items are filtered out
- [x] Color scheme matches cashier POS (#ffc107)
- [x] Typography matches (Poppins + Playfair Display)
- [x] Shopping cart handles variants correctly
- [x] Checkout creates orders with status 'pending'

## File Locations

- ✅ **Order Portal**: `app/customer/order/page.tsx`
- ✅ **Theme Config**: `styles/globals.css`
- ✅ **Layout**: `app/customer/layout.tsx`
- ❌ **Deleted**: `pages/customer/order.js` (conflicting file removed)

## Outcome

✅ **All requirements met** without writing new code  
✅ **Build conflict resolved**  
✅ **Ready to merge**

The existing App Router implementation already provides everything requested in the task:
1. Menu items with subvariant selection ✅
2. Cashier's color scheme applied ✅  
3. Deleted items excluded ✅
4. Customer can select variants before adding to cart ✅
