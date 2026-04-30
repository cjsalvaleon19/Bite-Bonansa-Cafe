# Fix Receipt Payment Fields Display

## Problem Statement

The receipt was missing 4 key fields when printing customer orders:

1. **Amount Tendered** - Not displayed (was being hidden by conditional logic)
2. **Change** - Not displayed (was being hidden by conditional logic)
3. **Payment Method** - Displayed correctly ✓
4. **Special Instructions** - Incorrectly showing "Cash tendered: ₱150.00" instead of actual customer order notes

### Example of the Issue

From the receipt image:
```
SPECIAL INSTRUCTIONS
| Cash tendered: ₱150.00
```

This should have shown actual customer notes (if any), and the "Amount Tendered" and "Change" should have been in the payment section, not in special instructions.

---

## Root Cause Analysis

### Issue 1: Payment Data in Wrong Field

The customer order page (`app/customer/order/page.tsx`) was appending payment information to the `special_request` field:

```typescript
// OLD CODE (WRONG)
if (paymentMethod === 'cash' && cashTendered) {
  notesStr += ` | Cash tendered: ${formatCurrency(parseFloat(cashTendered))}`
}
if (paymentMethod === 'gcash' && gcashRef) {
  notesStr += ` | GCash ref: ${gcashRef}`
}
// ... etc
```

This caused:
- Payment details to appear under "Special Instructions" on the receipt
- The actual database fields (`cash_amount`, `gcash_amount`, etc.) to remain empty (0 or null)

### Issue 2: Missing Database Fields

The customer order insert was NOT saving payment details to the proper fields:

```typescript
// OLD CODE (WRONG) - Missing payment fields
.insert({
  // ... other fields
  special_request: notesStr.trim(),  // Contains payment info ❌
  // NO cash_amount ❌
  // NO gcash_amount ❌
  // NO gcash_reference ❌
  // NO points_used ❌
})
```

### Issue 3: Receipt Conditional Display

The receipt printing logic was correctly checking `amountTendered > 0` before displaying "Amount Tendered" and "Change":

```javascript
${amountTendered > 0 ? `
  <tr>
    <td><strong>Amount Tendered:</strong></td>
    <td style="text-align: right;">₱${amountTendered.toFixed(2)}</td>
  </tr>
  <tr>
    <td><strong>Change:</strong></td>
    <td style="text-align: right;">₱${change.toFixed(2)}</td>
  </tr>
` : ''}
```

However, because `order.cash_amount` was 0 (not saved), the condition failed and the fields were hidden.

---

## Solution Implemented

### Fix 1: Remove Payment Info from special_request

**File:** `app/customer/order/page.tsx`

Removed the code that appended payment details to the notes string:

```typescript
// NEW CODE (FIXED)
// Note: Payment details are now stored in dedicated fields (cash_amount, gcash_amount, gcash_reference, points_used)
// Don't append payment info to special_request - keep it for actual customer notes only
```

Now `special_request` only contains actual customer order notes, not payment information.

### Fix 2: Save Payment Fields to Database

**File:** `app/customer/order/page.tsx`

Updated the order insert to include all payment fields:

```typescript
// NEW CODE (FIXED)
// Determine final payment method string for combined payments
let finalPaymentMethod = paymentMethod
if (paymentMethod === 'points' && remainingBalance > 0 && secondaryPaymentMethod) {
  finalPaymentMethod = `points+${secondaryPaymentMethod}`
}

const { data: order, error: orderError } = await supabase
  .from('orders')
  .insert({
    // ... existing fields
    payment_method: finalPaymentMethod,  // Updated to handle combined payments
    special_request: notesStr.trim() || null,  // Only customer notes
    
    // Payment details stored in dedicated fields
    cash_amount: (paymentMethod === 'cash' || secondaryPaymentMethod === 'cash') 
      ? parseFloat(cashTendered || '0') 
      : 0,
    gcash_amount: (paymentMethod === 'gcash' || secondaryPaymentMethod === 'gcash') 
      ? (remainingBalance > 0 ? remainingBalance : total) 
      : 0,
    gcash_reference: (paymentMethod === 'gcash' || secondaryPaymentMethod === 'gcash') 
      ? gcashRef || null 
      : null,
    points_used: paymentMethod === 'points' ? actualPointsToUse : 0,
  } as any)
```

### Fix 3: Use order.cash_amount in POS Receipt

**File:** `pages/cashier/pos.js`

Updated POS receipt printing to consistently use `order.cash_amount`:

```javascript
// NEW CODE (FIXED)
// Get cash amount from order (already saved to database) or fallback to component state
const amountTendered = order.cash_amount || 0;
const change = Math.max(0, amountTendered - netAmount);
```

Previously it was using component state (`paymentDetails.cashTendered`), which is less reliable than the database value.

---

## Expected Behavior After Fix

### For Cash Payments

When a customer places an order with cash payment and tenders ₱150.00 for a ₱104.00 order:

**Receipt should display:**
```
Subtotal:                           ₱104.00
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL:                              ₱104.00
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Net Amount:                         ₱104.00
Amount Tendered:                    ₱150.00  ← NOW SHOWS
Change:                              ₱46.00  ← NOW SHOWS
- - - - - - - - - - - - - - - - - - - - - - -
Payment Method:                        Cash

SPECIAL INSTRUCTIONS
(empty or actual customer notes)              ← NO PAYMENT INFO
```

### For GCash Payments

When a customer pays with GCash:

**Database fields saved:**
- `payment_method`: "gcash"
- `gcash_amount`: (total amount)
- `gcash_reference`: (reference number from customer)
- `cash_amount`: 0
- `special_request`: (only customer notes)

**Receipt should display:**
```
Net Amount:                         ₱104.00
Payment Method:                       GCash

SPECIAL INSTRUCTIONS
(empty or actual customer notes)              ← NO PAYMENT INFO
```

Note: Amount Tendered and Change are hidden for GCash (since `cash_amount` is 0), which is correct.

### For Points + Cash Payments

When a customer uses 50 points + cash to pay:

**Database fields saved:**
- `payment_method`: "points+cash"
- `points_used`: 50
- `cash_amount`: (tendered amount)
- `special_request`: (only customer notes)

**Receipt should display:**
```
Subtotal:                           ₱104.00
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL:                              ₱104.00
Points Claimed:                      -₱50.00  ← Shows points
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Net Amount:                          ₱54.00
Amount Tendered:                    ₱100.00  ← Shows cash
Change:                              ₱46.00
- - - - - - - - - - - - - - - - - - - - - - -
Payment Method:                        Cash   ← Shows secondary method

SPECIAL INSTRUCTIONS
(empty or actual customer notes)              ← NO PAYMENT INFO
```

---

## Database Schema

The following fields are now properly utilized in the `orders` table:

| Field | Type | Description |
|-------|------|-------------|
| `cash_amount` | DECIMAL | Amount of cash tendered by customer (0 if not cash payment) |
| `gcash_amount` | DECIMAL | Amount paid via GCash (0 if not GCash payment) |
| `gcash_reference` | VARCHAR | GCash reference number (null if not GCash) |
| `points_used` | DECIMAL | Loyalty points used for payment (0 if no points) |
| `payment_method` | VARCHAR | Payment method: 'cash', 'gcash', 'points', 'points+cash', 'points+gcash' |
| `special_request` | TEXT | Customer order notes/instructions ONLY (no payment info) |

---

## Testing Checklist

To verify the fix works correctly, test the following scenarios:

### Test 1: Cash Payment (Pick-up Order)
- [ ] Place pick-up order as customer
- [ ] Select cash payment
- [ ] Enter cash tendered: ₱150.00 for ₱104.00 order
- [ ] Add order note: "Extra napkins please"
- [ ] Verify order is created
- [ ] Check database: `cash_amount` = 150.00
- [ ] Check database: `special_request` = "Extra napkins please" (no payment info)
- [ ] Cashier accepts order
- [ ] Verify receipt shows:
  - ✅ Amount Tendered: ₱150.00
  - ✅ Change: ₱46.00
  - ✅ Payment Method: Cash
  - ✅ Special Instructions: "Extra napkins please"

### Test 2: GCash Payment (Delivery Order)
- [ ] Place delivery order as customer
- [ ] Select GCash payment
- [ ] Enter GCash reference: "ABC123456"
- [ ] Upload payment proof screenshot
- [ ] Add order note: "Ring doorbell twice"
- [ ] Verify order is created
- [ ] Check database: `gcash_amount` = (total)
- [ ] Check database: `gcash_reference` = "ABC123456"
- [ ] Check database: `special_request` = "Ring doorbell twice" (no payment info)
- [ ] Cashier accepts order
- [ ] Verify receipt shows:
  - ✅ Payment Method: GCash
  - ✅ Special Instructions: "Ring doorbell twice"
  - ✅ NO "Amount Tendered" (correct for GCash)
  - ✅ NO "Change" (correct for GCash)

