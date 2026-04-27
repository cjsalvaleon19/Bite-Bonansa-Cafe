# Cashier Interface - Testing & Validation Checklist

## Pre-Deployment Checklist

### Database Migration
- [ ] Run migration file: `supabase/migrations/020_cashier_interface_tables.sql`
- [ ] Verify `cash_drawer_transactions` table exists
- [ ] Verify `chart_of_accounts` table exists with default accounts
- [ ] Verify `kitchen_departments` table exists with 4 departments
- [ ] Verify `menu_items.kitchen_department_id` column exists
- [ ] Verify RLS policies are active on all new tables

### Access Control Testing
- [ ] Login as arclitacj@gmail.com - should access /cashier
- [ ] Login as customer account - should NOT access /cashier
- [ ] Login as rider (johndave0991@gmail.com) - should NOT access /cashier  
- [ ] Login as admin (cjsalvaleon19@gmail.com) - should NOT access /cashier (redirects to /dashboard)
- [ ] Attempt direct URL access to /cashier routes without login - should redirect to /login

## Feature Testing

### 1. Dashboard (/cashier/dashboard)
- [ ] Page loads without errors
- [ ] Total Sales for the Day displays correctly
- [ ] Total Sales paid by Cash shows correct amount
- [ ] Total Sales paid by GCash shows correct amount
- [ ] Total Sales paid by Points shows correct amount
- [ ] Total Receipts count displays
- [ ] Click on Total Receipts shows breakdown modal
- [ ] Breakdown shows counts for: Dine-in, Take-out, Pick-up, Delivery
- [ ] Quick action buttons navigate correctly:
  - [ ] Take an Order → /cashier/pos
  - [ ] Cash Drawer → /cashier/cash-drawer
  - [ ] Order Queue → /cashier/orders-queue
  - [ ] EOD Report → /cashier/eod-report
- [ ] Notification bell appears in header
- [ ] Notification bell shows unread count (if any)
- [ ] Clicking notification bell opens dropdown
- [ ] Logout button works

### 2. POS (/cashier/pos)
**Menu Display:**
- [ ] Menu items load successfully
- [ ] Items show correct name, category, price
- [ ] Items with variants show "Has options" badge
- [ ] Clicking item without variants adds to cart immediately
- [ ] Clicking item with variants opens modal

**Variant Selection:**
- [ ] Variant modal displays item name
- [ ] All variant types display (Size, Variety, Add-ons)
- [ ] Required variants marked with *
- [ ] Can select variant options
- [ ] Price updates based on selections
- [ ] Cannot confirm without selecting required variants
- [ ] Confirm button adds item to cart with variants
- [ ] Cancel button closes modal

**Customer Lookup:**
- [ ] Enter valid Customer ID auto-fills info
- [ ] Customer name displays
- [ ] Contact number displays
- [ ] Address displays (if available)
- [ ] Points balance displays
- [ ] Invalid ID shows "Customer not found"
- [ ] Clearing ID resets to "Walk-in"

**Cart Management:**
- [ ] Cart shows all added items
- [ ] Items display name, quantity, price
- [ ] Items with variants show variant details
- [ ] Can increase quantity (+)
- [ ] Can decrease quantity (-)
- [ ] Can remove items (X)
- [ ] Clear button empties cart
- [ ] Cart total calculates correctly

**Payment:**
- [ ] Can select Cash payment method
- [ ] Can select GCash payment method
- [ ] Can select Claimed Points payment method
- [ ] Cash: Enter amount tendered shows change
- [ ] Cash: Change must be >= 0 to checkout
- [ ] GCash: Requires reference number
- [ ] Points: Cannot exceed balance
- [ ] Points: Cannot exceed total amount

**Checkout:**
- [ ] Subtotal calculates correctly
- [ ] VAT Amount is 0
- [ ] Delivery fee added for delivery orders
- [ ] Points deducted from total
- [ ] Net amount is correct
- [ ] Checkout creates order in database
- [ ] Receipt auto-prints
- [ ] Cart clears after checkout
- [ ] Success message displays

