# Rider Interface - Complete Implementation Guide

## Overview
The Rider's Interface has been fully implemented for the Bite Bonansa Cafe application. This interface is designed exclusively for riders to manage their delivery assignments, track earnings, and bill cashiers for their services.

## Rider Login Credentials
**Rider emails with access:**
- johndave0991@bitebonansacafe.com
- rider@youremail.com

Both emails are mapped to the 'rider' role and can access the Rider Dashboard.

## Interface Components

### 1. Dashboard (`/rider/dashboard`)

The main dashboard provides an at-a-glance view of the rider's daily activities and earnings.

#### Features:
- **Total Number of Deliveries** (Clickable)
  - Shows the count of deliveries completed today
  - **Links to Billing Portal** when clicked
  - Allows rider to view details and billing amounts
  
- **Pending Deliveries** (Clickable)
  - Shows total number of pending orders assigned to the rider
  - **Links to Order Portal** when clicked
  - Only counts orders in 'pending' status (not yet accepted)
  
- **Total Earnings for the Day**
  - Displays rider's income for the current day
  - Calculates **60% of the total delivery fees** from completed deliveries today
  - Automatically updates as deliveries are completed
  - Shows breakdown: "60% of delivery fees"

#### Quick Navigation Cards:
- Order Portal - Accept and manage delivery orders
- Billing Portal - Submit delivery fee billing reports
- My Profile - Update driver information

### 2. Order Portal (`/rider/deliveries`)

The Order Portal displays the list of orders confirmed by the Cashier and assigned to the specific rider.

#### Workflow:

**Step 1: Accept Order**
- Rider sees orders with status 'pending'
- Clicks **"Accept Order"** button to view delivery details
- Displays customer information:
  - Customer name
  - Customer phone
  - Delivery address
  - Distance to customer
  - Delivery fee
  - Special instructions

**Step 2: View Delivery Details & Navigation**
- After accepting, delivery status becomes 'accepted'
- **Direction Features** (Waze-like):
  - "Open in Google Maps (Directions)" link appears
  - Provides turn-by-turn navigation from store location to customer's pinned location
  - Uses Google Maps Directions API
  - Works on mobile devices just like Waze app
  
**Step 3: Start Delivery**
- Rider clicks **"Start Delivery"** button
- Status changes to 'in_progress'
- Order status updates to 'out_for_delivery' in Customer and Cashier interfaces

**Step 4: Complete Delivery**
- Upon reaching customer and completing delivery
- Rider clicks **"Order Delivered"** button
- Status changes to:
  - Delivery: 'completed'
  - Order: 'order_delivered' (visible in Customer and Cashier interfaces)
- Delivery is considered closed
- Details can no longer be edited once billed and paid

#### Filtering Options:
- Active Deliveries - Shows pending, accepted, and in-progress deliveries
- Completed - Shows completed deliveries
- All Deliveries - Shows all deliveries

### 3. Billing Portal (`/rider/reports`)

The Billing Portal allows riders to submit billing reports for completed deliveries and track payment status.

#### Tab 1: Pending Deliveries

**List of Orders Catered for the Day:**
- Shows all completed deliveries from the current day
- Deliveries that haven't been submitted for billing yet
- Each delivery shows:
  - Order ID
  - Customer address
  - Completion timestamp
  - Delivery fee

**Financial Breakdown:**
- **Total Deliveries:** Number of selected deliveries
- **Total Delivery Fees:** Sum of all delivery fees from selected deliveries (100%)
- **Business Revenue:** 40% of total delivery fees
- **Billable Rider's Fee:** **60% of total delivery fees** (highlighted)

**"Bill to Cashier" Button:**
- Submits the billing report to the system
- Creates an **automated notification** for all cashiers
- Notification includes:
  - Rider name
  - Total amount billable to rider (60%)
  - Total delivery fees collected (100%)
- Deliveries are marked as 'report_submitted'
- Report is moved to "Submitted Reports" tab

