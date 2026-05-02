# Rider Interface Data Source Documentation

## Overview
The Rider Interface (`pages/rider/deliveries.js`) has been updated to display order data from the **orders table** (the authoritative source) rather than relying solely on denormalized data in the deliveries table.

## Data Source Priority

### Fields Displayed from Orders Table
1. **Order Number** (`orders.order_number`) - User-friendly format like "ORD-260502-001"
2. **Customer Name** (`orders.customer_name`) - Primary source of customer information
3. **Phone Number** (`orders.customer_phone`) - Contact info from original order
4. **Delivery Fee** (`orders.delivery_fee`) - Fee from the order
5. **Items Details** (`orders.items`) - Complete list of items in the order
6. **Order Total** (`orders.total`) - Total order amount

### Fallback Pattern
All fields use defensive coding with fallback:
```javascript
delivery.orders?.field || delivery.field || default_value
```

This ensures:
- Primary data comes from orders table (via JOIN)
- Falls back to deliveries table if orders data is missing
- Provides default value as last resort

## Database Query

### Current Query Structure
```javascript
.from('deliveries')
.select('*, orders(id, order_number, total, customer_name, customer_phone, delivery_fee, items)')
.eq('rider_id', userId)
```

### Fields Retrieved
- **From deliveries table:** All columns (id, order_id, rider_id, status, timestamps, etc.)
- **From orders table (via JOIN):** id, order_number, total, customer_name, customer_phone, delivery_fee, items

## UI Display Logic

### Order Header
```javascript
// Shows order_number instead of order_id
{delivery.orders?.order_number || `Order #${delivery.order_id}`}
```

### Customer Information
```javascript
// Prioritizes orders table
<strong>Customer:</strong> {delivery.orders?.customer_name || delivery.customer_name || 'N/A'}
<strong>Phone:</strong> {delivery.orders?.customer_phone || delivery.customer_phone || 'N/A'}
```

### Delivery Fee
```javascript
// Uses orders.delivery_fee as primary source
₱{delivery.orders?.delivery_fee || delivery.delivery_fee || DEFAULT_DELIVERY_FEE}
```

### Items List (New Feature)
```javascript
// Only shows if orders.items exists and has data
{delivery.orders?.items && Array.isArray(delivery.orders.items) && delivery.orders.items.length > 0 && (
  <ul>
    {delivery.orders.items.map((item, idx) => (
      <li key={`${item.id || item.name}-${idx}`}>
        {item.quantity}x {item.name} @ ₱{item.price}
      </li>
    ))}
  </ul>
)}
```

## Benefits

### 1. Data Consistency
- Always displays current data from orders table
- No risk of displaying outdated denormalized data
- Single source of truth for order information

### 2. Traceability
- Order numbers (ORD-YYMMDD-NNN) are easier to reference than UUIDs
- Clear link back to original order
- Matches what cashiers and customers see

### 3. Complete Information
- Riders can see full order details including items
- Helps verify correct order before delivery
- Reduces delivery errors

### 4. Uniformity
- Same data format across all interfaces
- Consistent naming and display
- Easier to maintain and debug

## Why This Matters

### The Problem with Denormalization
The `deliveries` table contains denormalized copies of order data:
- `customer_name`, `customer_phone`, `customer_address`
- `delivery_fee`

These fields are copied from `orders` when the delivery record is created. However:
1. **Data can become stale** - If an order is updated after delivery creation, the deliveries table won't reflect the change
2. **No order number** - Deliveries table stores `order_id` (UUID) not the user-friendly `order_number`
3. **Missing details** - Items details are not copied to deliveries table

### The Solution
By querying via JOIN and prioritizing `delivery.orders.*` fields:
- We get real-time data from the authoritative source
- We can display the user-friendly order number
- We get access to all order details including items
- We maintain backwards compatibility with fallbacks

## Technical Notes

### React Keys
Items in the list use proper React keys:
```javascript
key={`${item.id || item.name}-${idx}`}
```
This combines item ID (or name) with index to ensure stability while handling items without IDs.

### Performance Considerations
- JOIN is efficient since deliveries.order_id has a foreign key index
- Orders table lookup is O(1) via indexed join
- No N+1 query problem since JOIN fetches in single query

### Edge Cases Handled
1. **Orders data missing** - Falls back to deliveries table data
2. **Items array null/undefined** - Conditional rendering prevents errors
3. **Empty items array** - Only displays section if items exist
4. **Missing order_number** - Falls back to showing order_id

## Future Maintenance

### When to Update This Query
Add more fields to the JOIN if riders need to see:
- Special instructions from orders
- Payment method
- Order timestamps
- Any other order metadata

### What NOT to Do
❌ Don't remove the fallback logic - it provides important backwards compatibility
❌ Don't query orders table separately (N+1 problem) - always use JOIN
❌ Don't copy more fields into deliveries table - use JOIN instead

## Related Files
- `pages/rider/deliveries.js` - Main rider interface
- `supabase/migrations/050_create_rider_portal_tables.sql` - Deliveries table schema
- `supabase/migrations/065_create_delivery_on_rider_assignment.sql` - Delivery creation function
- `supabase/migrations/066_backfill_existing_rider_deliveries.sql` - Backfill migration

## Testing
To verify this works correctly:
1. Log in as rider: johndave0991@bitebonansacafe.com
2. Navigate to /rider/deliveries
3. Verify:
   - Order numbers show as "ORD-YYMMDD-NNN" format
   - Customer name/phone match what's in orders table
   - Delivery fee matches orders table
   - Items list displays correctly
   - Order total is shown

---

**Last Updated:** 2026-05-02  
**Author:** GitHub Copilot Agent  
**Related Issue:** Align Rider Interface with Orders Table Data Source
