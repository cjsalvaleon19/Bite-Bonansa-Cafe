# Customer Portal Implementation Guide

This document provides a comprehensive guide to the newly implemented Customer Portal features for Bite Bonansa Cafe.

## Overview

The Customer Portal provides a complete online ordering experience with the following features:
- Dashboard with loyalty points tracking
- Order Portal with cart and checkout
- Real-time order tracking
- Profile management with password security
- Review submission system

## Features

### 1. Customer Dashboard (`/customer/dashboard`)

**Features:**
- **Total Points Earned Display**: Shows accumulated earnings and available balance
- **Order Now**: Direct link to Order Portal
- **Order Status**: Real-time status of current active order
- **Total Earnings**: 
  - Displays accumulated points
  - Can be used as payment option
  - Earnings computation: 2% for orders below ₱500, 5% for orders ₱500 and above
- **Most Purchased Items**: 
  - Lists items sorted by purchase frequency
  - Displays purchase count for each item
  - Quick "Add to Cart" button for reordering

**Technical Details:**
- Fetches loyalty balance from `users` table
- Queries `orders` table for current active order
- Aggregates earnings from `loyalty_transactions` table
- Retrieves purchase history from `customer_item_purchases` table

### 2. Order Portal (`/customer/menu`)

**Features:**

**Menu Items:**
- Browse all available menu items
- View item images, descriptions, categories, and prices
- Add to cart with single click

**Cart Management:**
- Add/remove items
- Update quantities with +/- buttons
- Real-time subtotal calculation

**Special Request:**
- Editable text area for custom instructions
- Saved with order for kitchen reference

**Delivery Details:**
- Customer Name: Auto-populated from profile
- Delivery Address: 
  - Manual text input
  - GPS location support via "Use Current Location" button
  - Automatically calculates distance and delivery fee
  - Delivery fee based on distance:
    - ₱35 for 0-1000m
    - +₱10 per additional 200m

**Pricing:**
- Subtotal: Total cost of items only
- Delivery Fee: Distance-based calculation
- VAT Amount: Currently disabled (shows ₱0.00)
- Total Amount: Subtotal + Delivery Fee - Points Used

**Payment Options:**
1. **Cash**: Pay on delivery
2. **GCash**: 
   - Account Name: Catherine Jean Arclita
   - Account Number: 09514915138
   - Requires reference number input after payment
3. **Points Earned**: Use loyalty points as partial payment

**Checkout:**
- Confirmation modal with order summary
- Once confirmed, order details cannot be changed
- Creates order with status "Order in Queue"
- Deducts points if used
- Records loyalty transaction
- Redirects to Order Tracking page

**Technical Details:**
- Uses Haversine formula for distance calculation
- Integrates with `deliveryCalculator` utility
- Automatic earnings calculation based on subtotal
- Creates records in `orders` and `loyalty_transactions` tables

### 3. Order Tracking (`/customer/orders`)

**Features:**

**Order List:**
- Displays all orders (current and past)
- Sorted by creation date (newest first)

**Order Status Timeline:**
Four stages as per requirements:
1. **Order in Queue** (🕐): Customer successfully checked out
2. **Order in Process** (👨‍🍳): Cashier accepted and confirmed order
3. **Out for Delivery** (🛵): Rider accepted the order
4. **Order Delivered** (✓): Rider clicked Order complete

**Order Details:**
- Visual progress bar
- Status badges with color coding
- Timestamp for each stage
- Order items list
- Special requests
- Delivery address
- Payment method and reference (for GCash)
- Total amount and points used
- Expandable detail view

**Technical Details:**
- Real-time status updates via Supabase subscriptions
- Status tracked with timestamps: `created_at`, `accepted_at`, `out_for_delivery_at`, `delivered_at`
- Each checkout creates a separate order entry

### 4. My Profile (`/customer/profile`)

**Features:**

**Account Information:**
- Complete Name
- Customer ID Number (unique identifier)
- Email Address
- Delivery Address
- Date of Membership
- Loyalty Balance (current points available)

**Security:**
- Password field (always hidden as ••••••••)
- Security note explaining passwords cannot be viewed
- Update Password functionality:
  - Requires new password (min 6 characters)
  - Confirmation field to prevent typos
  - Secure update via Supabase Auth
  - No need to enter current password for simplicity

**Technical Details:**
- Profile data fetched from `users` table
- Password updates use Supabase `auth.updateUser()`
- Client-side validation for password requirements

### 5. Share Your Favorite Bites (`/customer/reviews`)

**Features:**

**Create Review:**
- Star rating selector (1-5 stars)
- Optional title field
- Required review text area
- Helper text for guidance
- Information about admin approval process

**Review Gallery:**
- Lists all customer's submitted reviews
- Shows star rating, title, and review text
- Status badges:
  - **Pending Review** (⏳): Awaiting admin approval
  - **Published** (✓): Approved and visible on website
  - **Archived** (📦): Removed from public view