#### Tab 2: Submitted Reports

**Report History:**
- Shows submitted reports (last 10)
- Each report displays:
  - Submission date and time
  - Number of deliveries
  - Total delivery fees
  - Rider earnings (60%)
  - Payment status
  - Payment timestamp (if paid)

**Status Indicators:**
- ⏳ **SUBMITTED** - Waiting for cashier payment
- ✅ **PAID** - Payment received, report locked

**Locked Reports:**
- Once marked as PAID by cashier
- Report cannot be reused to claim fees again
- Details cannot be edited
- Shows "🔒 This report has been paid" message
- Stamped as "PAID" with payment timestamp

#### Payment Settlement Integration:

**Cashier's Side:**
1. Cashier receives notification about new delivery report
2. Cashier can view report details
3. Cashier processes payment through **Cash Drawer → Cash Out Tab → Pay Bills**
4. System calls `/api/delivery-reports/[id]/pay` endpoint
5. Report status updated to 'paid'
6. Rider receives payment notification

**Automated Actions on Payment:**
- Rider's `total_earnings` is updated (incremented by rider_earnings amount)
- All deliveries in the report are marked as `report_paid = true`
- Rider receives notification: "💰 Payment Received"
- Report is locked and cannot be modified

### 4. My Profile (`/rider/profile`)

The Profile page allows riders to manage their personal and professional information.

#### Required Fields:

**Personal Information:**
- **Driver's Name** ⭐
  - Linked to "Create an Account" features
  - Synced with user's full_name in users table
  
- **Driver ID Number** ⭐
  - Must be unique (enforced by database)
  - Required field with validation
  - Cannot save profile without it
  
- **Cellphone Number**
  - Primary contact number
  - Linked to "Create an Account" features
  
- **Phone Number**
  - Alternate contact number
  
- **Email** (Read-only)
  - Displays user's registered email
  - Cannot be changed from profile page

**Vehicle Information:**
- **Vehicle Type**
  - Dropdown options:
    - Motorcycle
    - Scooter
    - Bicycle
    - Car
  
- **Plate Number**
  - Vehicle plate number

**Emergency Contact:**
- Emergency Contact Name
- Emergency Contact Phone

**Availability Status:**
- Toggle: "I am currently available for deliveries"
- When enabled: Rider receives new delivery assignments
- When disabled: Rider does not receive new assignments

**Password Management:**
- **Show/Hide Toggle Button**
  - "🔓 Change Password" - Click to reveal password fields
  - "🔒 Hide Password Section" - Click to hide
  
- **Password Update Fields** (Visible only when section expanded):
  - New Password (minimum 6 characters)
  - Confirm New Password
  - "🔑 Update Password" button
  - Validates password match and minimum length
  - Updates via Supabase Auth
  - Password fields are hidden until button is clicked

## Database Schema

### Tables Created

#### 1. `riders` Table
```sql
- id (UUID, primary key)
- user_id (UUID, unique, references users)
- driver_id (VARCHAR, unique) -- Required unique driver ID
- vehicle_type (VARCHAR)
- vehicle_plate (VARCHAR)
- cellphone_number (VARCHAR)
- emergency_contact (VARCHAR)
- emergency_phone (VARCHAR)
- is_available (BOOLEAN)
- total_earnings (DECIMAL)
- deliveries_completed (INT)
- created_at, updated_at (TIMESTAMP)
```

#### 2. `deliveries` Table
```sql
- id (UUID, primary key)
- order_id (UUID, unique, references orders)
- rider_id (UUID, references users)
- customer_name, customer_phone, customer_address
- customer_latitude, customer_longitude (DECIMAL)
- delivery_fee (DECIMAL)
- distance_meters (INT)
- status (VARCHAR) -- pending, accepted, in_progress, completed, cancelled
- report_submitted, report_paid (BOOLEAN)
- report_submitted_at, report_paid_at (TIMESTAMP)
- accepted_at, started_at, completed_at (TIMESTAMP)
- special_instructions, delivery_notes (TEXT)
```

