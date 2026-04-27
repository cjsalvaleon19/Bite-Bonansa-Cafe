# Cashier Interface - Complete Implementation Guide

## Overview
The Cashier Interface is a comprehensive Point of Sale (POS) and cash management system designed exclusively for cashier users. It provides complete control over order taking, payment processing, cash drawer management, and end-of-day reporting.

## Access Control

### Authorized Cashier Account
- **Email**: `arclitacj@gmail.com`
- **Role**: Cashier
- **Access Level**: Cashier portal only (cannot access customer, rider, or admin portals)

### Security Features
1. **Role-Based Access Control**: Implemented via `useRoleGuard` hook
2. **Role Mapping**: Fixed role assignment in `utils/roleMapping.js`
3. **Automatic Redirection**: Users are automatically redirected to their appropriate portal based on role
4. **Admin Password Verification**: Required for cash drawer adjustments

## Features

### 1. Dashboard (`/cashier/dashboard`)

#### Sales Statistics
- **Total Sales for the Day**: Aggregates all payment methods (cash + GCash + points claimed)
- **Total Sales paid by Cash**: Sum of all cash transactions
- **Total Sales paid by GCash**: Sum of all GCash transactions  
- **Total Sales paid by Points**: Sum of points redeemed by customers
- **Receipt Count**: Total number of orders/receipts issued for the day

#### Receipt Breakdown
Click on the "Total Receipts" card to view breakdown by order mode:
- Dine-in orders count
- Take-out orders count
- Pick-up orders count
- Delivery orders count

#### Quick Actions
- **Take an Order**: Opens POS system
- **Cash Drawer**: Access cash management
- **Order Queue**: View pending orders
- **End of Day Report**: Generate daily sales report

#### Notification Bell
- Real-time notifications for order status changes
- Unread count indicator
- Mark as read functionality
- Dropdown notification list

### 2. Point of Sale (POS) (`/cashier/pos`)

#### Order Configuration
**Order Modes:**
- 🍽️ Dine-in
- 🥡 Take-out
- 📦 Pick-up
- 🚚 Delivery (includes delivery fee)

#### Customer Management
**Customer Lookup:**
- Enter Customer ID (BBC-XXXXX format)
- Auto-fills customer information:
  - Full name
  - Contact number
  - Address
  - Points balance

**Walk-in Customers:**
- Default customer name: "Walk-in"
- Manual entry for contact and address

#### Menu & Cart
**Menu Features:**
- Browse all available menu items
- Items organized by category
- Displays "Has options" badge for items with variants
- Click to add items to cart

**Variant Selection:**
- Automatic modal popup for items with variants
- Select size, variety, add-ons
- Price updates based on selections
- Required variants must be selected

**Cart Management:**
- View all items in cart
- Adjust quantities (+/-)
- Remove individual items
- View item variants and customizations
- Clear entire cart

#### Payment Processing
**Payment Methods:**
- **Cash**: Enter amount tendered, calculates change
- **GCash**: Enter reference number
- **Claimed Points**: Uses customer's earned points balance

**Payment Validation:**
- Cash: Change must be >= 0
- GCash: Reference number required
- Points: Cannot exceed available balance or total amount

#### Pricing Breakdown
- **Subtotal**: Sum of all items in cart
- **VAT Amount**: Currently set to 0
- **Delivery Fee**: ₱30 for delivery orders (configurable)
- **Points Used**: Deducted from total
- **Net Amount**: Final amount to pay

#### Receipt Generation
- Auto-print on successful checkout
- Displays order number
- Customer copy with complete details
- Kitchen order slips (to be implemented)

### 3. Cash Drawer Management (`/cashier/cash-drawer`)

#### Cash on Hand Display
- Real-time calculation of drawer balance
- Updates with each transaction
- Visible at top of page

#### Transaction Types

##### 💰 Cash In
Record cash additions to the drawer
- **Amount**: Required
- **Description**: Optional (e.g., "Opening balance", "Additional funds")
- Increases cash on hand

##### 💵 Cash Out
Record cash removals from the drawer
- **Amount**: Required
- **Description**: Optional reason for cash removal
- Decreases cash on hand

##### 🧾 Pay Bills
Pay outstanding bills with proper categorization
- **Amount**: Required
- **Bill Type**: Payroll, Utilities, Receiving Report, Other
- **Payee Name**: Required (who receives payment)
- **Purpose/Description**: Payment details
- Decreases cash on hand
- Tracked separately for reporting

