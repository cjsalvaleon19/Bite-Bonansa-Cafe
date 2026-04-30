# Running Migration 049: Add Payment Adjustment Type

## What This Migration Does

This migration adds support for tracking payment method adjustments, specifically for cash-to-gcash conversions that need to be reconciled with the GCash app.

### Changes Made
1. Adds `payment_adjustment_type` column to `cash_drawer_transactions` table
2. Adds `reference_order_id` column (TEXT type) to link adjustments to specific orders
3. Creates indexes for efficient querying of adjustments

**Note:** The `reference_order_id` column uses TEXT type to match the `orders.id` column type in the database.

### Use Case
When a customer initially pays cash but the payment is later converted to GCash (e.g., cashier deposits cash and registers it as GCash in the system), this adjustment needs to be tracked for audit and reconciliation purposes.

## How to Run This Migration

### Option 1: Through Supabase Dashboard (Recommended)

1. Log in to your Supabase project dashboard
2. Go to **SQL Editor** in the left sidebar
3. Create a new query
4. Copy the contents of `supabase/migrations/049_add_payment_adjustment_type.sql`
5. Paste into the SQL editor
6. Click **Run** button
7. Verify the migration completed successfully (should show "Success. No rows returned")

### Option 2: Using Supabase CLI

```bash
# Navigate to project root
cd /path/to/Bite-Bonansa-Cafe

# Run the migration
supabase db push
```

## Verification

After running the migration, verify it was successful:

```sql
-- Check if the new columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'cash_drawer_transactions' 
AND column_name IN ('payment_adjustment_type', 'reference_order_id');

-- Should return:
-- payment_adjustment_type | character varying
-- reference_order_id | text
```

## Testing the Feature

1. **Go to Cashier Dashboard**
2. **Click on GCash Sales card** - should show audit report modal
3. **Go to Cash Drawer page**
4. **Click "Adjustment"** button
5. **Create a cash-to-gcash adjustment:**
   - Amount: 100.00
   - Reason: "From Cash to GCash Payment"
   - Reference Number: (GCash reference)
   - Admin Password: (admin password)
6. **Return to Dashboard**
7. **Click on GCash Sales card again**
8. **Verify the adjustment appears** in the "Adjustments" section

## Rollback (if needed)

If you need to undo this migration:

```sql
-- Remove indexes
DROP INDEX IF EXISTS idx_cash_drawer_adjustment_type;
DROP INDEX IF EXISTS idx_cash_drawer_reference_order;

-- Remove columns
ALTER TABLE cash_drawer_transactions 
DROP COLUMN IF EXISTS payment_adjustment_type;

ALTER TABLE cash_drawer_transactions 
DROP COLUMN IF EXISTS reference_order_id;
```

## Notes

- This migration is safe to run on existing databases
- Uses `IF NOT EXISTS` clauses to prevent errors if columns already exist
- Indexes are created only where needed for performance
- No data migration required

## Related Files

- Migration: `supabase/migrations/049_add_payment_adjustment_type.sql`
- Cash Drawer: `pages/cashier/cash-drawer.js`
- Dashboard: `pages/cashier/dashboard.js`
- Documentation: `GCASH_SALES_AUDIT_IMPLEMENTATION.md`
