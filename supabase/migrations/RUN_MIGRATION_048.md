# Migration 048: Update Order Number Format to ORD-YYMMDD-NNN

## Overview

This migration updates the order number format from a simple 3-digit daily reset format (`001`, `002`, `003`) to a date-prefixed format (`ORD-YYMMDD-NNN`) that is globally unique.

## New Format

**Format:** `ORD-YYMMDD-NNN`

**Examples:**
- `ORD-260430-001` - First order on April 30, 2026
- `ORD-260430-042` - 42nd order on the same day
- `ORD-260501-001` - First order on May 1, 2026

## Benefits

### 1. **Eliminates Duplicate Key Errors**
- Order numbers are now globally unique (includes date)
- No more conflicts when order numbers reset daily
- Can safely use global UNIQUE constraint

### 2. **Self-Documenting**
- Date is embedded in the order number
- Easy to identify when an order was placed
- Helpful for accounting, audits, and customer support

### 3. **Scalable**
- Supports up to 999 orders per day
- Can easily expand to 4 digits (9,999 orders/day) if needed
- Format: `ORD-YYMMDD-NNNN`

### 4. **Simplified Database Schema**
- No need for composite unique index
- Standard UNIQUE constraint works perfectly
- Cleaner, simpler design

## What This Migration Does

### Database Changes

1. **Drops Existing Trigger**
   - Removes `trg_set_order_number` trigger

2. **Drops Composite Unique Index**
   - Removes `idx_orders_order_number_date_unique`
   - No longer needed since order numbers are globally unique

3. **Updates Column Size**
   - Changes `order_number` from `VARCHAR(3)` to `VARCHAR(20)`
   - Accommodates new format (14 characters)

4. **Creates New Generate Function**
   - Function: `generate_order_number()`
   - Returns: Trigger (not just a value)
   - Format: `ORD-YYMMDD-NNN`
   - Features:
     - Uses Asia/Manila timezone
     - Advisory locks to prevent race conditions
     - Handles duplicates with WHILE loop
     - Supports up to 999 orders per day

5. **Creates New Trigger**
   - Trigger: `trg_generate_order_number`
   - Executes BEFORE INSERT on orders table
   - Calls `generate_order_number()` function

6. **Adds Global UNIQUE Constraint**
   - Constraint: `orders_order_number_unique`
   - Now safe since order numbers include date

### Code Changes

**Good News:** No UI code changes required! 

The existing code already uses a fallback pattern:
```javascript
order.order_number || order.id.slice(0, 8)
```

This pattern will continue to work with the new format. The UI will simply display:
- Old format: `001`, `002`, `003`
- New format: `ORD-260430-001`, `ORD-260430-042`

## How to Run

### Option 1: Supabase Dashboard (Recommended)

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Create a new query
4. Copy and paste the entire contents of `048_update_order_number_to_date_format.sql`
5. Click **Run**
6. Check the output for verification messages

### Option 2: Command Line

```bash
# Using psql
psql -h <your-host> -U postgres -d postgres -f supabase/migrations/048_update_order_number_to_date_format.sql

# Using Supabase CLI
supabase db push
```

## Verification

After running the migration, you should see output like:

```
✓ Added UNIQUE constraint on order_number
✓ order_number column type: character varying(20)
✓ Trigger trg_generate_order_number exists
✓ UNIQUE constraint on order_number exists
```

### Manual Testing

1. **Create a test order:**
   ```sql
   INSERT INTO orders (customer_id, total_amount, status, order_mode)
   VALUES (
     (SELECT id FROM auth.users LIMIT 1),
     100.00,
     'pending',
     'dine-in'
   )
   RETURNING order_number;
   ```

2. **Verify the format:**
   - Should return something like: `ORD-260430-001`
   - Format should be: `ORD-YYMMDD-NNN`

3. **Test sequential numbering:**
   ```sql
   -- Create multiple orders
   INSERT INTO orders (customer_id, total_amount, status, order_mode)
   SELECT 
     (SELECT id FROM auth.users LIMIT 1),
     100.00,
     'pending',
     'dine-in'
   FROM generate_series(1, 5)
   RETURNING order_number;
   ```

4. **Verify uniqueness:**
   ```sql
   -- Check for duplicates
   SELECT order_number, COUNT(*) 
   FROM orders 
   GROUP BY order_number 
   HAVING COUNT(*) > 1;
   ```
   - Should return 0 rows

## Backward Compatibility

- **Existing orders:** Keep their old format (`001`, `002`, etc.)
- **New orders:** Use new format (`ORD-260430-001`, etc.)
- **UI code:** Already handles both formats with fallback pattern
- **Reports:** Work with both formats

## Rollback Plan

If you need to rollback this migration:

```sql
-- 1. Drop the new trigger
DROP TRIGGER IF EXISTS trg_generate_order_number ON orders;

-- 2. Restore old function and trigger
-- (Run migration 040 again)

-- 3. Restore composite unique index
-- (Run migration 046 again)

-- 4. Update column size back to VARCHAR(3)
-- Note: This will fail if any order numbers are longer than 3 characters
-- You would need to handle those records first
```

## Support

If you encounter any issues:

1. Check the verification output
2. Look for error messages in the migration output
3. Verify your PostgreSQL version (requires 9.6+)
4. Ensure you have proper permissions (SUPERUSER or table owner)

## Related Migrations

- **Migration 035:** Updated order numbers to 3-digit format
- **Migration 040:** Fixed order numbers to start at 001
- **Migration 046:** Fixed duplicate order number constraint issue

This migration supersedes the composite unique index approach from Migration 046 by making order numbers globally unique.

## Notes

- **Advisory Locks:** The migration uses PostgreSQL advisory locks to prevent race conditions during concurrent order creation
- **Timezone:** Uses Asia/Manila timezone for date calculation
- **Counter Reset:** Counter resets to 001 each day automatically
- **Maximum Orders:** Supports up to 999 orders per day (can be expanded to 9999 if needed)

---

**Migration Status:** Ready to Run  
**Risk Level:** Low (backward compatible)  
**Estimated Duration:** < 5 seconds  
**Downtime Required:** None