### 3. Cash Drawer (/cashier/cash-drawer)
**Display:**
- [ ] Cash on Hand displays at top
- [ ] Today's transactions list shows

**Cash In:**
- [ ] Click Cash In opens modal
- [ ] Amount field is required
- [ ] Description field is optional
- [ ] Submit records transaction
- [ ] Increases cash on hand
- [ ] Appears in transaction list

**Cash Out:**
- [ ] Click Cash Out opens modal
- [ ] Amount field is required
- [ ] Description field is optional
- [ ] Submit records transaction
- [ ] Decreases cash on hand
- [ ] Appears in transaction list

**Pay Bills:**
- [ ] Click Pay Bills opens modal
- [ ] Amount field is required
- [ ] Bill Type field is required (Payroll, Utilities, Receiving Report, Other)
- [ ] Payee Name field is required
- [ ] Purpose/Description field is optional
- [ ] Submit records transaction
- [ ] Decreases cash on hand
- [ ] Appears in transaction list with bill details

**Pay Expenses:**
- [ ] Click Pay Expenses opens modal
- [ ] Amount field is required
- [ ] Payee Name field is required
- [ ] Purpose field is required
- [ ] Category dropdown shows Chart of Accounts
- [ ] Submit records transaction
- [ ] Decreases cash on hand
- [ ] Appears in transaction list with expense details

**Adjustment:**
- [ ] Click Adjustment opens modal
- [ ] Amount field is required
- [ ] Reference Number field is optional
- [ ] Reason dropdown is required
- [ ] Admin Password field is required
- [ ] Invalid admin password shows error
- [ ] Valid admin password (cjsalvaleon19@gmail.com password) allows submission
- [ ] Submit records transaction
- [ ] Updates cash on hand (can be + or -)
- [ ] Appears in transaction list marked as verified

**Calculations:**
- [ ] Cash on Hand = (Cash In) - (Cash Out + Pay Bills + Pay Expenses) + (Adjustments)

### 4. Orders Queue (/cashier/orders-queue)
- [ ] Pending orders display (status: order_in_queue, order_in_process)
- [ ] Can filter by: All, Dine-in, Take-out, Pick-up, Delivery
- [ ] Each order shows:
  - [ ] Order number
  - [ ] Customer name
  - [ ] Order mode
  - [ ] Items list
  - [ ] Total amount
  - [ ] Created time
- [ ] Can remove individual items
- [ ] Removing item updates order total
- [ ] Removing last item deletes order
- [ ] Can mark order as served
- [ ] Orders update in real-time when new orders placed

### 5. End of Day Report (/cashier/eod-report)
- [ ] Date selector defaults to today
- [ ] Can select different date
- [ ] Orders for selected date display
- [ ] Each order shows:
  - [ ] Date and time
  - [ ] Customer ID
  - [ ] Customer name
  - [ ] Order mode
  - [ ] Payment method
  - [ ] Subtotal
  - [ ] Delivery fee (if applicable)
  - [ ] Points claimed (if applicable)
  - [ ] Net amount
- [ ] Click order opens print dialog
- [ ] Printed receipt shows all order details
- [ ] Orders sorted by time (newest first)

### 6. Profile (/cashier/profile)
**Display:**
- [ ] Email address displays (read-only)
- [ ] Cashier's Name displays
- [ ] Cashier's ID Number displays
- [ ] Contact Number displays

**Edit:**
- [ ] Can edit Cashier's Name
- [ ] Can edit Cashier's ID Number
- [ ] Can edit Contact Number
- [ ] Save Changes button updates database
- [ ] Success message appears on save
- [ ] Error message appears on failure

**Password:**
- [ ] Password field shows dots by default
- [ ] Click eye button shows password section
- [ ] New Password field accepts input
- [ ] Confirm Password field accepts input
- [ ] Passwords must match
- [ ] Minimum 6 characters required
- [ ] Update Password button changes password
- [ ] Success alert on password change
- [ ] Password fields clear after update

