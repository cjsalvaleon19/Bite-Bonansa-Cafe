# Order Number and Pick-up Order Fixes

This document summarizes the fixes applied to resolve three issues with the Customer Interface and Cashier Interface.

## Issues Fixed

### 1. Order Number Starting at 000 Instead of 001

**Problem:** Customer Interface orders were showing Order #000 instead of Order #001 for the first order of the day.

**Root Cause:** The `generate_daily_order_number()` function was using `COALESCE(MAX(...), -1)` which meant the first order would be `-1 + 1 = 0`, formatted as "000".

**Solution:**
- Created migration `040_fix_order_number_start_at_001.sql`
- Changed `COALESCE(MAX(CAST(order_number AS INTEGER)), 0)` to start at 0 instead of -1
- First order of the day: `0 + 1 = 1` → formatted as "001" ✅
- Subsequent orders: "002", "003", etc.

**Files Changed:**
- `supabase/migrations/040_fix_order_number_start_at_001.sql` (new migration)

---

### 2. Pick-up Orders Not Appearing in Cashier's Dashboard

**Problem:** Customer interface pick-up orders were not captured in the Cashier's Interface under "Pending Online Orders".

**Root Cause:** The customer order page was using `order_mode: 'takeout'` instead of `'pick-up'`, while the cashier dashboard was filtering for `['delivery', 'pick-up']`.

**Solution:**
- Fixed `app/customer/order/page.tsx` to use `order_mode: 'pick-up'` instead of `'takeout'`
- Added "Ready for Pick-Up" button in cashier's orders queue for pick-up orders
- Created `handleReadyForPickup()` function that:
  - Updates order status to `'out_for_delivery'` (which displays as "Ready for Pick-up" for pick-up orders)
  - Sets `out_for_delivery_at` timestamp
  - Sends notification to customer: "Your order #XXX is ready for pick-up!"
- Added conditional UI logic to show:
  - "🚚 Out for Delivery" button for delivery orders
  - "✅ Ready for Pick-Up" button for pick-up orders

**Files Changed:**
- `app/customer/order/page.tsx` - Changed order_mode from 'takeout' to 'pick-up'
- `pages/cashier/orders-queue.js` - Added Ready for Pick-Up functionality

**Workflow:**
1. Customer places pick-up order → status: `'pending'`, order_mode: `'pick-up'`
2. Order appears in Cashier Dashboard "Pending Online Orders" tab
3. Cashier accepts order → status: `'order_in_process'`
4. Order appears in Orders Queue with "✅ Ready for Pick-Up" button
5. Cashier clicks "Ready for Pick-Up" → status: `'out_for_delivery'`, customer gets notification
6. Customer picks up order → Cashier marks as served

---

### 3. Status Labels for Pick-up Orders

**Problem:** Pick-up orders were showing "Out for Delivery" and "Order Delivered" labels, which don't make sense for orders that are picked up.

**Solution:** Updated all customer interface pages to show conditional labels based on `order_mode`:

**Status Label Mapping:**

| Database Status    | Delivery Orders      | Pick-up Orders       |
|--------------------|---------------------|---------------------|
| `out_for_delivery` | "Out for Delivery" 🛵 | "Ready for Pick-up" ✅ |
| `order_delivered`  | "Order Delivered" ✓   | "Order Complete" ✓    |

**Files Changed:**
1. **pages/customer/order-tracking.js** (already done in previous work)
   - `getProgressSteps()` function checks `orderMode === 'pick-up'`
   - Shows conditional labels and icons

2. **pages/customer/dashboard.js**
   - Updated `getStatusDisplay(status, orderMode)` to accept orderMode parameter
   - Returns different labels/icons based on order_mode

3. **pages/customer/orders.js**
   - Updated `getStatusInfo(status, orderMode)` to accept orderMode parameter
   - Timeline shows conditional labels:
     - Step 3: "Ready for Pick-up" ✅ (pick-up) vs "Out for Delivery" 🛵 (delivery)
     - Step 4: "Order Complete" ✓ (pick-up) vs "Order Delivered" ✓ (delivery)

---

## Testing Checklist

### Order Number (Issue 1)
- [ ] Apply migration 040 to production database
- [ ] Place a new order as the first order of the day
- [ ] Verify order number shows as "001" (not "000")
- [ ] Place another order and verify it shows as "002"

### Pick-up Orders (Issue 2)
- [ ] Customer places a pick-up order via Customer Order Portal
- [ ] Verify order appears in Cashier Dashboard → "Pending Online Orders" tab
- [ ] Cashier accepts the order
- [ ] Verify "✅ Ready for Pick-Up" button appears in Orders Queue
- [ ] Click "Ready for Pick-Up"
- [ ] Verify customer receives notification: "Your order #XXX is ready for pick-up!"

### Status Labels (Issue 3)
- [ ] Customer places a pick-up order
- [ ] Check Customer Dashboard - verify status shows "Ready for Pick-up" (not "Out for Delivery")
- [ ] Check Order Tracking - verify progress steps show:
  - Step 1: "Order in Queue" 🕐
  - Step 2: "Order in Process" 👨‍🍳
  - Step 3: "Ready for Pick-up" ✅
  - Step 4: "Order Complete" ✓
- [ ] Check Orders page - verify timeline shows correct labels
- [ ] Verify delivery orders still show "Out for Delivery" and "Order Delivered"

---

## Database Migration

**Migration File:** `supabase/migrations/040_fix_order_number_start_at_001.sql`

To apply the migration:

```bash
# Using Supabase CLI
supabase db push

# Or manually in Supabase SQL Editor
# Copy and paste the contents of 040_fix_order_number_start_at_001.sql
```

---

## Summary of Changes

### Frontend Changes
1. **app/customer/order/page.tsx**
   - Line 535: Changed `order_mode: 'takeout'` → `order_mode: 'pick-up'`

2. **pages/cashier/orders-queue.js**
   - Added `handleReadyForPickup()` function (lines 142-175)
   - Added "Ready for Pick-Up" button UI (lines 327-334)
   - Added `pickupReadyBtn` style (lines 667-676)

3. **pages/customer/dashboard.js**
   - Updated `getStatusDisplay(status, orderMode)` with conditional logic (lines 202-218)
   - Updated function call to pass `order_mode` parameter (line 233)

4. **pages/customer/orders.js**
   - Updated `getStatusInfo(status, orderMode)` with conditional logic (lines 125-167)
   - Updated function call to pass `order_mode` parameter (line 224)
   - Updated timeline labels to be conditional (lines 280-311)

### Backend Changes
1. **supabase/migrations/040_fix_order_number_start_at_001.sql**
   - Changed `COALESCE(MAX(...), -1)` → `COALESCE(MAX(...), 0)`
   - Reset logic: `IF next_num > 999 THEN next_num := 1` (was 0)

---

## Notes

- The `order_mode` field supports: `'delivery'`, `'pick-up'`, `'dine-in'`, `'take-out'`
- Cashier dashboard filters for both `'delivery'` and `'pick-up'` orders in Pending Online Orders
- The status `'out_for_delivery'` is used for both delivery and pick-up orders, but displays different labels
- All existing delivery orders continue to work as before
- Pick-up orders now have proper workflow and labeling throughout the system
