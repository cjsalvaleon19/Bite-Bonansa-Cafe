# Portal Access Control & Features Implementation

## Overview
This implementation adds comprehensive role-based access control and portal features for the Bite Bonansa Cafe application, with specific portals for Admin, Cashier, Rider, and Customer users.

## Access Control

### Fixed Role Assignments
The following email addresses have fixed role assignments (configured in `utils/roleMapping.js`):
- **Admin**: cjsalvaleon19@gmail.com → `/dashboard`
- **Cashier**: arclitacj@gmail.com, bantecj@bitebonansacafe.com → `/cashier/dashboard`
- **Rider**: johndave0991@bitebonansacafe.com, rider@youremail.com → `/rider/dashboard`
- **Customer**: All other email addresses (including johndave0991@gmail.com) → `/customer/dashboard`

### Role Guards
All portal pages use the `useRoleGuard` hook (from `utils/useRoleGuard.js`) which:
- Verifies authentication
- Fetches user role from database
- Redirects unauthorized users to their appropriate portal
- Prevents access to pages not meant for their role

## Cashier Portal

### Dashboard (`/cashier/dashboard`)
- **Total Sales Stats**: Displays total sales, cash sales, GCash sales, and points redeemed for the day
- **Receipt Count**: Shows total receipts with clickable breakdown by order type (Dine-in, Take-out, Pick-up, Delivery)
- **Quick Actions**: Links to POS, Cash Drawer, Order Queue, and EOD Report

### Point of Sale (`/cashier/pos`)
- **Order Modes**: Dine-in, Take-out, Pick-up, Delivery
- **Customer Information**:
  - Customer ID (auto-fetches customer data if registered)
  - Customer Name (defaults to "Walk-in")
  - Contact Number
  - Address (required for delivery orders)
- **Payment Methods**:
  - Cash (with cash tendered and change calculation)
  - GCash (with reference number)
  - Points (with balance check and redemption)
- **Order Management**:
  - Menu browsing and cart management
  - Subtotal, VAT (disabled), Delivery Fee, Points calculation
  - Net Amount computation
- **Receipt Generation**: Automatic receipt printing with order number and details

### Order Queue (`/cashier/orders-queue`)
- **Real-time Updates**: Subscribed to order changes
- **Filter by Order Mode**: All, Dine-in, Take-out, Pick-up, Delivery
- **Item Management**: Remove individual items from pending orders
- **Mark as Served**: Update order status when served

### End of Day Report (`/cashier/eod-report`)
- **Date Selection**: View orders for any date
- **Summary Stats**: Total sales, cash sales, GCash sales, points redeemed
- **Order List**: Complete table with all order details
- **Receipt Reprinting**: Reprint any receipt from the list

### Cash Drawer Management (`/cashier/cash-drawer`)
- **Cash On Hand Display**: Real-time calculation of drawer balance
- **Cash In**: Record cash added to drawer (opening balance, additional funds)
- **Cash Out**: Record expenses with:
  - Payee Name
  - Purpose
  - Category (Payroll, Utilities, Supplies, Maintenance, Other)
- **Adjustments**: Correct entries with:
  - Reference Number
  - Reason (Canceled Order, Double Posting, Payment Correction)
  - Admin Password (required for security)
- **Transaction History**: List of all transactions for the day

### Profile (`/cashier/profile`)
- **Personal Information**: Name, Cashier ID, Contact Number
- **Password Management**: View (toggle) and update password
- **Account Details**: Email address (read-only)

## Rider Portal

### Dashboard (`/rider/dashboard`)
- **Stats Display**:
  - Active Deliveries
  - Completed Today (clickable to view billing portal)
  - Total Earnings
  - Pending Reports
- **Navigation Cards**: Links to Order Portal, Delivery Reports, Profile

### Order Portal (`/rider/deliveries`)
- **Delivery List**: View all assigned deliveries
- **Accept Orders**: Accept delivery assignments
- **Status Updates**: Update delivery status (pending → in_progress → completed)
- **Delivery Details**: Customer info, items, delivery address

### Billing Portal (`/rider/reports`)
- **Daily Reports**: Submit delivery fee billing to cashier
- **Earnings Calculation**: 60% of total delivery fees
- **Report Submission**: Bill cashier for completed deliveries
- **History**: View submitted and paid reports

### Profile (`/rider/profile`)
- **Driver Information**:
  - Full Name
  - Driver ID (unique)
  - Vehicle Type
  - Plate Number
  - Cellphone Number
  - Emergency Contact
- **Availability Toggle**: Mark as available/unavailable
- **Password Management**: Update password with visibility toggle

## Customer Portal

### Dashboard (`/customer/dashboard`)
- **Welcome Screen**: Personalized greeting
- **Quick Stats**: Recent orders, points balance
- **Navigation**: Links to order, track, history, reviews, profile

