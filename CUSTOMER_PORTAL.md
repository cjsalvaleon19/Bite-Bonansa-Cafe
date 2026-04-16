# Customer Portal Implementation

## Overview
This implementation adds role-based access control to the Bite Bonansa Cafe application, restricting certain features for customer access while providing a dedicated customer portal for online ordering.

## Features Implemented

### 1. Role-Based Dashboard (pages/dashboard.js)
The main dashboard now displays different navigation cards based on the user's role:

**For Customers:**
- Customer Dashboard
- Menu (Browse & Order)
- Order Tracking
- My Profile

**For Admin/Staff:**
- Cashier
- Menu Management
- Inventory
- Reports
- Customers
- Reviews

### 2. Customer Portal Pages

#### Customer Dashboard (`pages/customer/dashboard.js`)
- Overview of customer account
- Loyalty points display
- Customer ID display
- Total orders count
- Quick action buttons to Menu, Orders, and Profile
- Recent orders list

#### Menu Page (`pages/customer/menu.js`)
- Browse available menu items
- Filter by category
- Shopping cart functionality with Zustand state management
- Add/remove items from cart
- Quantity adjustment
- Proceed to checkout

#### Order Tracking (`pages/customer/orders.js`)
- View all customer orders
- Filter by status (All, Pending, Processing, Completed)
- Visual order progress tracker
- Order details (amount, payment method, delivery address)
- Order status indicators with color coding

#### My Profile (`pages/customer/profile.js`)
- View and edit personal information
- Update billing address
- **Shipping Details Section:**
  - Shipping address
  - City
  - Postal code
- **Payment Preferences:**
  - Cash on Delivery
  - GCash
  - PayMaya
  - Bank Transfer
  - Credit/Debit Card
- Account information display (Customer ID, Loyalty Points)

### 3. Enhanced Registration (`pages/register.js`)
Updated registration form now includes:
- Full Name
- Email
- Phone Number
- Password
- Billing Address (optional)
- **Shipping Address** (optional)
- **City** (optional)
- **Postal Code** (optional)

### 4. Database Schema Updates

#### Migration File: `supabase/migrations/002_add_shipping_payment_fields.sql`

New columns added to `users` table:
- `shipping_address` (TEXT) - Customer delivery address
- `city` (VARCHAR(100)) - City for shipping
- `postal_code` (VARCHAR(20)) - Postal/ZIP code
- `payment_method` (VARCHAR(50)) - Preferred payment method (default: 'cash_on_delivery')

#### How to Apply Migration
See `supabase/migrations/README.md` for detailed instructions.

**Quick Method:**
```bash
# Using Supabase CLI
supabase db push

# Or manually via Supabase Dashboard SQL Editor
# Copy contents of 002_add_shipping_payment_fields.sql and execute
```

### 5. API Updates

#### Register API (`pages/api/register.js`)
Updated to accept and save:
- `shippingAddress`
- `city`
- `postalCode`
- `payment_method` (defaults to 'cash_on_delivery')

## User Roles

The system supports four user roles:
1. **customer** - Default role for new registrations, limited access
2. **cashier** - POS access
3. **rider** - Delivery management
4. **admin** - Full system access

## Security Features

1. **Authentication Guard:** All customer portal pages check for active session
2. **Role-Based Rendering:** Dashboard only shows features appropriate for user role
3. **Database-Level Role Storage:** User roles stored in Supabase users table

## Online Ordering Flow

1. **Customer browses menu** → `pages/customer/menu.js`
2. **Adds items to cart** → Zustand state management
3. **Proceeds to checkout** → `pages/customer/checkout.js` (to be implemented)
4. **Order placed with shipping/payment details**
5. **Track order status** → `pages/customer/orders.js`

## Design Consistency

All customer portal pages maintain the Bite Bonansa Cafe design system:
- Dark theme (#0a0a0a background, #1a1a1a cards)
- Gold accent color (#ffc107)
- Playfair Display for headings
- Poppins for body text
- Consistent inline styles (no Tailwind)

## Testing Checklist

- [ ] Verify customers only see 4 navigation cards in dashboard
- [ ] Verify admin/staff see all 6 navigation cards
- [ ] Test customer registration with shipping details
- [ ] Test profile update with shipping and payment preferences
- [ ] Test menu browsing and cart functionality
- [ ] Test order tracking with different statuses
- [ ] Verify database migration applied successfully
- [ ] Test role-based access on all pages

## Future Enhancements

1. **Checkout Page** - Complete order placement flow
2. **Payment Integration** - GCash, PayMaya API integration
3. **Order Confirmation** - Email/SMS notifications
4. **Delivery Tracking** - Real-time rider location
5. **Reviews & Ratings** - Customer feedback on orders
6. **Favorites** - Save favorite menu items
7. **Order History Export** - Download past orders
8. **Multi-address Support** - Save multiple delivery addresses

## Notes

- The shopping cart uses Zustand for state management (separate store instance in menu.js)
- All customer pages include proper meta tags for SEO
- Error handling includes fallback states for missing Supabase connection
- Responsive design maintained across all new pages
