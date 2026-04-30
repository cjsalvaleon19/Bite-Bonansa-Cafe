# GCash Sales Audit Report Implementation

## Overview

This feature adds a comprehensive GCash Sales audit report to the Cashier Dashboard, allowing cashiers to reconcile all GCash transactions with their GCash app. The report includes both regular GCash sales and payment adjustments (cash-to-gcash conversions).

## Features Implemented

### 1. Clickable GCash Sales Card
- The GCash Sales card on the dashboard is now clickable
- Shows a hint: "💡 Click for audit report"
- Clicking opens a detailed modal with transaction breakdown

### 2. GCash Transactions Table
The modal displays all GCash sales for the day with:
- **Order Number**: For easy reference
- **Time**: When the transaction occurred
- **Customer Name**: Who made the purchase
- **GCash Reference**: The reference number provided by customer
- **Total Amount**: Complete order amount
- **Points Used**: If points were used (for points+gcash payments)
- **GCash Paid**: Actual amount received via GCash (Total - Points)

### 3. Adjustments Table
A separate section showing payment method conversions:
- **Cash-to-GCash conversions**: When cash payments are later registered as GCash
- **Time**: When the adjustment was made
- **Cashier**: Who made the adjustment
- **Description/Reason**: Why the adjustment was made
- **Reference Number**: GCash reference for the conversion
- **Amount**: The adjusted amount

### 4. Summary Section
At the bottom of the modal:
- **Total GCash from Sales**: Sum of all GCash payments from orders
- **Total Adjustments**: Sum of all cash-to-gcash conversions
- **Expected in GCash App**: Combined total to reconcile with GCash app

## Database Changes

### Migration 049: Add Payment Adjustment Type
File: `supabase/migrations/049_add_payment_adjustment_type.sql`

**New Columns:**
1. `payment_adjustment_type` (VARCHAR(50))
   - Tracks the type of adjustment
   - Values: 'cash-to-gcash', 'gcash-to-cash', 'correction', etc.

2. `reference_order_id` (TEXT)
   - Links adjustment to original order if applicable
   - Foreign key to `orders.id`
   - **Note:** Uses TEXT type to match the orders.id column type

**Indexes:**
- `idx_cash_drawer_adjustment_type`: For filtering by adjustment type
- `idx_cash_drawer_reference_order`: For order reference lookups

## Code Changes

### 1. Dashboard (`pages/cashier/dashboard.js`)

**New State Variables:**
```javascript
const [showGCashReport, setShowGCashReport] = useState(false);
const [gcashTransactions, setGCashTransactions] = useState([]);
const [gcashAdjustments, setGCashAdjustments] = useState([]);
```

**New Function:**
```javascript
const fetchGCashTransactions = async () => {
  // Fetches all GCash orders for today
  // Fetches all cash-to-gcash adjustments
}
```

**UI Changes:**
- Made GCash Sales card clickable
- Added comprehensive modal with tables
- Styled for easy reading and audit purposes

### 2. Cash Drawer (`pages/cashier/cash-drawer.js`)

**Updated:**
- Enhanced adjustment submission to set `payment_adjustment_type = 'cash-to-gcash'` when reason is 'payment_correction'
- This ensures adjustments appear in the GCash audit report

**Existing Feature Used:**
- Adjustment modal already has "From Cash to GCash Payment" option
- Now properly tracked with new field

## Usage Workflow

### Creating a Cash-to-GCash Adjustment

1. **Navigate to Cash Drawer** (`/cashier/cash-drawer`)
2. **Click "Adjustment"** button
3. **Fill in the form:**
   - Amount: The amount being converted
   - Reference Number: The GCash reference number
   - Reason: Select "From Cash to GCash Payment"
   - Description: Additional details (optional)
   - Admin Password: Required for verification
4. **Submit** the adjustment

### Viewing GCash Audit Report

1. **Navigate to Cashier Dashboard** (`/cashier/dashboard`)
2. **Click on the GCash Sales card** (shows current total)
3. **Review the modal:**
   - Check all GCash transactions
   - Verify reference numbers match GCash app
   - Review any adjustments made
   - Compare "Expected in GCash App" total with actual balance

### Reconciliation Process

1. Open GCash app on phone
2. Open GCash Audit Report in dashboard
3. Match each transaction by:
   - Reference number
   - Amount
   - Time
4. Verify totals match:
   - Dashboard shows: Total GCash from Sales + Total Adjustments
   - GCash app shows: Today's received amount
5. Investigate any discrepancies

## Benefits

### For Audit and Compliance
- ✅ Complete transaction trail
- ✅ All GCash reference numbers in one place
- ✅ Adjustment tracking with admin verification
- ✅ Daily reconciliation made easy

### For Cash Management
- ✅ Clear separation of sales vs adjustments
- ✅ Easy to spot cash-to-gcash conversions
- ✅ Total expected balance clearly displayed

### For Operations
- ✅ Quick access from dashboard
- ✅ No need to export or check multiple reports
- ✅ Real-time data (today's transactions)
- ✅ Print-friendly modal for records

## Styling

The modal uses a dark theme consistent with the dashboard:
- **Wide modal**: 900px max width for better table display
- **Scrollable**: For many transactions
- **Color coding**:
  - Yellow (#ffc107): Headers, totals, important values
  - Gray (#ccc): Regular data
  - Dark backgrounds: #1a1a1a, #2a2a2a
- **Clear sections**: Separated by borders and spacing
- **Responsive tables**: Scroll horizontally on small screens

## Future Enhancements (Potential)

1. **Date Range Selection**: View GCash report for any date
2. **Export to CSV**: Download for accounting software
3. **Mismatch Alerts**: Automatic detection of discrepancies
4. **GCash API Integration**: Automatic reconciliation
5. **Multiple Adjustment Types**: Support more conversion types
6. **Order Reference Links**: Click to see full order details

## Files Modified

1. `pages/cashier/dashboard.js` - Main implementation
2. `pages/cashier/cash-drawer.js` - Adjustment tracking
3. `supabase/migrations/049_add_payment_adjustment_type.sql` - Database schema
4. `supabase/migrations/RUN_MIGRATION_049.md` - Migration guide

## Testing Checklist

- [x] Migration runs successfully
- [x] GCash Sales card is clickable
- [x] Modal opens and displays correctly
- [x] GCash transactions fetch and display
- [x] Adjustments fetch and display
- [x] Totals calculate correctly
- [x] Modal closes properly
- [x] Cash drawer can create adjustments
- [x] Adjustments appear in audit report
- [x] Styling is consistent with dashboard
- [x] Works on different screen sizes

## Known Limitations

1. **Today Only**: Report only shows today's data (can be enhanced)
2. **Manual Reconciliation**: Cashier must manually compare with GCash app
3. **No Automated Alerts**: Discrepancies must be noticed manually

## Support

For issues or questions:
1. Check migration ran successfully
2. Verify GCash transactions have reference numbers
3. Ensure adjustments use correct reason ("From Cash to GCash Payment")
4. Check browser console for errors

---

**Date Implemented**: April 30, 2026  
**Version**: 1.0  
**Status**: ✅ Complete and Ready for Use
