# Running Migrations 074 & 075: Fix Cashier Interface Errors

## Overview
These migrations fix three critical errors in the Cashier's Interface:
1. **Order Complete Button Error**: "ON CONFLICT DO UPDATE command cannot affect row a second time"
2. **EOD Report Delivery Fee**: Delivery fees showing ₱0.00 instead of actual amounts
3. **Settings Toggle Error**: "duplicate key value violates unique constraint"

## Prerequisites
- Database access with migration permissions
- Backup of production database (recommended)

## Migration 074: Fix Order Completion Conflict

### Purpose
Prevents the error "ON CONFLICT DO UPDATE command cannot affect row a second time" when clicking the "Order Complete" button.

### Root Cause
The loyalty points trigger could be invoked multiple times for the same order, attempting to insert duplicate loyalty transactions.

### Changes
1. Adds UNIQUE constraint `(order_id, transaction_type)` to `loyalty_transactions` table
2. Updates `award_loyalty_points_on_order_completion()` function to use `ON CONFLICT DO NOTHING`
3. Prevents duplicate loyalty awards for the same order

### Running Migration 074

```bash
# Connect to your Supabase project
cd /path/to/Bite-Bonansa-Cafe

# Run the migration
supabase db push

# Or manually via SQL editor in Supabase Dashboard:
# Copy and paste the contents of:
# supabase/migrations/074_fix_order_completion_conflict.sql
```

### Verification

```sql
-- 1. Check that the unique constraint was added
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'loyalty_transactions'
  AND constraint_name = 'unique_loyalty_per_order';

-- Expected: One row with constraint_name='unique_loyalty_per_order', constraint_type='UNIQUE'

-- 2. Verify no duplicate loyalty awards exist
SELECT order_id, transaction_type, COUNT(*) as count
FROM loyalty_transactions
WHERE transaction_type = 'earned'
GROUP BY order_id, transaction_type
HAVING COUNT(*) > 1;

-- Expected: No rows (no duplicates)

-- 3. Test the fix by completing an order
-- In Cashier Interface > Order Queue:
-- - Select a pick-up order
-- - Click "Order Complete"
-- - Should complete without error
```

## Migration 075: Backfill Missing Delivery Fees

### Purpose
Fixes delivery orders showing ₱0.00 delivery fee in EOD Report even though the fee is included in the total.

### Root Cause
Some delivery orders were created with `delivery_fee=0` or `NULL`, even though the delivery fee was included in the `total_amount`. This happened when:
- Orders were placed without setting delivery coordinates (lat/lng = null)
- Legacy orders created before delivery_fee column was added
- Database defaults not properly applied

### Changes
1. Calculates `delivery_fee` from `(total_amount - subtotal)` for affected orders
2. Updates only delivery orders where `delivery_fee` is 0 or NULL but `total > subtotal`
3. Adds documentation comment to `orders.delivery_fee` column

### Running Migration 075

```bash
# Connect to your Supabase project
cd /path/to/Bite-Bonansa-Cafe

# Run the migration
supabase db push

# Or manually via SQL editor in Supabase Dashboard:
# Copy and paste the contents of:
# supabase/migrations/075_backfill_delivery_fees_from_total.sql
```

### Verification

```sql
-- 1. Check delivery fee statistics
SELECT 
  COUNT(*) as total_delivery_orders,
  COUNT(CASE WHEN delivery_fee > 0 THEN 1 END) as with_fee,
  COUNT(CASE WHEN delivery_fee = 0 OR delivery_fee IS NULL THEN 1 END) as without_fee,
  AVG(delivery_fee) as avg_fee,
  MIN(delivery_fee) as min_fee,
  MAX(delivery_fee) as max_fee
FROM orders
WHERE order_mode = 'delivery';

-- Expected: 
-- - with_fee should be close to total_delivery_orders
-- - without_fee should be 0 or very small
-- - avg_fee should be around 30-50

-- 2. Check specific orders that were fixed
SELECT 
  order_number,
  subtotal,
  delivery_fee,
  total_amount,
  (total_amount - subtotal) as calculated_fee,
  created_at
FROM orders
WHERE order_mode = 'delivery'
  AND delivery_fee > 0
ORDER BY created_at DESC
LIMIT 10;

-- Expected: delivery_fee should equal (total_amount - subtotal)

-- 3. Verify in Cashier Interface
-- Navigate to: Cashier Interface > EOD Report
-- - Select a date with delivery orders
-- - Check "Delivery Fee" column
-- - Should show actual amounts (e.g., ₱30.00, ₱35.00) not ₱0.00
```

