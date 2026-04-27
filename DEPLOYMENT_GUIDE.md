# Portal Access Control Implementation - Quick Start

## Overview
This implementation provides complete role-based access control and portal features for the Bite Bonansa Cafe application.

## Role Assignments

### Fixed Email Roles
- **Admin**: `cjsalvaleon19@gmail.com`
- **Cashier**: `arclitacj@gmail.com`, `bantecj@bitebonansacafe.com`
- **Rider**: `johndave0991@gmail.com`
- **Customer**: All other email addresses

## Deployment Steps

### 1. Database Setup
Run the schema updates:
```bash
# Connect to your Supabase database and run:
psql -h <your-host> -U <your-user> -d <your-db> -f database_schema_updates.sql
```

This will:
- Create 5 new tables (cash_drawer_transactions, delivery_billing_notifications, delivery_reports, deliveries, riders)
- Add fields to orders table (order_mode, order_number, customer_name, contact_number)
- Add cashier_id to users table
- Set up Row Level Security policies
- Create triggers and views

### 2. Environment Variables
Ensure your `.env.local` has:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Build Application
```bash
npm run build
```

### 5. Run Application
```bash
npm run dev    # Development
npm start      # Production
```

## Portal Access

### Cashier Portal (`/cashier`)
**Emails**: arclitacj@gmail.com, bantecj@bitebonansacafe.com

Features:
- Dashboard with sales stats
- POS system with order modes (Dine-in, Take-out, Pick-up, Delivery)
- Payment methods (Cash, GCash, Points)
- Order queue management
- End of day report
- Cash drawer management
- Profile

### Rider Portal (`/rider`)
**Email**: johndave0991@gmail.com

Features:
- Dashboard with delivery stats
- Order portal for deliveries
- Billing portal (60% commission)
- Profile with driver details

### Customer Portal (`/customer`)
**Email**: Any other email address

Features:
- Dashboard
- Order portal
- Order tracking
- Order history
- Reviews
- Profile

### Admin Portal (`/dashboard`)
**Email**: cjsalvaleon19@gmail.com

Features:
- Admin dashboard
- Menu management
- Customer management
- Inventory management
- Reports
- Reviews management

## Testing

### Quick Test Flow

1. **Test Access Control**
```
1. Register with arclitacj@gmail.com → Should go to /cashier/dashboard
2. Register with johndave0991@gmail.com → Should go to /rider/dashboard
3. Register with cjsalvaleon19@gmail.com → Should go to /dashboard
4. Register with any other email → Should go to /customer/dashboard
```

2. **Test Cashier POS**
```
1. Login as cashier (arclitacj@gmail.com)
2. Go to POS
3. Select order mode (e.g., Dine-in)
4. Add items to cart
5. Select payment method
6. For Cash: Enter tendered amount >= net amount
7. Click Checkout
8. Verify receipt is generated
```

3. **Test Order Queue**
```
1. Create order via POS
2. Go to Order Queue
3. Verify order appears
4. Try removing an item
5. Mark order as served
```

4. **Test Cash Drawer**
```
1. Go to Cash Drawer
2. Try Cash In (add opening balance)
3. Try Cash Out (record expense)
4. Try Adjustment (requires admin password)
5. Verify transaction appears in history
```

5. **Test Rider Billing**
```
1. Login as rider (johndave0991@gmail.com)
2. Go to Billing Portal
3. Submit daily report
4. Verify 60% commission calculation
```

## Troubleshooting

### Issue: User redirected to wrong portal
- Check email is registered correctly in database
- Verify roleMapping.js has correct email assignments
- Check users table has correct role field

### Issue: Payment validation fails
- Verify customer ID exists for points payment
- Check cash tendered >= net amount for cash
- Ensure GCash reference is entered

### Issue: Orders not appearing in queue
- Verify order status is 'order_in_queue'
- Check Supabase RLS policies allow cashier to view orders
- Ensure real-time subscription is active

### Issue: Receipt not printing
- Check browser popup blocker
- Verify order data is complete
- Try different browser

## File Structure

```
pages/
├── cashier/
│   ├── index.js (redirects to dashboard)
│   ├── dashboard.js
│   ├── pos.js
│   ├── orders-queue.js
│   ├── eod-report.js
│   ├── cash-drawer.js
│   └── profile.js
├── rider/
│   ├── dashboard.js
│   ├── deliveries.js
│   ├── reports.js
│   └── profile.js
├── customer/
│   ├── dashboard.js
│   ├── order-portal.js
│   ├── order-tracking.js
│   ├── order-history.js
│   ├── reviews.js
│   └── profile.js
└── admin/
    └── (existing admin pages)

utils/
├── roleMapping.js (fixed role assignments)
├── useRoleGuard.js (role-based access control)
├── supabaseClient.js
└── deliveryCalculator.js

database_schema_updates.sql (schema changes)
PORTAL_ACCESS_IMPLEMENTATION.md (full documentation)
```

## Support

For issues or questions:
1. Check PORTAL_ACCESS_IMPLEMENTATION.md for detailed documentation
2. Review database_schema_updates.sql for schema requirements
3. Verify environment variables are set correctly
4. Check browser console for errors

## Next Steps

After deployment:
1. Test all portals with real users
2. Add Google Maps integration for rider deliveries
3. Implement real-time billing notifications
4. Add kitchen order slip generation
5. Set up monitoring and analytics