#### 3. `delivery_reports` Table
```sql
- id (UUID, primary key)
- rider_id (UUID, references users)
- report_date (DATE)
- total_deliveries (INT)
- delivery_ids (UUID[]) -- Array of delivery IDs
- total_delivery_fees (DECIMAL) -- 100%
- rider_earnings (DECIMAL) -- 60%
- business_revenue (DECIMAL) -- 40%
- status (VARCHAR) -- submitted, paid, cancelled
- submitted_at, paid_at (TIMESTAMP)
- paid_by (UUID, references users) -- Cashier who paid
```

### Database Triggers

1. **`trigger_update_rider_earnings`**
   - Fires when delivery_reports.status changes to 'paid'
   - Updates rider's total_earnings
   - Marks deliveries as paid
   - Creates payment notification for rider

2. **`trigger_update_delivery_count`**
   - Fires when delivery.status changes to 'completed'
   - Increments rider's deliveries_completed counter

3. **`trigger_notify_cashiers`**
   - Fires when new delivery_report is inserted
   - Creates notifications for all cashiers
   - Includes rider name and earning amounts

### Row Level Security (RLS)

All tables have RLS enabled with appropriate policies:
- Riders can view/update only their own data
- Staff (admin, cashier) can view all rider data
- Paid reports cannot be updated by riders
- Secure access based on authenticated user

## API Endpoints

### POST `/api/delivery-reports/[id]/pay`

**Purpose:** Cashier payment processing for delivery reports

**Authorization:** Cashier or Admin role required

**Request:**
- Headers: `Authorization: Bearer <token>`
- URL param: Report ID

**Actions:**
1. Validates cashier authorization
2. Checks report exists and is submitted (not already paid)
3. Updates report status to 'paid'
4. Records payment timestamp and cashier ID
5. Triggers automatic updates via database trigger:
   - Updates rider's total earnings
   - Marks deliveries as paid
   - Creates notification for rider

**Response:**
```json
{
  "success": true,
  "message": "Report marked as paid successfully",
  "report": {
    "id": "uuid",
    "status": "paid",
    "rider_earnings": 300.00
  }
}
```

## Complete Workflow Example

### End-to-End Delivery Process

1. **Order Placement**
   - Customer places order with delivery option
   - Cashier confirms order

2. **Assignment**
   - Cashier assigns order to rider
   - Creates delivery record with status 'pending'

3. **Rider Accepts** (`/rider/deliveries`)
   - Rider sees order in Order Portal
   - Clicks "Accept Order"
   - Status: delivery='accepted', order='out_for_delivery'

4. **Start Delivery**
   - Rider clicks "Start Delivery"
   - Status: delivery='in_progress'
   - Uses Google Maps for directions

5. **Complete Delivery**
   - Rider clicks "Order Delivered"
   - Status: delivery='completed', order='order_delivered'
   - Visible to Customer and Cashier

6. **Submit Billing** (`/rider/reports`)
   - Rider goes to Billing Portal
   - Selects completed deliveries from today
   - Reviews financial breakdown
   - Clicks "Bill to Cashier"
   - Report created with status 'submitted'
   - Notifications sent to all cashiers

7. **Cashier Payment**
   - Cashier receives notification
   - Reviews report details
   - Processes payment via Cash Drawer
   - Calls payment API

8. **Payment Completion**
   - Report status: 'paid'
   - Rider's total_earnings updated
   - Deliveries marked as paid
   - Rider receives payment notification
   - Report locked (cannot be reused)

## Commission Structure

**60/40 Split:**
- **Rider Earnings:** 60% of delivery fee
- **Business Revenue:** 40% of delivery fee

**Example:**
- Delivery Fee: ₱100
- Rider's Fee: ₱60 (60%)
- Business Revenue: ₱40 (40%)