## Post-Migration Tasks

### 1. Test Order Completion
- [ ] Open Cashier Interface > Order Queue
- [ ] Create a test pick-up order
- [ ] Mark it as "Ready for Pick-Up"
- [ ] Click "Order Complete"
- [ ] Verify: No error, order moves to completed status

### 2. Test Delivery Toggle
- [ ] Open Cashier Interface > Settings
- [ ] Toggle "Delivery Feature" off
- [ ] Verify: No error, setting saves successfully
- [ ] Toggle it back on
- [ ] Verify: No error

### 3. Verify EOD Report
- [ ] Open Cashier Interface > EOD Report
- [ ] Select a date with delivery orders
- [ ] Verify: Delivery Fee column shows correct amounts
- [ ] Click "Preview" button on a delivery order
- [ ] Verify: Receipt shows correct delivery fee

### 4. Check Profile Page
- [ ] Open Cashier Interface > Profile
- [ ] Verify: Page loads without errors
- [ ] Update profile information
- [ ] Verify: Saves successfully

## Rollback Instructions

If issues occur after migration:

### Rollback Migration 074

```sql
-- Remove the unique constraint
ALTER TABLE loyalty_transactions 
DROP CONSTRAINT IF EXISTS unique_loyalty_per_order;

-- Restore original trigger function (without ON CONFLICT)
-- You may need to restore from backup or manually recreate
-- the function from migration 073
```

### Rollback Migration 075

```sql
-- Note: This migration only UPDATE existing data
-- Rollback is not recommended as it would lose the fixes
-- Instead, verify data is correct using verification queries above

-- If absolutely necessary, you could set delivery_fee back to 0:
UPDATE orders
SET delivery_fee = 0
WHERE order_mode = 'delivery'
  AND delivery_fee = (total_amount - subtotal);
-- WARNING: This undoes the fix!
```

## Troubleshooting

### Issue: Unique constraint violation after migration 074

**Symptom**: Error when trying to complete orders

**Cause**: Existing duplicate loyalty transactions in database

**Solution**:
```sql
-- Find duplicates
SELECT order_id, transaction_type, COUNT(*) as count
FROM loyalty_transactions
WHERE transaction_type = 'earned'
GROUP BY order_id, transaction_type
HAVING COUNT(*) > 1;

-- Remove duplicates (keeps the first one)
DELETE FROM loyalty_transactions a
USING loyalty_transactions b
WHERE a.id > b.id
  AND a.order_id = b.order_id
  AND a.transaction_type = b.transaction_type
  AND a.transaction_type = 'earned';

-- Then retry adding the constraint
ALTER TABLE loyalty_transactions 
ADD CONSTRAINT unique_loyalty_per_order UNIQUE (order_id, transaction_type);
```

### Issue: Delivery fees still showing as 0

**Symptom**: Some delivery orders still show ₱0.00 in EOD Report

**Cause**: Orders where `total_amount = subtotal` (no delivery fee was charged)

**Solution**: These are likely test orders or errors. Manually update:
```sql
-- Find problematic orders
SELECT order_number, subtotal, delivery_fee, total_amount, created_at
FROM orders
WHERE order_mode = 'delivery'
  AND (delivery_fee = 0 OR delivery_fee IS NULL)
  AND total_amount = subtotal;

-- Manually set to base delivery fee if appropriate
UPDATE orders
SET delivery_fee = 30
WHERE order_mode = 'delivery'
  AND (delivery_fee = 0 OR delivery_fee IS NULL)
  AND total_amount = subtotal
  AND created_at < '2026-01-01'; -- Adjust date as needed
```

## Related Files

- `supabase/migrations/074_fix_order_completion_conflict.sql`
- `supabase/migrations/075_backfill_delivery_fees_from_total.sql`
- `pages/cashier/orders-queue.js` - Order completion logic
- `pages/cashier/settings.js` - Delivery toggle fix
- `pages/cashier/profile.js` - Removed cashier_id field
- `pages/cashier/eod-report.js` - Displays delivery fees

## Support

If you encounter issues:
1. Check the verification queries above
2. Review Supabase logs for errors
3. Check browser console for client-side errors
4. Refer to troubleshooting section

## Success Criteria

After running these migrations, you should be able to:
- ✅ Click "Order Complete" button without errors
- ✅ See correct delivery fees in EOD Report
- ✅ Toggle delivery feature on/off without errors
- ✅ View and update cashier profile without errors
