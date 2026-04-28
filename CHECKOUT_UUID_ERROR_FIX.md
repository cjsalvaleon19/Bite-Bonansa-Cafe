# Checkout UUID Error Fix

## Problem

When attempting to checkout with GCash (or any payment method) in the POS system, the following error occurred:

```
[POS] Checkout failed: invalid input syntax for type uuid: "BBC-73048"
Failed to load resource: the server responded with a status of 400
```

## Root Cause

The issue was caused by confusion between two different `customer_id` fields in the database:

1. **`users.customer_id`** - VARCHAR(50) field that stores the loyalty card ID (e.g., "BBC-73048")
2. **`orders.customer_id`** - UUID field that references `users.id` (the user's UUID)

The POS code was incorrectly using the loyalty card ID (a string like "BBC-73048") when trying to insert into `orders.customer_id`, which expects a UUID value.

## Database Schema

```sql
-- users table
ALTER TABLE users ADD COLUMN customer_id VARCHAR(50) UNIQUE;  -- Loyalty card ID: "BBC-73048"

-- orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- User UUID
  ...
);
```

## Solution

The fix involved three changes to `/pages/cashier/pos.js`:

### 1. Updated State to Store Both IDs

```javascript
const [customerInfo, setCustomerInfo] = useState({
  userId: null,        // NEW: UUID from users.id (for orders.customer_id)
  customerId: '',      // Loyalty card ID from users.customer_id (BBC-XXXXX)
  customerName: 'Walk-in',
  address: '',
  contactNumber: '',
});
```

### 2. Updated Customer Lookup Functions

When fetching customer data, we now store both the UUID and the loyalty card ID:

```javascript
// fetchCustomerData
setCustomerInfo({
  ...customerInfo,
  userId: data.id,                          // Store UUID
  customerId: data.customer_id || customerId, // Store loyalty card ID
  customerName: data.full_name || 'Customer',
  address: data.address || '',
  contactNumber: data.phone || '',
});

// selectCustomer
setCustomerInfo({
  userId: customer.id,                    // Store UUID
  customerId: customer.customer_id || '', // Store loyalty card ID
  customerName: customer.full_name || 'Customer',
  address: customer.address || '',
  contactNumber: customer.phone || '',
});
```

### 3. Updated Checkout to Use UUID

```javascript
const orderData = {
  ...
  customer_id: customerInfo.userId || null,  // Use UUID, not loyalty card ID
  ...
};
```

### 4. Simplified Loyalty Points Deduction

Since we now have the UUID stored in state, we removed the extra database lookup:

```javascript
// Before (required extra lookup)
if (finalPointsUsed > 0 && customerInfo.customerId) {
  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('customer_id', customerInfo.customerId)
    .maybeSingle();
  
  if (userData) {
    await supabase.from('loyalty_transactions').insert({
      customer_id: userData.id,  // Had to look up UUID
      ...
    });
  }
}

// After (use UUID directly from state)
if (finalPointsUsed > 0 && customerInfo.userId) {
  await supabase.from('loyalty_transactions').insert({
    customer_id: customerInfo.userId,  // Use UUID directly
    ...
  });
}
```

## Testing

To verify the fix works:

1. Open the POS system at `/cashier/pos`
2. Add items to the cart
3. Enter a customer loyalty ID (e.g., "BBC-12345")
4. Select GCash as payment method
5. Enter GCash reference number
6. Click "Complete Order"
7. Verify the order is created successfully without UUID errors

## Impact

This fix resolves the checkout error for all payment methods (Cash, GCash, and Points) when a customer loyalty ID is used. Walk-in customers (with no loyalty ID) were not affected by this bug since `customerInfo.userId` would be `null`, which is valid for the `orders.customer_id` field.
