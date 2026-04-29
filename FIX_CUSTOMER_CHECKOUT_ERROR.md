# Fix: Customer Checkout Error - "value too long for type character varying(3)"

## Problem Description

Customers are experiencing an error when trying to place orders through the customer order interface:

```
Failed to place order: Error: value too long for type character varying(3)
    at eV (page-7905a60f4b7e57bc.js:1:21587)
    at async eG (page-7905a60f4b7e57bc.js:1:20349)
```

Additional errors:
- "Uncaught Could not find element with selector .header-and-quick-actions-mfe-Header--organisation-name-text"
- "Failed to load resource: the server responded with a status of 400 ()"

### Secondary Issue
Orders placed by customers were not appearing in the Cashier's "Pending Online Orders" tab because:
- Customer orders were being created with status = 'order_in_queue'
- Cashier dashboard was looking for orders with status = 'pending'

## Root Cause

The error "value too long for type character varying(3)" is related to the `order_number` column in the `orders` table. 

### Background
- Migration **035_update_order_number_to_3digit.sql** was created to change the order number format from 4-digit (0001-9999) to 3-digit (000-999)
- This migration updates:
  1. The `generate_daily_order_number()` function to return VARCHAR(3)
  2. The `order_number` column type from VARCHAR(10) to VARCHAR(3)
  3. All existing order numbers by taking the last 3 digits

### Why the Error Occurs
The migration may not have been fully applied to the production Supabase database, causing one of these issues:
1. The column is still VARCHAR(10) but there's a constraint causing issues
2. The function is generating values that don't fit in the column
3. There are existing order numbers longer than 3 characters
4. The trigger isn't working correctly

## Solution

This fix includes TWO changes:
1. **Database Fix**: Ensure migration 035 is properly applied (order_number column VARCHAR(3))
2. **Code Fix**: Update customer order status from 'order_in_queue' to 'pending' (already applied to the code)

### Step 1: Diagnose the Issue

Run the diagnostic script to understand the current state of your database:

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `diagnose_order_number_issue.sql`
4. Click "Run"
5. Review the results

The diagnostic script will check:
- Current `order_number` column definition and max length
- Whether the `generate_daily_order_number()` function exists and its return type
- Whether the trigger `trg_set_order_number` exists
- Current order number values and their lengths
- If any order numbers exceed 3 characters
- Test the function to see what it generates

### Step 2: Apply the Fix

Once you've diagnosed the issue, apply the fix:

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `fix_order_number_varchar3_issue.sql`
4. Click "Run"
5. Review the success messages

The fix script will:
- ✓ Update the `generate_daily_order_number()` function to ensure it returns VARCHAR(3)
- ✓ Update the `set_order_number()` trigger function
- ✓ Convert any existing order numbers longer than 3 characters to 3-digit format
- ✓ Alter the `order_number` column to VARCHAR(3)
- ✓ Recreate the trigger
- ✓ Run verification tests

### Step 3: Test

After applying the fix:

1. Go to the customer order portal at `/customer/order`
2. Add items to cart
3. Fill in delivery information
4. Try to place an order
5. Verify that the order is placed successfully

The order should be created with a 3-digit order number (e.g., 000, 001, 002, etc.)

## Expected Behavior After Fix

- ✓ Customers can successfully place orders
- ✓ Order numbers are 3 digits (000-999)
- ✓ Order numbers reset daily at midnight
- ✓ Order numbers are sequential within each day
- ✓ No "value too long" errors
- ✓ Customer orders appear in Cashier's "Pending Online Orders" tab
- ✓ Order status workflow: pending → order_in_process → out_for_delivery → order_delivered

## Additional Notes

### About Order Number Format
- Order numbers are **3 digits** (000-999)
- They **reset daily** at midnight
- They are **auto-generated** by a database trigger
- The code does NOT need to pass `order_number` when inserting orders
- Maximum 1000 orders per day (which should be more than sufficient)

### Migration History
- Migration 017: Created 4-digit order number system (0001-9999)
- Migration 021: Added order_number column as VARCHAR(10)
- Migration 035: Updated to 3-digit order number system (000-999) with VARCHAR(3)

### Why 3 Digits?
The change from 4-digit to 3-digit order numbers was made to:
- Simplify the order numbering system
- Make order numbers easier to communicate verbally
- 999 orders per day is more than sufficient for the business volume
- Maintain daily reset functionality

## Files Included

1. **diagnose_order_number_issue.sql** - Diagnostic script to check current state
2. **fix_order_number_varchar3_issue.sql** - Fix script to apply the migration properly
3. **FIX_CUSTOMER_CHECKOUT_ERROR.md** - This documentation file

## Troubleshooting

### If the fix doesn't work:

1. **Check Supabase permissions**: Ensure you have sufficient permissions to alter tables
2. **Check for active orders**: If orders are being placed while running the script, there might be lock issues
3. **Review error messages**: The script includes detailed RAISE NOTICE messages - review them carefully
4. **Run diagnostic again**: After applying the fix, run the diagnostic script again to verify

### If you see "permission denied" errors:

You need to be logged in as a user with ALTER TABLE permissions. Contact your Supabase project admin.

### If order numbers are still failing:

1. Check if there are any other database triggers or constraints on the orders table
2. Verify that the trigger is active: `SELECT * FROM information_schema.triggers WHERE trigger_name = 'trg_set_order_number';`
3. Check application logs for any explicit order_number values being set in the code

## Prevention

To prevent this issue in the future:
- ✓ Always test migrations in a development environment first
- ✓ Verify migrations are applied before deploying frontend code changes
- ✓ Use the Supabase dashboard to check migration history
- ✓ Consider using Supabase CLI for automated migration management

## Support

If you continue to experience issues after following this guide:
1. Check the browser console for additional error details
2. Check Supabase logs in the Dashboard > Logs section
3. Verify that all migrations up to 035 have been applied
4. Create a GitHub issue with the diagnostic script output

---

**Last Updated**: 2026-04-29
**Related Migrations**: 017, 021, 035
**Affected Files**: 
- `app/customer/order/page.tsx` (status changed from 'order_in_queue' to 'pending')
- `supabase/migrations/035_update_order_number_to_3digit.sql`
- `pages/cashier/dashboard.js` (expects status 'pending' for online orders)