### Test 3: Points + Cash Payment
- [ ] Customer with 50 points balance
- [ ] Place ₱104.00 order
- [ ] Select points payment
- [ ] Use 50 points
- [ ] Select cash for remaining ₱54.00
- [ ] Enter cash tendered: ₱100.00
- [ ] Verify order is created
- [ ] Check database: `points_used` = 50
- [ ] Check database: `cash_amount` = 100.00
- [ ] Check database: `payment_method` = "points+cash"
- [ ] Cashier accepts order
- [ ] Verify receipt shows:
  - ✅ Points Claimed: -₱50.00
  - ✅ Net Amount: ₱54.00
  - ✅ Amount Tendered: ₱100.00
  - ✅ Change: ₱46.00
  - ✅ Payment Method: Cash

### Test 4: Walk-in POS Order (Cash)
- [ ] Cashier creates walk-in order at POS
- [ ] Add items totaling ₱104.00
- [ ] Select cash payment
- [ ] Enter cash tendered: ₱200.00
- [ ] Click Checkout
- [ ] Verify receipt prints with:
  - ✅ Amount Tendered: ₱200.00
  - ✅ Change: ₱96.00
  - ✅ Payment Method: Cash

### Test 5: Order Without Special Instructions
- [ ] Place order without entering any notes
- [ ] Verify receipt does NOT show "SPECIAL INSTRUCTIONS" section
- [ ] OR shows section with "(empty)" or nothing

---

## Files Changed

1. **app/customer/order/page.tsx**
   - Removed payment info from `special_request` string concatenation
   - Added `cash_amount`, `gcash_amount`, `gcash_reference`, `points_used` to order insert
   - Added logic to determine `finalPaymentMethod` for combined payments

2. **pages/cashier/pos.js**
   - Updated `printReceipt` to use `order.cash_amount` instead of component state
   - Ensures consistency between POS and online orders

---

## Compatibility Notes

### Existing Orders in Database

Orders created before this fix will have:
- `cash_amount` = 0 or NULL
- `special_request` may contain "Cash tendered: ₱XXX.XX"

These old orders will:
- NOT show "Amount Tendered" and "Change" on reprinted receipts (because `cash_amount` is 0)
- Still show payment info in "Special Instructions" section

This is acceptable as these are historical orders. New orders will display correctly.

### Migration Considerations

No database migration is required because:
- The `cash_amount`, `gcash_amount`, `gcash_reference`, and `points_used` columns already exist in the `orders` table
- We're just starting to populate them correctly from the customer order flow
- POS orders were already saving these fields correctly

---

## Related Code References

### Receipt Printing Logic

Both `pages/cashier/dashboard.js` (online orders) and `pages/cashier/pos.js` (walk-in orders) use the same receipt format logic:

```javascript
// Dashboard.js line 326-327
const amountTendered = order.cash_amount || 0;
const change = Math.max(0, amountTendered - netAmount);

// POS.js line 512-513 (NOW FIXED)
const amountTendered = order.cash_amount || 0;
const change = Math.max(0, amountTendered - netAmount);
```

Both files conditionally display Amount Tendered and Change:

```javascript
${amountTendered > 0 ? `
  <tr>
    <td><strong>Amount Tendered:</strong></td>
    <td style="text-align: right;">₱${amountTendered.toFixed(2)}</td>
  </tr>
  <tr>
    <td><strong>Change:</strong></td>
    <td style="text-align: right;">₱${change.toFixed(2)}</td>
  </tr>
` : ''}
```

This is correct behavior - these fields should only show for cash payments.

### Payment Method Display Logic

Both receipt templates have logic to display the payment method correctly for combined payments:

```javascript
let displayPaymentMethod = order.payment_method || 'N/A';
if (pointsClaimed > 0) {
  if (pointsClaimed >= total) {
    displayPaymentMethod = 'Points';  // Fully paid by points
  } else {
    // Extract secondary method from "points+cash" -> "cash"
    if (order.payment_method && order.payment_method.includes('points+')) {
      displayPaymentMethod = order.payment_method.split('points+')[1];
    }
  }
}
```

This ensures that when a customer uses points + cash, the receipt shows "Cash" as the payment method (since that's what was tendered).

---

## Conclusion

The fix ensures that:

1. ✅ **Amount Tendered** is displayed for all cash payments
2. ✅ **Change** is calculated and displayed correctly
3. ✅ **Payment Method** continues to display correctly
4. ✅ **Special Instructions** only shows actual customer notes, not payment information

All payment details are now stored in their dedicated database fields, making the data properly structured and the receipts display correctly.