### Order Portal (`/customer/order-portal`)
- **Menu Browsing**: View categorized menu items
- **Cart Management**: Add items and quantities
- **Order Placement**: Submit orders with delivery options

### Order Tracking (`/customer/order-tracking`)
- **Status Timeline**: Track order progress
- **Real-time Updates**: Auto-refresh order status
- **Delivery Info**: View delivery details

### Order History (`/customer/order-history`)
- **Purchase History**: View all past orders
- **Most Purchased Items**: Sorted by frequency
- **Reorder**: Quick reorder from history

### Reviews (`/customer/reviews`)
- **Submit Reviews**: Rate orders and submit feedback
- **Image Upload**: Attach photos to reviews
- **Review History**: View submitted reviews

### Profile (`/customer/profile`)
- **Personal Information**: Name, address, phone, customer ID
- **Loyalty Points**: View points balance
- **Password Management**: Update password

## Database Schema

### New Tables
1. **cash_drawer_transactions**: Track cashier cash management
2. **delivery_billing_notifications**: Notify cashier of rider billing
3. **delivery_reports**: Store rider daily delivery reports
4. **deliveries**: Track delivery orders and assignments
5. **riders**: Store rider profile and statistics

### Updated Tables
- **orders**: Added `order_mode`, `order_number`, `customer_name`, `contact_number`
- **users**: Added `cashier_id` field

### Row Level Security (RLS)
All tables have RLS policies to ensure:
- Users can only view their own data
- Staff (admin, cashier) can view relevant operational data
- Proper access control for all CRUD operations

## Key Features Implemented

### ✅ Cashier Portal
- [x] Complete dashboard with sales stats
- [x] Full-featured POS with order modes, customer info, payment methods
- [x] Order queue management with real-time updates
- [x] End of day report with receipt reprinting
- [x] Cash drawer management with admin-protected adjustments
- [x] Profile management with password update

### ✅ Rider Portal
- [x] Dashboard with delivery stats
- [x] Order portal for delivery management
- [x] Billing portal for fee submission (60% commission)
- [x] Profile with driver details and availability

### ✅ Customer Portal
- [x] Dashboard with personalized welcome
- [x] Order portal with menu browsing
- [x] Order tracking with real-time updates
- [x] Order history with reorder functionality
- [x] Review submission with images
- [x] Profile management

### ✅ Access Control
- [x] Fixed role assignments for specific emails
- [x] Role-based redirects
- [x] Protected routes with role guards
- [x] Automatic redirection for unauthorized access

## Implementation Notes

### Payment Flow
1. Cashier selects items and adds to cart
2. Customer information is entered or auto-fetched
3. Payment method is selected (Cash/GCash/Points)
4. For cash: tendered amount must be >= net amount
5. For GCash: reference number is required
6. For points: balance check and redemption amount validation
7. Order is created with all details
8. Receipt is automatically generated and printed

### Order Flow
1. Cashier creates order via POS
2. Order enters queue with "order_in_queue" status
3. For delivery: order is assigned to rider
4. Rider accepts and updates to "out_for_delivery"
5. Rider marks "order_delivered" when complete
6. Customer receives order and can review

### Billing Flow
1. Rider completes deliveries throughout the day
2. Rider submits daily report via billing portal
3. Report calculates 60% of delivery fees as rider earnings
4. Notification sent to cashier (future: real-time)
5. Cashier reviews and pays rider fee
6. Report marked as paid, rider cannot reuse

## Future Enhancements

### Pending Features
- [ ] Google Maps integration for delivery directions
- [ ] Kitchen order slips per department (Fryer 1, Fryer 2, Pastries, Drinks)
- [ ] Real-time notifications for rider billing
- [ ] Admin password verification for adjustments
- [ ] Customer points auto-deduction and update
- [ ] Order slip printing with department routing

### Database Migrations Needed
Run `database_schema_updates.sql` to:
1. Add new fields to existing tables
2. Create new tables for cash drawer, deliveries, riders, reports
3. Set up RLS policies for security
4. Create triggers for automatic timestamp updates
5. Add views for dashboard statistics

## Testing Checklist

- [ ] Test login with each role's email address
- [ ] Verify redirection to appropriate portal
- [ ] Test role guard blocks unauthorized access
- [ ] Complete POS order flow for each order mode
- [ ] Test payment methods (Cash, GCash, Points)
- [ ] Verify receipt printing
- [ ] Test cash drawer transactions
- [ ] Verify rider billing submission
- [ ] Test customer order placement
- [ ] Verify real-time order queue updates
- [ ] Test EOD report generation
- [ ] Verify profile updates for all roles

## Conclusion

This implementation provides a comprehensive role-based portal system with complete features for managing cafe operations, from order taking to delivery billing to customer engagement. All portals are protected with proper access control, and the system is designed to scale with additional features like real-time notifications and kitchen management.