##### 💳 Pay Expenses
Record ad-hoc expenses with accounting integration
- **Amount**: Required
- **Payee Name**: Required
- **Purpose**: Required (what the expense is for)
- **Category**: Required (linked to Chart of Accounts)
  - 5100 - Payroll Expenses
  - 5200 - Utilities
  - 5300 - Supplies
  - 5400 - Maintenance & Repairs
  - 5500 - Marketing & Advertising
  - 5600 - Professional Fees
  - 5700 - Transportation
  - 5800 - Miscellaneous
  - 5900 - Food & Ingredients
- Decreases cash on hand

##### ⚖️ Adjustment
Correct errors in cash drawer (requires admin password)
- **Amount**: Required (positive or negative)
- **Reference Number**: Order/receipt number (optional)
- **Reason**: Required
  - Canceled Order
  - Double Posting of Receipt
  - From Cash to GCash Payment
  - Other
- **Admin Password**: Required for verification
  - Must match admin account password (cjsalvaleon19@gmail.com)
  - Provides audit trail
- Can increase or decrease cash on hand

#### Transaction History
- View all today's transactions
- Shows transaction type, amount, time
- Displays payee, purpose, and other details
- Color-coded by type

### 4. Orders Queue (`/cashier/orders-queue`)

#### Order Management
- View all pending orders (in queue and in process)
- Real-time updates via Supabase subscriptions
- Filter by order mode:
  - All orders
  - Dine-in only
  - Take-out only
  - Pick-up only
  - Delivery only

#### Order Actions
- **Remove Items**: Delete served items from orders
- **Mark as Served**: Complete order fulfillment
- Auto-updates order totals when items removed
- Deletes order if no items remain

#### Order Details Display
- Order number
- Customer information
- Order mode
- Item list with quantities and prices
- Total amount
- Creation timestamp

### 5. End of Day (EOD) Report (`/cashier/eod-report`)

#### Report Features
- **Date Selection**: View reports for any date
- **Order Listing**: All orders for selected date
  - Date and time of receipt
  - Customer ID
  - Customer name
  - Order mode (Dine-in, Take-out, Pick-up, Delivery)
  - Payment method
  - Subtotal
  - Delivery fee (if applicable)
  - Points claimed
  - Net amount

#### Receipt Reprint
- Click to reprint any receipt
- Opens print dialog with formatted receipt
- Includes all order details

#### Report Data
- Sorted by creation time (newest first)
- Complete transaction history
- Payment method breakdown
- Useful for reconciliation

### 6. My Profile (`/cashier/profile`)

#### Personal Information
- **Email Address**: Read-only (from authentication)
- **Cashier's Name**: Editable
- **Cashier's ID Number**: Editable
- **Contact Number**: Editable

#### Security
- **Password Management**:
  - Click eye button to show password section
  - Enter new password
  - Confirm new password
  - Minimum 6 characters required
  - Update password securely

#### Save Changes
- Save button updates profile information
- Success/error messages displayed
- Real-time validation

## Database Schema

### Tables Created

