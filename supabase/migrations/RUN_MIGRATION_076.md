# Migration 076: Track Customer Item Purchases

## Overview
This migration enables the "Most Purchased Items" feature in the customer dashboard by automatically tracking customer purchase history when orders are completed.

## What This Migration Does

1. **Creates Trigger Function**: Adds `track_customer_item_purchases()` function that:
   - Monitors when orders status changes to `order_delivered` or `completed`
   - Parses items from the order's JSONB `items` column
   - Updates `customer_item_purchases` table with purchase count and total spent

2. **Creates Trigger**: Adds `trg_track_customer_purchases` trigger on the `orders` table that fires on INSERT or UPDATE of status

3. **Backfills Data**: Processes all existing completed orders to populate purchase history

## Prerequisites

- Migration 042 must be run first (creates `customer_item_purchases` table)
- Migration 043 must be run (adds missing columns)
- `orders` table must have `items` JSONB column (added in migration 034)

## How to Run

### Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of `076_track_customer_item_purchases.sql`
5. Click **Run** or press `Ctrl+Enter`

### Using Supabase CLI

```bash
# Apply the migration
supabase db push

# Or apply specific migration file
psql $DATABASE_URL -f supabase/migrations/076_track_customer_item_purchases.sql
```

## Verification

After running the migration, verify it worked:

```sql
-- Check if trigger exists
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trg_track_customer_purchases';

-- Check if function exists
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'track_customer_item_purchases';

-- Check if data was backfilled
SELECT 
  COUNT(*) as total_customer_items,
  COUNT(DISTINCT customer_id) as unique_customers,
  SUM(purchase_count) as total_purchases
FROM customer_item_purchases;

-- View sample data
SELECT 
  cip.customer_id,
  u.full_name,
  mi.name as item_name,
  cip.purchase_count,
  cip.total_spent
FROM customer_item_purchases cip
JOIN users u ON u.id = cip.customer_id
JOIN menu_items mi ON mi.id = cip.menu_item_id
ORDER BY cip.purchase_count DESC
LIMIT 10;
```

## Expected Results

- Trigger `trg_track_customer_purchases` should exist on `orders` table
- Function `track_customer_item_purchases` should exist
- `customer_item_purchases` table should have data for all completed orders
- Customer dashboard should now show "Most Purchased Items"

## Testing

1. **Create a test order**:
   - Place an order as a customer
   - Mark it as completed
   - Check if `customer_item_purchases` is updated

2. **Verify dashboard**:
   - Log in as a customer who has completed orders
   - Navigate to customer dashboard
   - "Most Purchased Items" section should show items sorted by purchase count

3. **Test Add to Cart**:
   - Click "Add to Cart" button on a most purchased item
   - If item has variants, variant selection modal should appear
   - After selecting variants, item should be added to cart
   - Item should appear in checkout

## Rollback

If you need to rollback this migration:

```sql
-- Drop the trigger
DROP TRIGGER IF EXISTS trg_track_customer_purchases ON orders;

-- Drop the function
DROP FUNCTION IF EXISTS track_customer_item_purchases();

-- Optionally clear the data (if you want to start fresh)
TRUNCATE TABLE customer_item_purchases;
```

## Notes

- The trigger only processes orders with `customer_id` set
- Orders without `customer_id` (guest orders) are skipped
- The backfill process runs once during migration
- Future orders will be tracked automatically via the trigger
- Purchase counts are cumulative across all orders
- `last_purchased_at` is updated to the most recent order date

## Related Files

- Migration file: `076_track_customer_item_purchases.sql`
- Customer dashboard: `pages/customer/dashboard.js` (lines 160-179, 359-396)
- Variant modal: `components/VariantSelectionModal.js`
- Order page: `app/customer/order/page.tsx`

## Troubleshooting

### Issue: Trigger not firing

**Check**: Verify trigger exists
```sql
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'trg_track_customer_purchases';
```

**Fix**: Recreate trigger by running the migration again

### Issue: Backfill didn't populate data

**Check**: Look for orders with items
```sql
SELECT COUNT(*) 
FROM orders 
WHERE status IN ('order_delivered', 'completed')
  AND customer_id IS NOT NULL
  AND items IS NOT NULL;
```

**Fix**: Run the backfill section of the migration manually

### Issue: Dashboard still shows empty

**Possible causes**:
1. Customer has no completed orders
2. RLS policies blocking data
3. Frontend query issue

**Check RLS policies**:
```sql
SELECT * FROM customer_item_purchases WHERE customer_id = '<customer-uuid>';
```

## Support

If you encounter issues:
1. Check Supabase logs for errors
2. Verify all prerequisite migrations ran successfully
3. Review the verification queries above
4. Check browser console for frontend errors
