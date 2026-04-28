# Online Order & Delivery Management Implementation

## Overview
This document describes the implementation of the online order management and delivery features, including delivery fee computation, order numbering, pending order processing, and rider assignment.

---

## 1. Order Number Format (3-Digit Daily Reset)

### Changes Made
- **Migration**: `supabase/migrations/035_update_order_number_to_3digit.sql`
- **Format**: 3-digit numbers (000-999) that reset daily at midnight
- **Function**: `generate_daily_order_number()` returns VARCHAR(3)
- **Starting Number**: 000 (not 001)

### Key Features
- Thread-safe using PostgreSQL advisory locks
- Automatic reset to 000 at start of each day
- Auto-populated via trigger on INSERT
- Handles race conditions for concurrent orders

### Example Usage
```sql
-- Orders created today will have sequential numbers: 000, 001, 002, etc.
-- Tomorrow they reset: 000, 001, 002, etc.
```

---

## 2. Pending Online Orders Tab (Cashier Dashboard)

### Location
`pages/cashier/dashboard.js`

### Features
- **Tab System**: Toggle between "Today's Stats" and "Pending Online Orders"
- **Count Badge**: Shows number of pending orders on tab
- **Filter**: Shows only online orders (delivery or pick-up) with status 'pending'
- **Real-time Updates**: Subscribes to order changes for live updates

### Order Acceptance Flow
1. Cashier clicks "Accept Order" button
2. System updates order:
   - Status: `pending` → `order_in_process`
   - Sets `accepted_at` timestamp
   - Sets `cashier_id` to current user
3. Generates sales invoice receipt (console log - ready for printer integration)
4. Generates kitchen order slips (console log - ready for kitchen display)
5. Sends notification to customer: "Your order #XXX is now being prepared!"

### UI Components
```jsx
// Tab Navigation
📊 Today's Stats | 📦 Pending Online Orders (5)

// Order Card Display
Order #012
🚚 Delivery / 📦 Pick-up
👤 Customer Name • Contact Number
📍 Delivery Address (if delivery)
[Order Items List]
Total: ₱XXX.XX
[✓ Accept Order]
```

---

## 3. Out for Delivery Feature (Orders Queue)

### Location
`pages/cashier/orders-queue.js`

### Features
- **Conditional Display**: Button only shows for:
  - Orders with `order_mode = 'delivery'`
  - Orders with `status = 'order_in_process'`
- **Rider Selection Modal**: Lists all available riders
- **Automatic Notifications**: Notifies both rider and customer

### Workflow
1. Delivery order appears in queue after acceptance
2. Cashier clicks "🚚 Out for Delivery" button
3. Modal opens showing available riders
4. Cashier selects a rider
5. System updates order:
   - Status: `order_in_process` → `out_for_delivery`
   - Sets `rider_id`
   - Sets `out_for_delivery_at` timestamp
6. Sends notification to rider: "You have been assigned to deliver order #XXX"
7. Sends notification to customer: "Your order #XXX is out for delivery!"

### Rider Modal UI
```
┌─────────────────────────────┐
│ Select Delivery Rider       │
│ Order #012                  │
│                             │
│ ┌─────────────────────────┐ │
│ │ 🏍️ Juan Dela Cruz       │ │
│ │    juan@email.com      →│ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ 🏍️ Maria Santos        │ │
│ │    maria@email.com     →│ │
│ └─────────────────────────┘ │
│                             │
│ [     Cancel     ]          │
└─────────────────────────────┘
```

---

## 4. Dynamic Delivery Fee Calculation (POS)

### Location
`pages/cashier/pos.js`

### Components Used
- **OpenStreetMapPicker**: Dynamically imported with SSR disabled
- **deliveryCalculator**: Utils for distance and fee calculation
- **STORE_LOCATION**: Cafe coordinates (6.2178483, 124.8221226)

### Features
1. **Map Integration**:
   - Interactive map picker for delivery location
   - Drag and drop marker to select coordinates
   - Default center: Store location
   - Only shown when order mode is "delivery"

2. **Dynamic Calculation**:
   - Calculates distance from store to delivery location
   - Uses Haversine formula via `getDistanceBetweenCoordinates()`
   - Applies tiered pricing via `calculateDeliveryFee()`
   - Updates fee in real-time as location changes

3. **Data Storage**:
   - Stores `delivery_latitude` in orders table
   - Stores `delivery_longitude` in orders table
   - Stores calculated `delivery_fee`
   - Address field still required for human-readable reference

### Pricing Tiers
```
0 – 1,000 m      → ₱30
1,001 – 1,500 m  → ₱35
1,501 – 2,000 m  → ₱40
... (progressive tiers)
9,501 – 10,000 m → ₱98 (max)
```

### UI Display
```
┌───────────────────────────────┐
│ Delivery Address *            │
│ ┌───────────────────────────┐ │
│ │ Enter delivery address... │ │
│ └───────────────────────────┘ │
│                               │
│ Pin Delivery Location on Map  │
│ ┌───────────────────────────┐ │
│ │                           │ │
│ │      [MAP VIEW]           │ │
│ │         📍                │ │
│ │                           │ │
│ └───────────────────────────┘ │
│                               │
│ 📍 Selected: 6.217848, 124... │
│ 💰 Delivery Fee: ₱45.00       │
└───────────────────────────────┘
```

