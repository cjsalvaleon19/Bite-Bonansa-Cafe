# Migration 083 - Fix Stuck Orders and Rider Receipt

## Overview
This migration fixes two issues:
1. **Customer Interface**: Three specific orders stuck in pending view even after being marked complete
2. **Rider Interface**: Receipt preview not showing item details (fixed in frontend code)

## What This Migration Does

### 1. Force Update Stuck Orders
Updates the following orders to `order_delivered` status:
- Order #ORD-260430-006
- Order #ORD-260504-002
- Order #ORD-260504-004

These orders were showing in the customer's "Pending Orders" tab even after clicking "Order Complete". The migration sets their status to `order_delivered` and ensures they have a `delivered_at` timestamp.

### 2. Rider Receipt Fix (Frontend)
The rider receipt preview issue is fixed by updating `pages/rider/deliveries.js`:
- Updated `DELIVERIES_SELECT_QUERY` to include `order_items` relation
- Receipt modal now receives both `items` (JSONB) and `order_items` (related table)
- This ensures item details display correctly in the receipt preview

## How to Run This Migration

### Using Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Open the file `supabase/migrations/083_fix_stuck_orders_and_rider_receipt.sql`
4. Copy and paste the contents into the SQL Editor
5. Click "Run" to execute the migration

### Using Supabase CLI
```bash
# From the project root directory
supabase db push
```

## Verification

### Verify Stuck Orders Are Fixed
Run this query to check the orders were updated:
```sql
SELECT order_number, status, delivered_at, updated_at
FROM orders
WHERE order_number IN ('ORD-260430-006', 'ORD-260504-002', 'ORD-260504-004');
```

Expected result: All three orders should have `status = 'order_delivered'` and a `delivered_at` timestamp.

### Verify Rider Receipt Shows Items
1. Log in as a rider
2. Go to Deliveries page
3. Click "📄 View Receipt" on any delivery
4. Verify that item details are displayed in the receipt modal

## Expected Behavior After Migration

### Customer Interface
- Orders ORD-260430-006, ORD-260504-002, and ORD-260504-004 will move from "Pending Orders" to "Completed Orders" tab
- The customer's order tracking page will properly filter completed orders
- Realtime updates will continue to work for new orders

### Rider Interface  
- Receipt preview will display all item details including:
  - Item names
  - Quantities
  - Prices
  - Variant details (if any)
  - Special notes

## Related Files
- **Migration**: `supabase/migrations/083_fix_stuck_orders_and_rider_receipt.sql`
- **Frontend Fix**: `pages/rider/deliveries.js` (updated DELIVERIES_SELECT_QUERY)
- **Receipt Component**: `components/ReceiptModal.js` (handles both items and order_items)

## Notes
- This is a one-time fix for specific stuck orders
- The root cause of orders getting stuck should be investigated separately
- Future orders should not have this issue if the order completion flow is working correctly
- The rider receipt fix is permanent and applies to all deliveries
