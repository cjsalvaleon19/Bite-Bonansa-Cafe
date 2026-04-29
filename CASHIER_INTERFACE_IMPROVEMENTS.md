# Cashier Interface Improvements

This document details the improvements made to the Cashier Interface to enhance order management, notifications, and receipt printing functionality.

## Issues Fixed

### 1. Cashier Notifications for Online Orders ✅

**Problem:** Cashiers had no way of knowing when new online orders (from Customer Interface) arrived without manually checking the Pending Online Orders tab.

**Solution:**
- **Real-time Subscription**: Added real-time database subscription that listens for INSERT events on the orders table
- **Sound Notification**: Plays audio notification when new online order arrives
- **Browser Notification**: Shows desktop notification with order number and type
- **Visual Indicator**: Red pulsing badge on "Pending Online Orders" tab when new orders arrive
- **Auto-clear**: Badge returns to normal yellow when cashier clicks the tab

**Implementation:**
```javascript
// Real-time subscription for new orders
const subscription = supabase
  ?.channel('pending_orders_changes')
  .on('postgres_changes', { 
    event: 'INSERT', 
    schema: 'public', 
    table: 'orders',
    filter: 'status=eq.pending'
  }, (payload) => {
    const newOrder = payload.new;
    if (newOrder.order_mode === 'delivery' || newOrder.order_mode === 'pick-up') {
      setHasNewOrders(true);
      // Play notification sound
      if (notificationAudio) {
        notificationAudio.play();
      }
      // Show browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('New Online Order!', {
          body: `Order #${newOrder.order_number} - ${newOrder.order_mode}`,
        });
      }
    }
    fetchPendingOnlineOrders();
  })
  .subscribe();
```

**Files Changed:**
- `pages/cashier/dashboard.js`

---

### 2. Receipt Printing After Accepting Orders ✅

**Problem:** When cashier accepts an online order, there was no automatic receipt generation for:
- Sales invoice (for records)
- Kitchen order slip (for food preparation)

**Solution:**
- **Sales Invoice Receipt**: Automatically generated when order is accepted
- **Kitchen Order Slip**: Automatically generated with clear "KITCHEN COPY" marking
- **Auto-print**: Opens print dialog automatically for both receipts
- **Complete Information**: Includes order number, items, customer details, totals, and timestamps

**Receipt Contents:**

**Sales Invoice includes:**
- Order number and date
- Order type (delivery/pick-up)
- Customer name and contact
- Delivery address (if applicable)
- Item list with quantities and prices
- Subtotal, delivery fee (if applicable), and total
- Payment method
- Cashier name and timestamp

**Kitchen Order Slip includes:**
- Same order information as sales invoice
- Clear "KITCHEN COPY - DO NOT GIVE TO CUSTOMER" warning
- Focus on items to prepare
- Special instructions/requests
- No pricing information needed by kitchen

**Implementation:**
```javascript
const printReceipt = (order, receiptType = 'sales') => {
  const printWindow = window.open('', '_blank');
  // Generate HTML receipt with order details
  // Auto-print after loading
  setTimeout(() => {
    printWindow.print();
  }, 250);
};

// In handleAcceptOrder:
const order = pendingOrders.find(o => o.id === orderId);
if (order) {
  // Generate sales invoice
  printReceipt(order, 'sales');
  
  // Generate kitchen slip after short delay
  setTimeout(() => {
    printReceipt(order, 'kitchen');
  }, 500);
}
```

**Files Changed:**
- `pages/cashier/dashboard.js`

---

### 3. Display Order Items in Orders Queue ✅

**Problem:** In the Orders Queue, the items ordered were not visible. Cashiers had to click through or manually check what was in each order.

**Solution:**
- **Fetch order_items**: Updated query to include `order_items` relationship
- **Display items list**: Show all items with name, quantity, and price
- **Backward compatible**: Falls back to `items` array if `order_items` not available
- **Show order_number**: Display actual order number instead of UUID

**Implementation:**
```javascript
// Fetch orders with order_items
const { data, error } = await supabase
  .from('orders')
  .select(`
    *,
    order_items (
      id,
      menu_item_id,
      name,
      price,
      quantity,
      subtotal,
      notes
    )
  `)
  .in('status', ['order_in_queue', 'order_in_process'])
  .order('created_at', { ascending: true });

