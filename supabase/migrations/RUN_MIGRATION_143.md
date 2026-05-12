# Migration 143: Harden Order Completion Notification and Loyalty Triggers

## Problem

Clicking **"Order Complete"** for Pick-up orders sometimes fails with an error alert even though the order is in the correct `out_for_delivery` state.

The root causes are:

1. **`notify_customer_on_order_status_change()`** had no `EXCEPTION WHEN OTHERS` handler.  
   Any failure in this trigger (e.g. a foreign-key violation on `notifications.user_id`) rolled back the entire `UPDATE orders SET status = 'order_delivered'` statement, causing the cashier to see *"Failed to update order status."*

2. **`award_loyalty_points_on_order_completion()`** had no `EXCEPTION WHEN OTHERS` handler.  
   Same problem — any edge-case failure (e.g. a loyalty-balance constraint issue) rolled back the order update.

3. **`pickup` (no hyphen) not recognized** in the notification trigger.  
   Orders with `order_mode = 'pickup'` (no hyphen) received the wrong notification copy ("Order Delivered" instead of "Order Complete") because only `'pick-up'` (with hyphen) was explicitly matched.

## What This Migration Does

| Change | Details |
|--------|---------|
| Wrap notification trigger body in `BEGIN … EXCEPTION WHEN OTHERS … END` | Trigger failures are logged as `WARNING` and never block the order update |
| Wrap loyalty trigger body in `BEGIN … EXCEPTION WHEN OTHERS … END` | Same as above |
| Extend all `pick-up` comparisons to also match `pickup` | Both spellings now get the correct "Order Ready for Pick-up" / "Order Complete" notifications |

## How to Run

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project → **SQL Editor**.
2. Click **+ New query**.
3. Copy the entire content of `supabase/migrations/143_harden_order_completion_notification_and_loyalty_triggers.sql`.
4. Paste into the editor and click **RUN** (`Ctrl + Enter`).
5. Confirm the **Results** tab shows no errors and the NOTICE message:
   ```
   Migration 143: notification and loyalty triggers hardened.
   ```

### Option 2: psql

```bash
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" \
  -f supabase/migrations/143_harden_order_completion_notification_and_loyalty_triggers.sql
```

## Verification

```sql
-- 1. Confirm exception handling is present in the notification trigger
SELECT pg_get_functiondef('notify_customer_on_order_status_change'::regproc);
-- Expected: body contains 'EXCEPTION WHEN OTHERS'

-- 2. Confirm exception handling is present in the loyalty trigger
SELECT pg_get_functiondef('award_loyalty_points_on_order_completion'::regproc);
-- Expected: body contains 'EXCEPTION WHEN OTHERS'

-- 3. Confirm pickup (no hyphen) is handled in the notification function
SELECT pg_get_functiondef('notify_customer_on_order_status_change'::regproc);
-- Expected: body contains 'pickup' alongside 'pick-up'
```

## Testing

1. In the customer app, create a **Pick-up** order.
2. Go to **Cashier → Orders Queue** and accept it through to `order_in_process`.
3. Click **"✅ Ready for Pick-Up"** — order moves to `out_for_delivery`.
4. Click **"✓ Order Complete"** — order should complete instantly with the "Order marked as complete!" alert, **no error**.

## Related

- `supabase/migrations/143_harden_order_completion_notification_and_loyalty_triggers.sql` — SQL to run
- `supabase/migrations/142_harden_customer_purchase_tracking_trigger.sql` — Previous fix (purchase tracking)
- `pages/cashier/orders-queue.js` — JS-side guard: `handleCompletePickup` now verifies order status on any unexpected DB error
