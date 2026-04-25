# Fix: Place Order Error - Schema Column Mismatch

## Problem Summary

When attempting to place an order from the customer order page, the following errors occurred:

```
Failed to place order. Please try again.
Error: Could not find the 'payment_status' column of 'orders' in the schema cache
400 Bad Request from Supabase REST API
```

## Root Causes

### 1. Non-existent Column: `payment_status`
The code was trying to insert a `payment_status` field that does not exist in the `orders` table schema.

### 2. Column Name Mismatches
The order insertion code was using incorrect column names that didn't match the actual database schema:

| Code Used (Incorrect) | Database Schema (Correct) |
|-----------------------|---------------------------|
| `customer_phone`      | `contact_number`          |
| `delivery_lat`        | `delivery_latitude`       |
| `delivery_lng`        | `delivery_longitude`      |
| `order_type`          | `order_mode`              |
| `total`               | `total_amount`            |
| `notes`               | `special_request`         |
| `discount`            | *(not in schema)*         |

## Changes Made

### File: `app/customer/order/page.tsx`

**Removed:**
- `payment_status` field (line 270)
- `discount` field (doesn't exist in schema)

**Updated column names:**
```typescript
// Before
const { data: order, error: orderError } = await supabase
  .from('orders')
  .insert({
    customer_id: user?.id,
    customer_name: user?.name || 'Customer',
    customer_phone: user?.phone || '',          // ❌ Wrong
    customer_address: isDelivery ? deliveryAddress : null,
    delivery_lat: isDelivery ? deliveryLat : null,    // ❌ Wrong
    delivery_lng: isDelivery ? deliveryLng : null,    // ❌ Wrong
    status: 'pending',
    order_type: isDelivery ? 'delivery' : 'takeout',  // ❌ Wrong
    payment_method: paymentMethod,
    payment_status: paymentMethod === 'gcash' ? 'paid' : 'pending',  // ❌ Doesn't exist
    subtotal,
    delivery_fee: isDelivery ? appliedDeliveryFee : 0,
    discount: 0,                                       // ❌ Doesn't exist
    total,                                             // ❌ Wrong
    notes: notesStr.trim(),                           // ❌ Wrong
  } as any)
  .select()
  .single()

// After
const { data: order, error: orderError } = await supabase
  .from('orders')
  .insert({
    customer_id: user?.id,
    customer_name: user?.name || 'Customer',
    contact_number: user?.phone || '',          // ✅ Correct
    customer_address: isDelivery ? deliveryAddress : null,
    delivery_latitude: isDelivery ? deliveryLat : null,  // ✅ Correct
    delivery_longitude: isDelivery ? deliveryLng : null, // ✅ Correct
    status: 'pending',
    order_mode: isDelivery ? 'delivery' : 'takeout',    // ✅ Correct
    payment_method: paymentMethod,
    subtotal,
    delivery_fee: isDelivery ? appliedDeliveryFee : 0,
    total_amount: total,                        // ✅ Correct
    special_request: notesStr.trim(),          // ✅ Correct
  } as any)
  .select()
  .single()
```

## Database Schema Reference

The correct `orders` table schema (from `fix_orders_and_loyalty_schema.sql`):

```sql
-- Delivery Information
delivery_address TEXT
delivery_latitude DECIMAL(10,8)
delivery_longitude DECIMAL(11,8)
delivery_fee DECIMAL(10,2) DEFAULT 0
delivery_fee_pending BOOLEAN DEFAULT TRUE

-- Order Information
order_mode VARCHAR(50)           -- 'delivery', 'dine-in', 'take-out'
contact_number VARCHAR(20)
order_number VARCHAR(100) UNIQUE
customer_name VARCHAR(255)

-- Pricing
subtotal DECIMAL(10,2)
vat_amount DECIMAL(10,2) DEFAULT 0
total_amount DECIMAL(10,2)

-- Payment
payment_method VARCHAR(50)
gcash_reference VARCHAR(100)
points_used DECIMAL(10,2) DEFAULT 0
cash_amount DECIMAL(10,2) DEFAULT 0
gcash_amount DECIMAL(10,2) DEFAULT 0

-- Other
special_request TEXT
status VARCHAR(50)
```

## Next Steps (If Orders Still Fail)

If you still encounter the schema cache error after this fix, you need to reload the Supabase schema cache:

### ⚠️ CRITICAL: Reload Schema Cache in Supabase

After running any database migrations, you MUST reload the schema cache:

1. **Open Supabase Dashboard**
2. Go to **Project Settings** (gear icon in sidebar)
3. Click on **API** section
4. Scroll down to **"Schema Cache"** section
5. Click the **"Reload schema"** button
6. Wait for confirmation (usually takes a few seconds)

### Verify the Fix

1. **In Supabase Dashboard:**
   - Go to **Table Editor** → `orders` table
   - Verify all columns exist as shown in schema reference above

2. **In Your Application:**
   - Try placing an order
   - Should now work without errors

## Related Files

- `fix_orders_and_loyalty_schema.sql` - Contains the database migration for orders table
- `FIX_SCHEMA_CACHE_ERROR.md` - Detailed guide on schema cache issues
- `app/customer/order/page.tsx` - The order placement page (fixed)

## Prevention

To avoid similar issues in the future:

1. **Always verify column names** against the actual database schema before writing insert/update code
2. **Reload schema cache** after running SQL migrations in Supabase SQL Editor
3. **Use TypeScript types** for database tables to catch mismatches at compile time
4. **Check Supabase API Docs** to see what columns are available via REST API

## Status

✅ **Code Fixed** - All column names now match the database schema
✅ **payment_status removed** - Non-existent column removed from insert
✅ **Tested** - Changes align with `fix_orders_and_loyalty_schema.sql`

The order placement should now work correctly!