// Display items with fallback
{(order.order_items && order.order_items.length > 0 
  ? order.order_items 
  : order.items || []
).map((item, index) => (
  <div key={index}>
    <span>{item.name}</span>
    <span>x{item.quantity}</span>
    <span>₱{(item.price * item.quantity).toFixed(2)}</span>
  </div>
))}
```

**Files Changed:**
- `pages/cashier/orders-queue.js`
- `pages/cashier/dashboard.js` (Pending Online Orders)

---

### 4. Ready for Pick-Up Button ✅ (Already Implemented)

**Status:** Already implemented in previous work.

**Features:**
- "✅ Ready for Pick-Up" button appears for pick-up orders in `order_in_process` status
- Sets order status to `out_for_delivery` (which displays as "Ready for Pick-up" to customers)
- Sends notification to customer: "Your order #XXX is ready for pick-up!"
- Different from delivery orders which show "🚚 Out for Delivery" button

**Files:**
- `pages/cashier/orders-queue.js` (lines 142-175, 327-334)

---

### 5. Unified Order Numbering ✅ (Already Implemented)

**Status:** Already implemented via database trigger.

**How it works:**
- Database trigger `generate_daily_order_number()` auto-generates sequential 3-digit numbers
- Starts at 001 for first order each day
- Resets daily at midnight
- Works for ALL orders regardless of source:
  - Customer Interface online orders
  - Cashier POS orders
  - Pick-up orders
  - Delivery orders
- Order numbers are NEVER duplicated within a day
- Sequential across all order types

**Implementation:**
- `supabase/migrations/040_fix_order_number_start_at_001.sql`
- Database function handles locking to prevent race conditions
- All order inserts automatically get sequential order_number

---

## Testing Checklist

### Notifications
- [ ] Customer places online order via Customer Interface
- [ ] Verify cashier dashboard plays notification sound
- [ ] Verify browser notification appears with order details
- [ ] Verify "Pending Online Orders" tab shows red pulsing badge
- [ ] Click tab and verify badge returns to yellow
- [ ] Verify order appears in the list

### Receipt Printing
- [ ] Cashier accepts a pending online order
- [ ] Verify sales invoice print dialog opens
- [ ] Verify kitchen order slip print dialog opens (second window)
- [ ] Check sales invoice includes:
  - Order number, date, order type
  - Customer name and contact
  - All items with quantities and prices
  - Subtotal and total
  - Payment method
  - Cashier name
- [ ] Check kitchen slip includes:
  - Same order details
  - "KITCHEN COPY" warning
  - Special instructions if any
- [ ] Verify both receipts are printer-friendly (monospace font, proper formatting)

### Order Items Display
- [ ] Navigate to Orders Queue
- [ ] Verify each order card shows:
  - Order number (e.g., "Order #001")
  - Order type badge
  - List of all items ordered
  - Item quantities
  - Item prices
  - Total amount
- [ ] Verify same information in Pending Online Orders tab
- [ ] Test with both new orders (with order_items) and legacy orders (with items array)

### Ready for Pick-Up (Previously Implemented)
- [ ] Customer places pick-up order
- [ ] Cashier accepts order
- [ ] Verify order appears in Orders Queue
- [ ] Verify "✅ Ready for Pick-Up" button shows (not "Out for Delivery")
- [ ] Click button and verify customer receives notification
- [ ] Verify customer interface shows "Ready for Pick-up" status

### Unified Order Numbering (Previously Implemented)
- [ ] Place order via Customer Interface → Note order number
- [ ] Place order via Cashier POS → Note order number
- [ ] Verify both numbers are sequential (e.g., 045, 046)
- [ ] Verify numbers don't duplicate
- [ ] Next day, verify first order starts at 001

---

## Technical Details

### Database Schema
Orders table includes:
- `order_number` - VARCHAR(3), auto-generated by trigger, starts at 001 daily
- `status` - Status of order (pending, order_in_process, etc.)
- `order_mode` - Type of order (delivery, pick-up, dine-in, take-out)
- `cashier_id` - UUID of cashier who accepted the order

Order_items table (one-to-many relationship):
- `order_id` - Foreign key to orders.id
- `name` - Item name with variant details
- `quantity` - Quantity ordered
- `price` - Price per item
- `subtotal` - Total for this line item

### Real-time Subscriptions
Uses Supabase real-time to listen for:
- INSERT events on orders table (new online orders)
- UPDATE events on orders table (status changes)
- DELETE events on orders table (cancelled orders)

### Browser APIs Used
- **Notification API**: Desktop notifications for new orders
- **Audio API**: Sound notifications
- **Window.print()**: Print receipts
- **LocalStorage**: Store notification preferences (future enhancement)

---

## Notes

- Notification sound requires `public/notification.mp3` file (can use any notification sound)
- Browser notifications require user permission (requested on first load)
- Popup blocker must allow popups for receipt printing
- Receipts use monospace font for thermal printer compatibility
- Receipt templates are optimized for 80mm thermal printers
- Kitchen slips can be customized for different departments (future enhancement)

---

## Future Enhancements

1. **Department-specific Kitchen Slips**
   - Split orders by department (drinks, food, desserts)
   - Route to appropriate kitchen stations

2. **Notification Settings**
   - Allow cashiers to enable/disable sound
   - Choose notification sound
   - Adjust notification volume

3. **Receipt Customization**
   - Add logo image
   - Customize footer message
   - Add promotional messages

4. **Order History on Receipt**
   - Show customer's previous orders
   - Loyalty points balance
   - Earned points for this order

5. **Email Receipts**
   - Send digital copy to customer email
   - Include QR code for order tracking