#### `cash_drawer_transactions`
Tracks all cash drawer activities:
```sql
- id (UUID, Primary Key)
- cashier_id (UUID, Foreign Key to users)
- transaction_type (cash-in, cash-out, pay-bill, pay-expense, adjustment)
- amount (DECIMAL)
- description (TEXT)
- payee_name (VARCHAR)
- purpose (TEXT)
- category (VARCHAR) - Links to Chart of Accounts
- reference_number (VARCHAR)
- adjustment_reason (VARCHAR)
- admin_verified (BOOLEAN)
- admin_user_id (UUID)
- bill_id (UUID)
- bill_type (VARCHAR)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### `chart_of_accounts`
Accounting structure for expense categorization:
```sql
- id (UUID, Primary Key)
- account_code (VARCHAR, Unique)
- account_name (VARCHAR)
- account_type (VARCHAR) - asset, liability, equity, revenue, expense
- parent_account_id (UUID, Self-referencing)
- is_active (BOOLEAN)
- description (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### `kitchen_departments`
Kitchen stations for order routing:
```sql
- id (UUID, Primary Key)
- department_name (VARCHAR, Unique) - Fryer 1, Fryer 2, Pastries, Drinks
- department_code (VARCHAR, Unique)
- description (TEXT)
- is_active (BOOLEAN)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

#### `menu_items` (Enhanced)
Added field:
```sql
- kitchen_department_id (UUID, Foreign Key to kitchen_departments)
```

## Navigation

### Header Navigation (All Pages)
- ☕ Bite Bonansa Cafe (Logo)
- Dashboard
- POS
- Order Queue
- EOD Report
- Profile
- 🔔 Notifications (with unread count)
- Logout

### Page Routes
- `/cashier` or `/cashier/dashboard` - Main dashboard
- `/cashier/pos` - Point of Sale
- `/cashier/orders-queue` - Order queue management
- `/cashier/cash-drawer` - Cash drawer operations
- `/cashier/eod-report` - End of day reporting
- `/cashier/profile` - Profile management

## Technical Implementation

### Components Used
- **NotificationBell**: Shared component for real-time notifications
- **VariantSelectionModal**: Modal for selecting item variants
- **useRoleGuard**: Custom hook for role-based access control
- **useCartStore**: Zustand store for cart management

### Real-time Features
- Supabase real-time subscriptions for:
  - Order updates in queue
  - New notifications
  - Sales statistics (future enhancement)

### State Management
- React useState for local state
- Zustand for cart persistence
- localStorage for cart backup

### Styling
- Inline styles with consistent theme
- Black background (#0a0a0a, #1a1a1a)
- Yellow/gold accents (#ffc107)
- Poppins font family
- Playfair Display for titles

## Future Enhancements

### Planned Features
1. **Kitchen Department Integration**
   - Auto-assign items to departments
   - Generate order slips per department
   - Department-specific order routing

2. **Advanced Receipt Printing**
   - Thermal printer support
   - Kitchen slip generation
   - Order number on all slips

3. **Mixed Payment Methods**
   - Split payments (Cash + GCash)
   - Partial point redemption
   - Multiple tender tracking

4. **Shift Management**
   - Clock in/out functionality
   - Shift-based reporting
   - Multi-cashier reconciliation

5. **Enhanced Reporting**
   - Export to Excel/PDF
   - Custom date ranges
   - Payment method breakdowns
   - Hourly sales graphs

6. **Offline Mode**
   - Queue orders when offline
   - Sync when connection restored
   - Local data persistence

## Troubleshooting

### Common Issues

**Issue**: "Admin password verification failed"
- **Solution**: Ensure you're using the correct admin password for cjsalvaleon19@gmail.com

**Issue**: Notification bell not showing
- **Solution**: Ensure user session is loaded. Check console for errors.

**Issue**: Variant modal not appearing
- **Solution**: Verify menu items have `has_variants` flag set and variant_types populated

**Issue**: Cash on hand calculation incorrect
- **Solution**: Check all transaction types are included in calculation (pay-bill, pay-expense)

**Issue**: Cannot access cashier portal
- **Solution**: Verify email is arclitacj@gmail.com and role is set correctly in users table

### Database Migration

To apply database changes:
```bash
# Run the migration file
psql -U your_user -d your_database -f supabase/migrations/020_cashier_interface_tables.sql
```

Or via Supabase Dashboard:
1. Go to SQL Editor
2. Paste contents of `020_cashier_interface_tables.sql`
3. Run query

## Security Considerations

1. **Admin Password Verification**: All adjustments require admin password
2. **Row Level Security (RLS)**: 
   - Cashiers can only view their own transactions
   - Admins can view all transactions
   - Proper policies on all tables
3. **Role Mapping**: Fixed roles prevent privilege escalation
4. **Session Management**: Automatic logout on session expiry
5. **Input Validation**: Client and server-side validation

## Support & Maintenance

### Monitoring
- Check Supabase logs for database errors
- Monitor notification system for delivery issues
- Review cash drawer transactions for discrepancies

### Backup
- Regular database backups recommended
- Export EOD reports for records
- Keep transaction logs for auditing

### Updates
- Test changes in staging environment
- Backup database before migrations
- Communicate changes to cashier staff

## Conclusion

The Cashier Interface provides a complete, secure, and efficient system for managing point-of-sale operations, cash drawer activities, and daily reporting. With proper training and regular use, it streamlines the order-taking and payment processing workflow while maintaining accurate financial records.

For technical support or feature requests, contact the development team.