---

## 5. Order Status Flow

### Complete Lifecycle
```
[Customer Orders Online]
         ↓
    ┌─────────┐
    │ pending │  ← Online orders from customers
    └─────────┘
         ↓ (Cashier clicks "Accept Order")
    ┌──────────────────┐
    │ order_in_process │  ← Being prepared
    └──────────────────┘
         ↓ (For delivery: Cashier assigns rider)
    ┌──────────────────┐
    │ out_for_delivery │  ← Rider delivering
    └──────────────────┘
         ↓ (Rider marks delivered)
    ┌─────────────┐
    │   delivered │  ← Complete
    └─────────────┘
```

### Status Field Values
- `pending` - Order placed, awaiting acceptance
- `order_in_queue` - POS orders waiting to be prepared
- `order_in_process` - Being prepared by kitchen
- `out_for_delivery` - Assigned to rider, on the way
- `delivered` / `served` - Completed
- `cancelled` - Cancelled by customer or staff

---

## 6. Database Schema Additions

### Orders Table Fields Used
```sql
-- Existing fields enhanced
order_number VARCHAR(3)         -- 3-digit daily number
order_mode VARCHAR(50)          -- 'delivery', 'pick-up', 'dine-in', 'take-out'
status VARCHAR(50)              -- Order lifecycle status
delivery_address TEXT           -- Human-readable address
delivery_latitude DECIMAL(10,8) -- GPS coordinate
delivery_longitude DECIMAL(11,8)-- GPS coordinate
delivery_fee DECIMAL(10,2)      -- Calculated fee

-- Timestamps
created_at TIMESTAMP            -- Order creation
accepted_at TIMESTAMP           -- When cashier accepted
out_for_delivery_at TIMESTAMP  -- When rider assigned

-- Relations
customer_id UUID                -- Who ordered
cashier_id UUID                 -- Who accepted
rider_id UUID                   -- Who's delivering
```

---

## 7. Notifications Sent

### Customer Notifications
1. **Order Accepted**: "Your order #XXX is now being prepared!"
2. **Out for Delivery**: "Your order #XXX is out for delivery!"

### Rider Notifications
1. **Delivery Assignment**: "You have been assigned to deliver order #XXX"

### Notification Format
```sql
INSERT INTO notifications (
  user_id,
  title,
  message,
  type,
  related_id
) VALUES (...)
```

---

## 8. Testing Checklist

### Order Number Testing
- [ ] First order of the day is 000
- [ ] Sequential numbering works (000, 001, 002...)
- [ ] Numbers reset at midnight
- [ ] Concurrent orders don't conflict

### Pending Orders Tab Testing
- [ ] Tab shows count badge
- [ ] Only shows delivery/pick-up orders
- [ ] Only shows pending status orders
- [ ] Accept button updates status correctly
- [ ] Customer receives notification
- [ ] Real-time updates work

### Rider Assignment Testing
- [ ] Button only shows for delivery orders in process
- [ ] Modal lists all riders
- [ ] Rider selection updates order correctly
- [ ] Both rider and customer get notified
- [ ] Rider sees order in their interface

### Delivery Fee Testing
- [ ] Map picker appears for delivery orders
- [ ] Fee calculates correctly based on distance
- [ ] Coordinates saved to database
- [ ] Fee displays in receipt
- [ ] Default fee used if coordinates not set

---

## 9. Future Enhancements

### Suggested Improvements
1. **Receipt Printing**: Convert console.log to actual printer output
2. **Kitchen Display System**: Show order slips on kitchen screens
3. **Delivery Tracking**: Real-time rider location on map
4. **Route Optimization**: Suggest optimal delivery routes
5. **Batch Assignments**: Assign multiple orders to one rider
6. **Performance Metrics**: Track acceptance times, delivery times
7. **Customer ETA**: Calculate and display estimated delivery time

---

## 10. Files Modified

### Database
- `supabase/migrations/035_update_order_number_to_3digit.sql` (NEW)

### Frontend
- `pages/cashier/dashboard.js` (MODIFIED - Added pending orders tab)
- `pages/cashier/orders-queue.js` (MODIFIED - Added rider selection)
- `pages/cashier/pos.js` (MODIFIED - Added map picker)

### Utilities
- `utils/deliveryCalculator.js` (EXISTING - Used for fee calculation)
- `components/OpenStreetMapPicker.js` (EXISTING - Used for map picker)

---

## 11. Important Notes

### OpenStreetMap Component
- Must use `dynamic` import with `ssr: false`
- Prevents Next.js SSR build errors
- Example:
```javascript
const OpenStreetMapPicker = dynamic(
  () => import('../../components/OpenStreetMapPicker'),
  { ssr: false }
);
```

### Order Status Transitions
- Always validate status before transitions
- Never skip status steps (e.g., pending → delivered)
- Maintain audit trail with timestamps

### Delivery Fee Default
- If coordinates not provided, uses DELIVERY_FEE_DEFAULT (₱30)
- For customer orders, coordinates should always be set
- POS orders can use default if customer prefers

---

## Support & Maintenance

For questions or issues related to this implementation:
1. Check this documentation first
2. Review the memories stored in the repository
3. Test with the provided checklist
4. Verify database migrations ran successfully

**Migration File**: Run `035_update_order_number_to_3digit.sql` before using the system to ensure correct order numbering.
