# Order Number Trigger Fix - Migration 037

## Problem

You encountered this error when trying to create orders:

```
ERROR: 42P17: function generate_daily_order_number must return type trigger
```

## Root Cause

The error occurs because PostgreSQL trigger functions **must** return type `trigger`, but the `generate_daily_order_number()` function returns `VARCHAR(3)`. 

### Correct Architecture

The system should use **two functions**:

1. **`generate_daily_order_number()`** - Helper function that generates the 3-digit number
   - Returns: `VARCHAR(3)`
   - Purpose: Contains the logic for generating sequential order numbers
   - Called by: The trigger function

2. **`set_order_number()`** - Trigger function  
   - Returns: `TRIGGER`
   - Purpose: Calls `generate_daily_order_number()` and sets `NEW.order_number`
   - Called by: The `trg_set_order_number` trigger on INSERT

### The Problem

Someone may have tried to create a trigger directly using `generate_daily_order_number()`, which causes the error because it doesn't return `TRIGGER` type.

## Solution

Migration 037 fixes this by:

1. Dropping any incorrectly configured triggers
2. Ensuring `set_order_number()` exists with the correct `TRIGGER` return type
3. Recreating the trigger to use `set_order_number()` (not `generate_daily_order_number()`)

## How to Apply the Fix

### Step 1: Run Migration 037

In your Supabase SQL Editor, run:

```sql
-- Copy and paste the contents of:
-- supabase/migrations/037_fix_order_number_trigger.sql
```

### Step 2: Verify the Fix

Run the test script to verify everything works:

```sql
-- Copy and paste the contents of:
-- supabase/migrations/test_order_number_trigger_fix.sql
```

### Step 3: Expected Test Results

You should see output like:

```
✓ generate_daily_order_number() returns character varying
✓ set_order_number() returns trigger
✓ Trigger uses set_order_number() function
✓ Order number format is valid (3 digits)
✓ Order numbers are sequential
```

## Quick Verification Commands

Run these in Supabase SQL Editor to verify the fix:

```sql
-- 1. Check function return types
SELECT 
  proname AS function_name,
  pg_catalog.format_type(prorettype, NULL) AS return_type
FROM pg_proc
WHERE proname IN ('generate_daily_order_number', 'set_order_number');

-- 2. Verify trigger configuration
SELECT 
  trigger_name,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trg_set_order_number'
  AND event_object_table = 'orders';
```

Expected results:
- `generate_daily_order_number` → returns `character varying`
- `set_order_number` → returns `trigger`
- Trigger action should call `set_order_number()`

## Test Order Creation

After applying the fix, test with a real order insert:

```sql
-- Test order insert (replace with valid user_id)
INSERT INTO orders (
  customer_id,
  order_mode,
  payment_method,
  status,
  items,
  total_amount
) VALUES (
  'YOUR_USER_ID_HERE',  -- Replace with actual UUID
  'dine-in',
  'cash',
  'pending',
  '[{"id": "item1", "name": "Test Item", "price": 100, "quantity": 1}]'::jsonb,
  100.00
) RETURNING id, order_number;
```

The `order_number` should be auto-generated as a 3-digit number (e.g., "000", "001", "002").

## Technical Details

### Function Signatures

```sql
-- Helper function (generates the number)
CREATE OR REPLACE FUNCTION generate_daily_order_number()
RETURNS VARCHAR(3) AS $$
BEGIN
  -- Logic to generate 3-digit order number
  RETURN order_num_str;
END;
$$ LANGUAGE plpgsql;

-- Trigger function (sets the number on INSERT)
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := generate_daily_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger definition
CREATE TRIGGER trg_set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL)
  EXECUTE FUNCTION set_order_number();  -- Uses set_order_number, NOT generate_daily_order_number
```

## Troubleshooting

### Error Persists After Migration

If you still see the error after running migration 037:

1. **Verify the migration ran successfully**:
   ```sql
   SELECT * FROM _migrations WHERE name = '037_fix_order_number_trigger';
   ```

2. **Check current trigger configuration**:
   ```sql
   SELECT trigger_name, action_statement
   FROM information_schema.triggers
   WHERE event_object_table = 'orders';
   ```

3. **Manually recreate the trigger** if needed:
   ```sql
   DROP TRIGGER IF EXISTS trg_set_order_number ON orders;
   
   CREATE TRIGGER trg_set_order_number
     BEFORE INSERT ON orders
     FOR EACH ROW
     WHEN (NEW.order_number IS NULL)
     EXECUTE FUNCTION set_order_number();
   ```

### Order Numbers Not Being Generated

If order numbers are NULL:

1. Check that the trigger exists and is enabled
2. Verify you're NOT passing `order_number` in your INSERT statement
3. Make sure `generate_daily_order_number()` function exists

## Related Files

- **Migration**: `supabase/migrations/037_fix_order_number_trigger.sql`
- **Test Script**: `supabase/migrations/test_order_number_trigger_fix.sql`
- **Original Migration**: `supabase/migrations/035_update_order_number_to_3digit.sql`

## Summary

✅ **Before Fix**: Trigger incorrectly used `generate_daily_order_number()` → Error  
✅ **After Fix**: Trigger correctly uses `set_order_number()` → Works perfectly

The fix ensures the proper two-function architecture where:
- `generate_daily_order_number()` generates the number
- `set_order_number()` (trigger function) applies it to new orders