### 7. Navigation
**Header (all pages):**
- [ ] Logo displays
- [ ] Dashboard link works
- [ ] POS link works
- [ ] Order Queue link works
- [ ] EOD Report link works
- [ ] Profile link works
- [ ] Notification bell displays
- [ ] Logout button works

**Active State:**
- [ ] Current page highlighted in nav
- [ ] Highlighted with yellow border and background

## Security Testing

### Role-Based Access
- [ ] Cashier role required for all /cashier routes
- [ ] Customer role redirected to /customer/dashboard
- [ ] Rider role redirected to /rider/dashboard
- [ ] Admin role redirected to /dashboard
- [ ] No role redirected to /login

### Admin Password Verification
- [ ] Adjustments cannot be saved without admin password
- [ ] Wrong password shows error
- [ ] Correct admin password allows adjustment
- [ ] Admin user ID tracked in adjustment

### Data Security
- [ ] Cashier can only see their own cash drawer transactions
- [ ] Admin can see all cash drawer transactions
- [ ] RLS policies prevent unauthorized access
- [ ] Session timeout redirects to login

## Performance Testing

### Load Times
- [ ] Dashboard loads in < 2 seconds
- [ ] POS menu loads in < 2 seconds
- [ ] Orders queue loads in < 2 seconds
- [ ] EOD report loads in < 2 seconds

### Real-time Updates
- [ ] New orders appear in queue immediately
- [ ] Notifications arrive in real-time
- [ ] Dashboard stats update when new order placed

### Large Data Sets
- [ ] EOD report handles 100+ orders
- [ ] Orders queue handles 50+ pending orders
- [ ] Transaction list handles 100+ transactions

## Browser Compatibility
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari

## Mobile Responsiveness
- [ ] Dashboard displays on mobile
- [ ] POS usable on tablet
- [ ] Navigation accessible on mobile

## Error Handling

### Network Errors
- [ ] Displays error if database unavailable
- [ ] Handles timeout gracefully
- [ ] Shows user-friendly error messages

### Validation Errors
- [ ] Required field errors display
- [ ] Invalid input prevented
- [ ] Error messages clear

### Edge Cases
- [ ] Empty cart cannot checkout
- [ ] Negative amounts prevented
- [ ] Zero quantities prevented
- [ ] Large numbers handled

## Post-Deployment Monitoring

### Day 1
- [ ] Monitor error logs in Supabase
- [ ] Check for authentication issues
- [ ] Verify order creation working
- [ ] Confirm receipt printing

### Week 1
- [ ] Review cash drawer reconciliation
- [ ] Check EOD report accuracy
- [ ] Gather user feedback
- [ ] Monitor performance metrics

### Month 1
- [ ] Analyze usage patterns
- [ ] Identify pain points
- [ ] Plan enhancements
- [ ] Update documentation

## Known Limitations

1. **Kitchen Slips**: Order slips per kitchen department not yet implemented
2. **Mixed Payments**: Cannot split payment between cash + GCash in single transaction
3. **Offline Mode**: Requires internet connection
4. **Export**: No Excel/PDF export for reports
5. **Shift Tracking**: No clock in/out functionality

## Success Criteria

✅ **Core Functionality:**
- All CRUD operations work
- Real-time updates function
- Security policies enforced
- Data accuracy verified

✅ **User Experience:**
- Pages load quickly
- Navigation intuitive
- Error messages helpful
- Workflow efficient

✅ **Business Requirements:**
- Accurate sales tracking
- Complete audit trail
- Secure access control
- Reliable reporting

## Sign-Off

- [ ] Database Administrator: Migration applied successfully
- [ ] QA Tester: All tests passed
- [ ] Project Manager: Requirements met
- [ ] Cashier User: Training completed, interface approved
- [ ] System Administrator: Security verified
- [ ] Development Team: Code reviewed and documented

---

**Tested By:** ________________
**Date:** ________________
**Version:** 1.0
**Status:** ☐ Pass ☐ Fail ☐ Conditional Pass

**Notes:**
