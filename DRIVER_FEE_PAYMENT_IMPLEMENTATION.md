# Driver's Fee Payment System Implementation

## Overview
This document describes the implementation of the Driver's Fee payment system that allows cashiers to pay riders for their submitted billable delivery fees through the Cash Drawer Management interface.

## Features Implemented

### 1. Database Changes (Migration 072)

#### Added Columns
- **`delivery_reports.bill_number`**: VARCHAR(20) UNIQUE
  - Auto-generated unique bill number in format `YYMMDD-####`
  - Example: `260503-0001` (May 3, 2026, sequence 1)
  - Sequential across all delivery reports regardless of rider

- **`cash_drawer_transactions.bill_report_id`**: UUID (Foreign Key to delivery_reports.id)
  - Links payment transaction to specific delivery report
  - Enables tracking which cashier paid which report

#### Bill Number Generation
- **Function**: `generate_bill_number()`
  - Returns unique bill number in YYMMDD-#### format
  - Sequence resets daily
  - Handles concurrent inserts safely
  
- **Trigger**: `auto_generate_bill_number`
  - Fires BEFORE INSERT on delivery_reports
  - Automatically assigns bill number if not provided

#### Updated Notification System
- Modified `update_rider_earnings()` trigger function
- Notification now includes bill number instead of just date
- Example: "Your delivery report 260503-0001 has been paid. Amount: ₱18.00"

### 2. Rider Interface Changes

#### Bill Number Display
**File**: `pages/rider/reports.js`

- Submitted reports list shows bill number prominently
  - Title: "Bill #260503-0001" (instead of "Report #abc12345")
  - Bill number displayed in report details
  
- Report details modal shows:
  - Bill number in header
  - Bill number in summary section
  - All delivery line items included in the bill

### 3. Cashier Interface Changes

#### Pay Bills Form Enhancement
**File**: `pages/cashier/cash-drawer.js`

**New Bill Type**: "Driver's Fee"
- Added to Bill Type dropdown as first option
- Triggers specialized payment workflow

**Driver's Fee Payment Workflow**:

1. **Select Bill Type**: Choose "Driver's Fee" from dropdown

2. **Select Rider (Payee)**:
   - Dropdown populated with all riders from users table
   - Shows rider's full name or email
   - On selection, filters available bills for that rider only

3. **Select Bill Number**:
   - Only appears after rider is selected
   - Shows outstanding (unpaid) bills for selected rider
   - Format: `260503-0001 - ₱18.00 (5/3/2026)`
   - Only shows reports with status='submitted' or 'pending'
   - If no outstanding bills: "No outstanding bills for this rider"

4. **Auto-Fill on Bill Selection**:
   - **Amount**: Auto-filled with `rider_earnings` from selected report
   - **Purpose/Description**: Auto-filled with details:
     ```
     Payment for 5 deliveries on 5/3/2026. Bill: 260503-0001
     ```
   - Both fields become read-only to prevent tampering

5. **Submit Payment**:
   - Creates cash_drawer_transactions record with bill_report_id
   - Updates delivery_reports:
     - status → 'paid'
     - paid_at → current timestamp
     - paid_by → cashier's user_id
   - Trigger sends notification to rider
   - Updates rider's total_earnings
   - Marks all deliveries in report as paid

#### State Management
New state variables:
- `riders`: List of all riders
- `deliveryReports`: All unpaid delivery reports
- `filteredReports`: Reports filtered by selected rider
- `formData.billNumber`: Selected report ID
- `formData.billReportId`: Report ID to link in transaction

#### Helper Functions
- `fetchRiders()`: Loads all riders from users table
- `fetchDeliveryReports()`: Loads unpaid reports with rider names
- `handlePayeeChange(riderId)`: Filters reports by rider
- `handleBillNumberChange(reportId)`: Auto-fills amount and purpose