**Multiple Deliveries Example:**
- 5 deliveries × ₱100 each = ₱500 total
- Rider's Fee: ₱300 (60%)
- Business Revenue: ₱200 (40%)

## Status Values

### Delivery Status Flow
1. `pending` → Order assigned to rider (not yet accepted)
2. `accepted` → Rider accepted the order
3. `in_progress` → Rider started delivery (en route)
4. `completed` → Delivery completed successfully
5. `cancelled` → Delivery cancelled

### Order Status Integration
- `out_for_delivery` → When rider accepts/starts delivery
- `order_delivered` → When rider marks as delivered

### Report Status
- `submitted` → Report submitted, waiting for payment
- `paid` → Cashier processed payment, locked
- `cancelled` → Report cancelled

## Security Features

1. **Row Level Security (RLS)**
   - All sensitive tables have RLS enabled
   - User can only access their own data
   
2. **Role Validation**
   - API endpoints verify user roles
   - Only cashiers/admins can process payments
   
3. **Token Authentication**
   - All API calls require valid auth token
   - Secure session management
   
4. **Unique Constraints**
   - Driver ID must be unique
   - One report per rider per day
   
5. **Immutable Records**
   - Paid reports cannot be modified
   - Prevents double-claiming
   
6. **Audit Trail**
   - Timestamps for all status changes
   - Records who paid each report

## File Structure

```
pages/
├── rider/
│   ├── dashboard.js      # Main dashboard with stats and navigation
│   ├── deliveries.js     # Order Portal - delivery management
│   ├── reports.js        # Billing Portal - report submission
│   └── profile.js        # My Profile - rider information

pages/api/
└── delivery-reports/
    └── [id]/
        └── pay.js        # Payment processing API

supabase/migrations/
└── 050_create_rider_portal_tables.sql  # Database setup
```

## Migration Instructions

To set up the Rider Portal in your Supabase database:

1. Run migration 050:
   ```bash
   psql -d your_database -f supabase/migrations/050_create_rider_portal_tables.sql
   ```
   OR use Supabase Dashboard → SQL Editor

2. Verify tables are created:
   - riders
   - deliveries
   - delivery_reports

3. Verify triggers are installed:
   - trigger_update_rider_earnings
   - trigger_update_delivery_count
   - trigger_notify_cashiers

4. Test RLS policies are working

## Testing Checklist

- [ ] Register rider account with email: johndave0991@bitebonansacafe.com
- [ ] Complete rider profile with unique driver ID
- [ ] Verify Dashboard stats display correctly
- [ ] Test Dashboard card links (Pending Deliveries → Order Portal, Total Deliveries → Billing Portal)
- [ ] Accept a delivery order from Order Portal
- [ ] Test Google Maps directions link
- [ ] Mark delivery as completed (verify status in Customer & Cashier interfaces)
- [ ] Go to Billing Portal and select completed delivery
- [ ] Submit billing report (verify cashier receives notification)
- [ ] Have cashier process payment
- [ ] Verify rider receives payment notification
- [ ] Verify report is locked and cannot be reused
- [ ] Test password update functionality
- [ ] Verify all profile fields save correctly

## Conclusion

The Rider's Interface is fully implemented with all features from the requirements:

✅ Dashboard with daily delivery count (linked to Billing Portal)
✅ Dashboard with pending deliveries (linked to Order Portal)  
✅ Dashboard with today's earnings (60% of delivery fees)
✅ Order Portal with Accept Order workflow
✅ Google Maps integration (Waze-like navigation)
✅ Order Delivered button with status propagation
✅ Billing Portal with daily deliveries list
✅ 60% commission calculation and display
✅ Bill to Cashier functionality
✅ Automated notification system
✅ Payment settlement workflow
✅ Locked/PAID status after payment
✅ My Profile with all required fields
✅ Password management (show/hide, update)
✅ Database migration with tables and triggers
✅ Row Level Security policies
✅ Complete end-to-end workflow
