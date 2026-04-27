# Order Status and Tracking Improvements

## Summary of Changes

This implementation addresses the following issues:

### 1. Dashboard Order Status
- **Fixed**: Order Status now correctly counts pending orders from Order Tracking
- **Fixed**: Order Status is now clickable and links to Order Tracking page
- **Query**: Uses `.or('status.eq.order_in_queue,status.eq.order_in_process,status.eq.out_for_delivery')` to find active orders

### 2. Order Tracking UI Improvements
- **Changed**: Progress indicator from vertical to horizontal layout (saves space)
- **Added**: Order status text displayed next to Order Number
- **Added**: View Details button to show/hide order items
- **Fixed**: Special Request now shows only customer notes (extracts text before `|` delimiter)
- **Fixed**: Delivery Address shows the pinned address from Order Portal
- **Improved**: Green highlighting for completed progress steps

### 3. Order Number Format
- **Format**: 4 digits (0001-9999)
- **Reset**: Automatically resets to 0001 every day
- **Sequential**: Numbers are consecutive within each day
- **Implementation**: Database trigger automatically assigns order numbers

## Files Modified

1. **pages/customer/dashboard.js**
   - Made Order Status card clickable (links to order-tracking)
   - Fixed query to count pending orders correctly

2. **pages/customer/order-tracking.js**
   - Complete UI redesign with horizontal progress bar
   - Added expandable order items section
   - Fixed Special Request to show customer notes only
   - Shows delivery address from customer_address or delivery_address fields
   - Status mapping to user-friendly labels

3. **supabase/migrations/017_order_number_4digit_daily.sql**
   - Database function `generate_daily_order_number()` for 4-digit order numbers
   - Trigger `trg_set_order_number` to auto-populate order numbers
   - Numbers reset daily based on order creation date

## Database Migration Required

**IMPORTANT**: You must run the migration to enable 4-digit order numbers:

```bash
# Apply the migration to your Supabase database
# Upload and execute: supabase/migrations/017_order_number_4digit_daily.sql
```

Or via Supabase Dashboard:
1. Go to SQL Editor
2. Copy contents of `supabase/migrations/017_order_number_4digit_daily.sql`
3. Execute the SQL

## Status Mapping

The system now maps internal status values to user-friendly labels:

| Internal Status     | Display Label        | Color   |
|---------------------|----------------------|---------|
| pending             | Order in Queue       | Yellow  |
| order_in_queue      | Order in Queue       | Yellow  |
| confirmed           | Order in Process     | Blue    |
| order_in_process    | Order in Process     | Blue    |
| preparing           | Order in Process     | Blue    |
| out_for_delivery    | Out for Delivery     | Orange  |
| delivered           | Order Delivered      | Green   |
| order_delivered     | Order Delivered      | Green   |
| cancelled           | Cancelled            | Red     |

## Progress Steps

The horizontal timeline shows 4 steps:
1. **Order in Queue** 🕐
2. **Order in Process** 👨‍🍳
3. **Out for Delivery** 🛵
4. **Order Delivered** ✓

- Completed steps: Green background with checkmark
- Active step: Yellow border
- Pending steps: Gray

## Special Request Handling

Special requests are formatted in the database as:
```
Customer notes | Cash tendered: ₱500.00 | GCash ref: ABC123 | GCash proof: https://...
```

The UI now extracts only the customer notes part (before the first `|`) for display in the Special Request field.

## Testing Checklist

- [ ] Run database migration
- [ ] Place a new order and verify order_number is auto-generated (4 digits)
- [ ] Check Dashboard shows active orders count
- [ ] Click Order Status card to navigate to Order Tracking
- [ ] Verify horizontal progress bar displays correctly
- [ ] Test View Details button to expand/collapse order items
- [ ] Verify Special Request shows only customer notes
- [ ] Verify Delivery Address shows pinned location
- [ ] Test with orders in different statuses
- [ ] Verify order numbers reset the next day

## Notes

- Order number will be NULL for existing orders (created before migration)
- Display falls back to shortened order ID if order_number is not set
- Both `customer_address` and `delivery_address` fields are checked for backward compatibility
- **IMPORTANT**: The code uses `customer_id` to filter orders (matching the schema in `fix_orders_and_loyalty_schema.sql`). If your database still uses `user_id`, you'll need to either:
  1. Add a `customer_id` column to the orders table, OR
  2. Update the query in `pages/customer/order-tracking.js` line 118 to use `user_id` instead of `customer_id`
- The database function uses PostgreSQL advisory locks to prevent race conditions when generating sequential order numbers