### 4. Payment Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Rider completes deliveries                                   │
│    - Deliveries marked as completed                             │
│    - report_submitted = false                                   │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Rider submits billing report (pages/rider/reports.js)        │
│    - Selects completed deliveries                               │
│    - Clicks "Submit Report"                                     │
│    - delivery_reports record created                            │
│    - Bill number auto-generated: 260503-0001                    │
│    - status = 'submitted'                                       │
│    - Notification sent to all cashiers                          │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Cashier pays driver fee (pages/cashier/cash-drawer.js)       │
│    - Opens Cash Drawer → Cash Out → Pay Bills                   │
│    - Selects Bill Type: "Driver's Fee"                          │
│    - Selects Rider from dropdown                                │
│    - Selects Bill Number (260503-0001)                          │
│    - Amount and Purpose auto-filled                             │
│    - Clicks Submit                                              │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. System processes payment                                     │
│    a. Insert into cash_drawer_transactions                      │
│       - transaction_type = 'pay-bill'                           │
│       - bill_type = 'drivers_fee'                               │
│       - bill_report_id = <report UUID>                          │
│       - amount = rider_earnings                                 │
│                                                                  │
│    b. Update delivery_reports                                   │
│       - status = 'paid'                                         │
│       - paid_at = NOW()                                         │
│       - paid_by = <cashier UUID>                                │
│                                                                  │
│    c. Trigger: update_rider_earnings()                          │
│       - Updates riders.total_earnings                           │
│       - Marks deliveries as report_paid = true                  │
│       - Sends notification to rider                             │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Rider receives notification                                  │
│    - "💰 Payment Received"                                       │
│    - "Your delivery report 260503-0001 has been paid.           │
│       Amount: ₱18.00"                                            │
│    - Report status changes to PAID in reports tab               │
└─────────────────────────────────────────────────────────────────┘
```

### 5. Key Business Rules

1. **One-Time Payment**: Each bill number can only be paid once
   - UNIQUE constraint on bill_number prevents duplicates
   - Status transition (submitted → paid) is irreversible
   - Paid reports excluded from bill number dropdown

2. **Sequential Bill Numbers**: 
   - Format: YYMMDD-#### (daily sequence)
   - Sequential across all riders
   - Never reused

3. **Auto-Fill Protection**:
   - Amount and Purpose fields are read-only when bill selected
   - Prevents manual tampering with payment amounts
   - Ensures payment matches submitted report exactly

4. **Outstanding Bills Only**:
   - Only submitted/pending reports appear in bill selection
   - Paid reports immediately removed from list
   - Per-rider filtering for easy navigation

5. **Notification Tracking**:
   - Cashiers notified when report submitted
   - Riders notified when report paid
   - Both notifications include bill number for reference

## Database Schema

### delivery_reports
```sql
CREATE TABLE delivery_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES users(id),
  bill_number VARCHAR(20) UNIQUE,                    -- NEW
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_deliveries INT NOT NULL DEFAULT 0,
  delivery_ids UUID[],
  total_delivery_fees DECIMAL(10,2) NOT NULL DEFAULT 0,
  rider_earnings DECIMAL(10,2) NOT NULL DEFAULT 0,   -- 60% commission
  business_revenue DECIMAL(10,2) NOT NULL DEFAULT 0, -- 40% revenue
  status VARCHAR(50) NOT NULL DEFAULT 'submitted',   -- 'submitted', 'paid'
  submitted_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP,
  paid_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(rider_id, report_date)
);
```

### cash_drawer_transactions
```sql
CREATE TABLE cash_drawer_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id UUID NOT NULL REFERENCES users(id),
  transaction_type VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  payee_name VARCHAR(255),
  purpose TEXT,
  category VARCHAR(100),
  reference_number VARCHAR(100),
  adjustment_reason VARCHAR(255),
  bill_id UUID,
  bill_type VARCHAR(50),                             -- includes 'drivers_fee'
  bill_report_id UUID REFERENCES delivery_reports(id), -- NEW
  payment_adjustment_type VARCHAR(50),
  admin_verified BOOLEAN DEFAULT FALSE,
  admin_user_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Testing Checklist

