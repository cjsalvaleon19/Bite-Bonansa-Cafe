# Migration 073: Update Loyalty Points Calculation

## Purpose
Updates the loyalty points calculation system to use a new tiered structure:
- **0.2%** for subtotal amounts from ₱1.00 to ₱500.00
- **0.35%** for subtotal amounts ₱501.00 and above

## What This Migration Does

### 1. Replaces Existing Loyalty Points Logic
- Drops any existing `award_loyalty_points_on_order_completion` trigger and function
- Creates a new trigger function with the updated tiered calculation

### 2. New Tiered Calculation System
**Tier 1: ₱1.00 - ₱500.00**
- Points earned = Subtotal × 0.002 (0.2%)
- Example: ₱300.00 order = ₱0.60 points

**Tier 2: ₱501.00 and above**
- Points earned = Subtotal × 0.0035 (0.35%)
- Example: ₱1000.00 order = ₱3.50 points

### 3. How It Works
1. Trigger fires when order status changes to `order_delivered`, `delivered`, or `completed`
2. Only awards points if `customer_id` is present
3. Uses `subtotal` field if available, otherwise calculates from `total_amount - delivery_fee`
4. Determines tier based on subtotal amount
5. Calculates points using appropriate percentage
6. Inserts transaction into `loyalty_transactions` table with:
   - `transaction_type`: 'earned'
   - `amount`: calculated points
   - `balance_after`: updated running balance
   - `description`: Reference to order number

### 4. Database Objects Created
- **Function**: `award_loyalty_points_on_order_completion()`
- **Trigger**: `trg_award_loyalty_points_on_order_completion` on `orders` table

## Prerequisites
- The `loyalty_transactions` table must exist (created in migration 042)
- The `orders` table must have:
  - `customer_id` column
  - `status` column
  - `subtotal` or `total_amount` column
  - `delivery_fee` column (optional)
  - `order_number` column (optional)

## How to Apply

### Option 1: Using Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `073_update_loyalty_points_calculation.sql`
4. Paste into the SQL Editor
5. Click **Run** to execute

### Option 2: Using Supabase CLI
```bash
supabase db push
```

## Verification Queries

### Check if function exists
```sql
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'award_loyalty_points_on_order_completion';
```

### Check if trigger exists
```sql
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trg_award_loyalty_points_on_order_completion';
```

### Test the calculation
```sql
-- Update a test order to completed status (make sure it has a customer_id)
UPDATE orders 
SET status = 'order_delivered'
WHERE id = '<your-test-order-id>' 
  AND customer_id IS NOT NULL;

-- Check if points were awarded
SELECT * FROM loyalty_transactions 
WHERE order_id = '<your-test-order-id>' 
  AND transaction_type = 'earned';
```

## Examples

### Example 1: ₱250.00 Subtotal (Tier 1 - 0.2%)
- Order subtotal: ₱250.00
- Points earned: ₱250.00 × 0.002 = ₱0.50

### Example 2: ₱500.00 Subtotal (Tier 1 - 0.2%)
- Order subtotal: ₱500.00
- Points earned: ₱500.00 × 0.002 = ₱1.00

### Example 3: ₱750.00 Subtotal (Tier 2 - 0.35%)
- Order subtotal: ₱750.00
- Points earned: ₱750.00 × 0.0035 = ₱2.63

### Example 4: ₱1500.00 Subtotal (Tier 2 - 0.35%)
- Order subtotal: ₱1500.00
- Points earned: ₱1500.00 × 0.0035 = ₱5.25

## Impact on Existing Data
- This migration only affects **future** orders completed after the migration is applied
- Existing loyalty transactions in the `loyalty_transactions` table are **not** modified
- Past orders that were already completed will not be recalculated

## Rollback
If you need to revert this migration:

```sql
-- Drop the new trigger and function
DROP TRIGGER IF EXISTS trg_award_loyalty_points_on_order_completion ON orders;
DROP FUNCTION IF EXISTS award_loyalty_points_on_order_completion();

-- If you had a previous version, you would need to recreate it here
```

## Related Files
- **Migration**: `supabase/migrations/073_update_loyalty_points_calculation.sql`
- **Loyalty Table**: Created in `supabase/migrations/042_create_missing_loyalty_and_purchase_tables.sql`

## Notes
- Points are rounded to 2 decimal places
- The function uses `RAISE NOTICE` for logging - check PostgreSQL logs to see when points are awarded
- The trigger only fires on `UPDATE` operations (not `INSERT`)
- The function checks both `OLD.status` and `NEW.status` to ensure points are only awarded once
- If an order doesn't have a `subtotal` field, it calculates it from `total_amount - delivery_fee`

---

**Migration File**: `supabase/migrations/073_update_loyalty_points_calculation.sql`  
**Status**: Ready to apply  
**Date**: May 3, 2026
