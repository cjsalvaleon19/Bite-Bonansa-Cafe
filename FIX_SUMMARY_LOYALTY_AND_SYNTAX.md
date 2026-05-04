# Fix Summary: Loyalty Duplicate Key Error in Orders Queue

## Issues Fixed

### 1. Build Error - Syntax Error in T'boli (COMPLETED ✓)
**Problem:** Build failing due to unescaped apostrophe in "T'boli" location name
**Location:** `app/customer/order/page.tsx` lines 573 and 795
**Solution:** Escaped apostrophes in error messages: `T\'boli`
**Status:** ✅ Fixed and committed

### 2. 409 Duplicate Loyalty Transaction Error (NEEDS MIGRATION)
**Problem:** When cashiers mark items as served, getting 409 error:
```
duplicate key value violates unique constraint "unique_loyalty_per_order"
```

**Root Cause:** 
- Database trigger awards loyalty points when order completes
- If triggered multiple times or constraint missing, causes duplicate error
- Previous migrations (079, 081) had the fix but may not be applied in production

**Solution Implemented:**
1. **Database Migration 082** (`supabase/migrations/082_fix_loyalty_duplicate_error.sql`)
   - Ensures UNIQUE constraint exists on `loyalty_transactions(order_id, transaction_type)`
   - Ensures trigger function uses `ON CONFLICT DO NOTHING`
   - Idempotent - safe to run multiple times

2. **Frontend Error Handling** (`pages/cashier/orders-queue.js`)
   - Gracefully handles duplicate loyalty errors
   - Refreshes orders list even if duplicate error occurs
   - Logs warning instead of showing error to user

**Status:** ⚠️ Code committed, **MIGRATION NEEDS TO BE APPLIED**

## Next Steps

### Required: Apply Migration 082

You must apply the migration to fix the 409 error in production:

**Via Supabase Dashboard (Recommended):**
1. Go to your Supabase project → SQL Editor
2. Open file: `supabase/migrations/082_fix_loyalty_duplicate_error.sql`
3. Copy the entire SQL content
4. Paste into SQL Editor
5. Click "Run"
6. Verify success message appears

**OR Via Supabase CLI:**
```bash
supabase db push
```

See `supabase/migrations/RUN_MIGRATION_082.md` for detailed instructions.

### Verification After Migration

Test the fix:
1. Go to Cashier Orders Queue
2. Find a dine-in or take-out order with multiple items
3. Mark items as served one by one
4. Mark the last item as served (completes the order)
5. Verify NO 409 error appears
6. Check that loyalty points are awarded correctly (only once)

## Files Changed

### Fixed Files
- `app/customer/order/page.tsx` - Escaped apostrophes in T'boli
- `pages/cashier/orders-queue.js` - Added error handling for loyalty duplicates

### New Files
- `supabase/migrations/082_fix_loyalty_duplicate_error.sql` - Database fix
- `supabase/migrations/RUN_MIGRATION_082.md` - Migration instructions
- `FIX_SUMMARY_LOYALTY_AND_SYNTAX.md` - This file

## Technical Details

### Loyalty Points System
- Awarded automatically when order status → `order_delivered`
- Triggered by database trigger `trg_award_loyalty_points_on_order_completion`
- Uses unique constraint to prevent duplicates
- ON CONFLICT DO NOTHING ensures no errors on duplicate attempts

### Error Flow
1. Cashier marks all items as served
2. Frontend updates order status to `order_delivered`
3. Database trigger attempts to award loyalty points
4. If already awarded → constraint prevents duplicate
5. ON CONFLICT clause silently ignores → no error
6. Frontend handles any edge case errors gracefully

## Dependencies

None - this is a standalone fix for two separate issues.

## Rollback Plan

If migration causes issues (unlikely):
1. The migration is idempotent and safe
2. It only adds protections, doesn't change existing data
3. To rollback loyalty trigger (not recommended):
   ```sql
   DROP TRIGGER IF EXISTS trg_award_loyalty_points_on_order_completion ON orders;
   ```

## Support

If issues persist after migration:
1. Check Supabase logs for trigger errors
2. Verify constraint exists:
   ```sql
   SELECT * FROM pg_constraint WHERE conname = 'unique_loyalty_per_order';
   ```
3. Check trigger function includes ON CONFLICT:
   ```sql
   SELECT prosrc FROM pg_proc WHERE proname = 'award_loyalty_points_on_order_completion';
   ```

---

**Created:** 2026-05-04  
**Agent:** GitHub Copilot  
**Branch:** copilot/fix-place-order-button-disabled
