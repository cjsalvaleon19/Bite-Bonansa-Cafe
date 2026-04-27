# Fix: create_order_items_table.sql Type Mismatch Error

## Problem

The `create_order_items_table.sql` migration was failing with this error:

```
Failed to run sql query: ERROR:  42883: operator does not exist: text = uuid
HINT:  No operator matches the given name and argument types. You might need to add explicit type casts.
```

## Root Cause

The error occurred because of a **type mismatch** between the `orders.id` column and the `order_items.order_id` column:

1. **Original issue**: The script assumed `orders.id` was always `UUID` type
2. **Actual state**: In some environments, `orders.id` had been changed to `TEXT` type (see `fix_orders_id_column.sql`)
3. **Foreign key constraint**: When creating the foreign key `order_items.order_id REFERENCES orders(id)`, PostgreSQL tried to compare TEXT with UUID, which is not allowed without explicit casting

## Solution

Updated `create_order_items_table.sql` to **dynamically detect** the `orders.id` data type and create the `order_items` table with a matching `order_id` type.

### Changes Made

1. **Part 1: Detection Phase**
   - Query `information_schema.columns` to detect the actual type of `orders.id`
   - Display informative messages about the detected type

2. **Part 2: Dynamic Table Creation**
   - Drop existing `order_items` table if it exists (to recreate with correct type)
   - Use PL/pgSQL `IF...ELSE` to create the table with:
     - `UUID order_id` if `orders.id` is UUID
     - `TEXT order_id` if `orders.id` is TEXT
   - Both paths create the same table structure, just with different `order_id` types

3. **Updated Comments & Notices**
   - Removed assumptions about UUID type
   - Added clarity that the type is auto-detected
   - Updated completion messages to reflect the dynamic approach

### Code Example

```sql
DO $$
DECLARE
  orders_id_type TEXT;
BEGIN
  -- Detect orders.id type
  SELECT data_type INTO orders_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'orders'
    AND column_name = 'id';
  
  -- Create table with matching type
  IF orders_id_type = 'uuid' THEN
    CREATE TABLE public.order_items (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id      UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
      -- ... other columns
    );
  ELSE
    CREATE TABLE public.order_items (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id      TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
      -- ... other columns
    );
  END IF;
END $$;
```

## Benefits

1. **Type Safety**: Prevents "operator does not exist" errors by ensuring type compatibility
2. **Flexibility**: Works with both UUID and TEXT `orders.id` columns
3. **Auto-Detection**: No manual intervention needed - script automatically adapts
4. **Clear Messages**: Provides informative NOTICE messages about what type was detected and used

## Testing

To verify the fix works:

1. Run the updated `create_order_items_table.sql` script
2. Check the NOTICE messages to see what type was detected
3. Verify the table was created successfully with matching types:
   ```sql
   SELECT 
     column_name,
     data_type
   FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name IN ('orders', 'order_items')
     AND column_name IN ('id', 'order_id')
   ORDER BY table_name, column_name;
   ```

## Related Files

- `create_order_items_table.sql` - The fixed migration script
- `fix_orders_id_column.sql` - Script that may have changed `orders.id` to TEXT
- `fix_orders_and_loyalty_schema.sql` - Similar approach for `loyalty_transactions` table

## Lessons Learned

When creating foreign key references in PostgreSQL:

1. **Never assume column types** - always detect them dynamically if there's any uncertainty
2. **Use information_schema** to query actual schema metadata
3. **Provide clear error messages** to help diagnose issues
4. **Follow the same pattern** used in `fix_orders_and_loyalty_schema.sql` for consistency
