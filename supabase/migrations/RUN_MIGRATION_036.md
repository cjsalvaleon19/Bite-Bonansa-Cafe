# Migration 036: Add Cashier and Rider Tracking to Orders

## Problem

The cashier dashboard was failing with this error when trying to accept pending orders:

```
Failed to accept order: Could not find the 'cashier_id' column of 'orders' in the schema cache
```

## Root Cause

The `orders` table was missing two columns that are defined in the schema and used by the application:
- `cashier_id` - Tracks which cashier processed/accepted the order
- `rider_id` - Tracks which rider was assigned for delivery (for delivery orders)

## Solution

Created migration `036_add_cashier_rider_to_orders.sql` which:

1. **Adds `cashier_id` column**: UUID type, nullable, references `users(id)`
2. **Adds `rider_id` column**: UUID type, nullable, references `users(id)`
3. **Creates indexes** for both columns to optimize query performance
4. **Adds comments** to document the purpose of each column

## Usage

### Cashier ID
The `cashier_id` is set when a cashier accepts a pending online order:

```javascript
// From pages/cashier/dashboard.js
const { error } = await supabase
  .from('orders')
  .update({
    status: 'order_in_process',
    accepted_at: new Date().toISOString(),
    cashier_id: user?.id  // <-- Set cashier who accepted the order
  })
  .eq('id', orderId);
```

### Rider ID
The `rider_id` is set when a rider is assigned to deliver an order:

```javascript
// From pages/cashier/orders-queue.js
const { error } = await supabase
  .from('orders')
  .update({
    status: 'out_for_delivery',
    out_for_delivery_at: new Date().toISOString(),
    rider_id: selectedRiderId  // <-- Set rider assigned for delivery
  })
  .eq('id', orderId);
```

## Testing

Run the test file to verify the migration:

```bash
# In Supabase SQL Editor or via psql
\i supabase/migrations/036_add_cashier_rider_to_orders.sql
\i supabase/migrations/test_migration_036.sql
```

The test file verifies:
- ✓ Both columns exist
- ✓ Both columns are UUID type
- ✓ Both columns are nullable (optional)
- ✓ Both columns have foreign key constraints to `users(id)`
- ✓ Indexes are created for query performance

## Impact

After applying this migration:
- ✅ Cashiers can accept pending online orders without errors
- ✅ Order tracking shows which cashier processed each order
- ✅ Rider assignment for delivery orders works correctly
- ✅ Reports can filter/group by cashier or rider

## Related Files

- **Migration**: `supabase/migrations/036_add_cashier_rider_to_orders.sql`
- **Test**: `supabase/migrations/test_migration_036.sql`
- **Schema**: `database_schema.sql` (lines showing these columns should exist)
- **Usage**: `pages/cashier/dashboard.js` (line 188 - cashier_id)
- **Usage**: `pages/cashier/orders-queue.js` (rider assignment)

## Notes

- Both columns are **nullable** because not all orders require these values:
  - Walk-in orders created directly at POS may not have a cashier_id if created by the system
  - Dine-in, take-out, and pick-up orders don't need a rider_id
- The foreign key constraints ensure data integrity - only valid user IDs can be stored
- Indexes improve performance when filtering orders by cashier or rider