**Edit Review:**
- Edit functionality for all reviews
- Updates existing review with new content
- Re-triggers admin review if needed

**Admin Workflow:**
- Reviews submitted as "pending" status
- Admin receives notification
- Admin can publish to "Biter's favorite bite" section
- Admin can archive inappropriate content

**Technical Details:**
- Reviews stored in `customer_reviews` table
- Supports `image_urls` array for future photo uploads
- Status managed via enum: pending, published, archived
- `published_at` timestamp tracked separately

## Database Schema

### Tables Created

1. **orders** (enhanced)
   - Customer ID, items (JSONB), special request
   - Delivery address, coordinates, and fee
   - Payment details (method, reference, amounts)
   - Status tracking with timestamps
   - Earnings calculation fields

2. **customer_item_purchases**
   - Tracks purchase count per customer per item
   - Used for "Most Purchased Items" feature
   - Updated automatically via trigger

3. **customer_reviews**
   - Star rating, title, review text
   - Image URLs array
   - Status and publication tracking

4. **loyalty_transactions**
   - Complete history of points earned/spent
   - Links to orders
   - Balance snapshots

### Automated Functions & Triggers

1. **calculate_earnings_percentage()**
   - Returns 2.00 for subtotal < ₱500
   - Returns 5.00 for subtotal ≥ ₱500

2. **update_customer_purchases()** (Trigger)
   - Fires when order status changes to "order_delivered"
   - Updates or inserts purchase counts per item
   - Aggregates total spent per item

3. **add_loyalty_points()** (Trigger)
   - Fires when order status changes to "order_delivered"
   - Credits earnings to customer's loyalty balance
   - Creates loyalty transaction record

### Row Level Security (RLS)

All tables have RLS policies:
- Customers can only view/edit their own data
- Staff (admin, cashier, rider) can view all data
- Staff can update order status
- Admin can manage review status

## Navigation

Consistent navigation menu on all customer pages:
- Dashboard
- Order Portal
- Order Tracking
- My Profile
- Share Review

## Usage Instructions

### For Customers

1. **Register/Login**: Create account or log in
2. **Browse Menu**: Navigate to Order Portal
3. **Add Items**: Click "Add to Cart" on desired items
4. **Review Cart**: Check items and quantities
5. **Add Details**: Enter delivery address, special requests
6. **Choose Payment**: Select Cash, GCash, or use Points
7. **Checkout**: Confirm order (cannot change after this)
8. **Track Order**: Monitor status in Order Tracking page
9. **Earn Points**: Receive points when order is delivered
10. **Leave Review**: Share experience via Share Review page

### For Administrators

**Setup Database:**
```bash
# Run the SQL schema file in your Supabase SQL editor
psql -U postgres -d your_database -f database_schema.sql
```

**Configure Environment:**
Ensure these variables are set:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**Manage Reviews:**
- Admin portal to view pending reviews
- Approve or archive as needed
- Published reviews can appear in public gallery

## Technical Stack

- **Frontend**: Next.js 15.5.15 (Pages Router)
- **UI**: React with inline styles (dark theme)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Real-time**: Supabase subscriptions
- **State Management**: React hooks (useState, useEffect)
- **Location**: Browser Geolocation API
- **Distance Calculation**: Haversine formula

## Security Features

- Role-based access control on all pages
- Row Level Security policies in database
- Password hashing via Supabase Auth
- Hidden passwords in UI
- XSS protection via React's built-in escaping
- CSRF protection via Supabase session tokens
- Input validation on all forms

## Future Enhancements

Potential improvements for future iterations:
- Image upload for reviews
- Order history filtering and search
- Reorder from past orders
- Favorite items feature
- Push notifications for order status
- Multiple delivery addresses
- Payment gateway integration for GCash
- Promo codes and discounts
- Order scheduling for later delivery

## Troubleshooting

**Order not appearing in tracking:**
- Check that order was successfully created
- Verify customer_id matches logged-in user
- Check RLS policies are correctly set

**Points not credited:**
- Verify order status is "order_delivered"
- Check `add_loyalty_points` trigger is enabled
- Review `loyalty_transactions` table for records

**Delivery fee not calculating:**
- Ensure GPS permissions granted
- Check STORE_LOCATION coordinates are correct
- Verify `calculateDeliveryFee` function logic

**Reviews not showing:**
- Confirm review was successfully inserted
- Check status is not 'archived'
- Verify RLS policies allow customer to view own reviews

## Support

For issues or questions:
1. Check browser console for JavaScript errors
2. Verify database schema is properly set up
3. Check Supabase logs for database errors
4. Ensure all environment variables are configured
5. Review RLS policies if data access issues occur

## License

This implementation is part of the Bite Bonansa Cafe project.
