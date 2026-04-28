# Fix Checkout Error - Missing Items Column

## Problem

When clicking the **Checkout** button in the POS (Point of Sale) cashier interface, the following error occurred:

```
[POS] Checkout failed: Could not find the 'items' column of 'orders' in the schema cache
```

Additional errors:
- `Failed to load resource: the server responded with a status of 400`
- `Could not find element with selector .header-and-quick-actions-mfe-Header--organisation-name-text`
- Service worker failures

## Root Cause

The **`orders` table in the Supabase database was missing the `items` column**.

While the `database_schema.sql` file correctly defines the `items` column:

```sql
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  items JSONB NOT NULL, -- Array of {id, name, price, quantity}
  ...
);
```

The actual deployed database table did not have this column, likely because:
1. The initial schema was applied without this column
2. No migration file existed to add it retroactively
3. The table was created before the schema definition was updated

## Solution

Created migration **`034_add_items_column_to_orders.sql`** to add the missing column:

```sql
ALTER TABLE orders ADD COLUMN items JSONB;
```

### Migration Details

**File:** `supabase/migrations/034_add_items_column_to_orders.sql`

The migration:
1. ✅ Checks if the `items` column already exists (idempotent)
2. ✅ Adds the `items` column as `JSONB` type if missing
3. ✅ Creates a GIN index for efficient JSONB queries
4. ✅ Verifies the column was successfully created
5. ✅ Provides clear error messages if verification fails

### How the Items Column is Used

In the POS checkout process (`pages/cashier/pos.js`), the items are structured as:

```javascript
const orderData = {
  items: items.map(({ id, name, price, quantity }) => ({
    id,
    name,
    price,
    quantity,
  })),
  order_mode: orderMode,
  customer_name: customerInfo.customerName,
  // ... other order details
};

await supabase.from('orders').insert(orderData);
```

The `items` column stores a JSONB array of order items with:
- `id` - Menu item ID
- `name` - Menu item name
- `price` - Item price (including variant modifiers)
- `quantity` - Quantity ordered

## How to Apply the Migration

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `supabase/migrations/034_add_items_column_to_orders.sql`
4. Paste and run the SQL
5. Verify success message: "Added items column to orders table"

### Option 2: Via Supabase CLI

```bash
# Make sure you're in the project directory
cd /path/to/Bite-Bonansa-Cafe

# Run the migration
supabase db push

# Or run specific migration
supabase migration up
```

### Option 3: Direct SQL Connection

If you have direct database access:

```bash
psql <connection-string> -f supabase/migrations/034_add_items_column_to_orders.sql
```

## Verification

After applying the migration, verify the column exists:

```sql
-- Check if column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'orders' AND column_name = 'items';

-- Expected result:
-- column_name | data_type | is_nullable
-- items       | jsonb     | YES
```

## Additional Context

### Order Items Table

Note that there's also an **`order_items`** table that stores normalized order item data:

```sql
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id),
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  subtotal DECIMAL(10,2) NOT NULL
);
```

The POS checkout process:
1. **Inserts** the order into `orders` table (including `items` JSONB column)
2. **Inserts** individual items into `order_items` table (for reporting/analytics)

Both are important:
- `orders.items` - Quick access to order details, preserves exact checkout state
- `order_items` - Normalized data for queries, reports, and analytics

### Why Both Storage Methods?

- **JSONB `items` column**: Fast access, preserves exact state, good for receipts
- **`order_items` table**: Queryable, supports joins with menu_items, better for analytics

## Testing the Fix

After applying the migration:

1. **Navigate** to the POS cashier interface (`/cashier/pos`)
2. **Add items** to the cart
3. **Fill in** customer details and payment information
4. **Click** the Checkout button
5. **Verify** the order is created successfully without errors
6. **Check** the Supabase database:
   ```sql
   SELECT id, items, created_at FROM orders ORDER BY created_at DESC LIMIT 1;
   ```

Expected: The `items` column should contain JSONB data like:
```json
[
  {"id": "uuid", "name": "Chicken Burger", "price": 120, "quantity": 2},
  {"id": "uuid", "name": "Fries", "price": 60, "quantity": 1}
]
```

## Impact

- ✅ **Fixes** checkout errors in POS system
- ✅ **Enables** proper order placement for walk-in customers
- ✅ **Preserves** order item details in JSONB format
- ✅ **Maintains** compatibility with existing `order_items` table
- ⚠️ **No breaking changes** - migration is additive only

## Related Files

- `supabase/migrations/034_add_items_column_to_orders.sql` - Migration file
- `database_schema.sql` - Full schema definition (reference)
- `pages/cashier/pos.js` - POS interface that uses the items column
- `supabase/migrations/021_add_missing_orders_columns.sql` - Previous orders table migration

## Future Considerations

If you encounter similar schema cache errors, check:

1. **Column exists in schema definition** but not in database
2. **Migration files** are properly sequenced and applied
3. **Supabase cache** may need to be refreshed (restart database or wait a few minutes)
4. **Environment variables** point to correct database instance

---

**Migration Status:** ✅ Ready to apply  
**Breaking Changes:** None  
**Rollback:** Safe (can drop column if needed, but not recommended)