### Database Migration
- [ ] Run migration 072 on development database
- [ ] Verify bill_number column added to delivery_reports
- [ ] Verify bill_report_id column added to cash_drawer_transactions
- [ ] Test bill number generation function
- [ ] Verify trigger auto-generates bill numbers on insert
- [ ] Test backfill of existing reports (if any)

### Rider Interface
- [ ] Submit a new delivery report
- [ ] Verify bill number is generated (format: YYMMDD-####)
- [ ] Check bill number appears in reports list
- [ ] Open report details modal, verify bill number shown
- [ ] Verify notification sent to cashiers

### Cashier Interface
- [ ] Open Cash Drawer → Cash Out → Pay Bills
- [ ] Verify "Driver's Fee" appears in Bill Type dropdown
- [ ] Select "Driver's Fee" bill type
- [ ] Verify rider dropdown appears with all riders
- [ ] Select a rider
- [ ] Verify Bill Number dropdown appears with rider's outstanding bills
- [ ] Select a bill number
- [ ] Verify Amount auto-fills with correct rider_earnings
- [ ] Verify Purpose auto-fills with bill details
- [ ] Verify Amount and Purpose fields are read-only
- [ ] Submit payment
- [ ] Verify success message
- [ ] Verify report no longer appears in bill list (paid)

### End-to-End Flow
- [ ] Rider submits report → bill number generated
- [ ] Cashier receives notification
- [ ] Cashier pays bill through Cash Drawer
- [ ] Rider receives payment notification
- [ ] Report status changes to "PAID" in rider interface
- [ ] Paid bill excluded from future cashier bill searches
- [ ] riders.total_earnings updated correctly
- [ ] deliveries.report_paid set to true for all deliveries in report

### Edge Cases
- [ ] Multiple riders with reports on same day
- [ ] Bill number sequence increments correctly
- [ ] Cannot pay same bill twice
- [ ] Rider with no outstanding bills shows appropriate message
- [ ] Form validation when required fields empty
- [ ] Concurrent bill submissions generate unique numbers

## Files Modified

1. **supabase/migrations/072_add_bill_number_to_delivery_reports.sql**
   - New migration file for database changes

2. **pages/rider/reports.js**
   - Display bill numbers in report cards (lines 463-474)
   - Display bill numbers in modal header (lines 522-537)

3. **pages/cashier/cash-drawer.js**
   - Added state for riders, deliveryReports, filteredReports (lines 29-31)
   - Added billNumber and billReportId to formData (lines 26-27)
   - Added fetchRiders() function (lines 77-90)
   - Added fetchDeliveryReports() function (lines 92-119)
   - Added handlePayeeChange() function (lines 138-146)
   - Added handleBillNumberChange() function (lines 148-163)
   - Updated handleSubmit to process driver fee payments (lines 271-292)
   - Added Driver's Fee UI in Pay Bills form (lines 546-641)

## Migration Instructions

1. **Apply Database Migration**:
   ```sql
   -- Run in Supabase SQL Editor
   -- File: supabase/migrations/072_add_bill_number_to_delivery_reports.sql
   ```

2. **Deploy Frontend Changes**:
   ```bash
   git pull origin main
   npm install  # if dependencies changed
   npm run build
   npm start
   ```

3. **Verify Deployment**:
   - Check rider can submit reports and see bill numbers
   - Check cashier can see Driver's Fee option
   - Test complete payment flow

## Future Enhancements

1. **Bill History**: Add view for cashier to see all paid driver fees
2. **Bulk Payment**: Allow paying multiple bills at once
3. **Payment Report**: Generate summary of all driver payments for accounting
4. **Bill Export**: Export bill details to CSV/PDF for records
5. **Payment Approval**: Add approval workflow for large payments
6. **Bill Disputes**: Add mechanism for riders to dispute bill amounts
7. **Auto-Payment**: Schedule automatic payments on specific dates

## Support

For issues or questions:
- Check migration logs in Supabase dashboard
- Review browser console for frontend errors
- Check notifications table for delivery of payment alerts
- Verify RLS policies allow cashiers to update delivery_reports

---

**Implementation Date**: May 3, 2026  
**Migration Number**: 072  
**Status**: ✅ Complete and Ready for Testing
