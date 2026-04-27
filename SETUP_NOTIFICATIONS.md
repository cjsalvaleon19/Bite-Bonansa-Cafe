# Quick Setup Guide: Notifications & Order Status Features

## Prerequisites
- Supabase project set up and running
- Access to Supabase SQL Editor
- Environment variables configured

## Step-by-Step Setup

### 1. Apply Database Migration
Open Supabase SQL Editor and run:
```sql
-- Copy and paste the entire contents of:
-- supabase/migrations/018_create_notifications_system.sql
```

Or use Supabase CLI:
```bash
supabase migration up --db-url your-database-url
```

### 2. Verify Migration
Check that the notifications table and trigger were created:
```sql
-- Check table exists
SELECT * FROM notifications LIMIT 1;

-- Check trigger exists
SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_notify_customer_on_order_status';

-- Check function exists
SELECT proname FROM pg_proc WHERE proname = 'notify_customer_on_order_status_change';
```

### 3. Environment Variables
Ensure these are set in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Enable Supabase Realtime (if not already enabled)
1. Go to Supabase Dashboard → Database → Replication
2. Find the `notifications` table
3. Toggle "Enable Realtime" to ON

### 5. Deploy Application
```bash
# Install dependencies (if any new ones)
npm install

# Build and deploy
npm run build
```

### 6. Test the Features

#### Test Notifications
1. Log in as a customer
2. You should see the notification bell (🔔) in the header
3. Place an order
4. As admin/cashier, update the order status
5. Customer should receive a notification

#### Test Order Status Count
1. Log in as a customer
2. Go to Dashboard
3. Place one or more orders
4. The "Order Status" card should show the count of pending orders

#### Test Pick-up Orders
1. Place an order with order_mode = 'pick-up'
2. Go to Order Tracking page
3. Verify:
   - "Pick-up" badge is shown
   - Delivery Address shows "Pick-up"
   - Progress shows "Ready for Pick-up" (when status is out_for_delivery)

### 7. Send Manual Notifications (Optional)
Use the API to send announcements:
```bash
curl -X POST https://your-app-url/api/notifications/create \
  -H "Content-Type: application/json" \
  -d '{
    "type": "announcement",
    "title": "Welcome!",
    "message": "Try our new notification system!"
  }'
```

## Troubleshooting

### Issue: Notifications not showing
**Solution:**
1. Check browser console for errors
2. Verify Supabase realtime is enabled for `notifications` table
3. Check RLS policies are enabled

### Issue: Trigger not firing
**Solution:**
1. Verify trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'trigger_notify_customer_on_order_status';`
2. Check order has `customer_id` set
3. Verify order status is changing (not staying the same)

### Issue: "Table does not exist" error
**Solution:**
1. Run the migration again
2. Check you're connected to the correct database
3. Verify migration completed without errors

## What's Next?
- Monitor notifications in production
- Consider adding email/SMS integration
- Add notification preferences for users
- Implement notification archive/history

## Support
For detailed documentation, see `NOTIFICATIONS_IMPLEMENTATION.md`
