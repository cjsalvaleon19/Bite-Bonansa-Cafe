# Order Page Improvements

## Overview
This document outlines the improvements made to the customer order page to enhance navigation and payment verification.

## Features Added

### 1. Back Button Navigation
- **Location**: Top-left of the Order page
- **Function**: Navigates users back to the Customer Dashboard (`/customer/dashboard`)
- **Icon**: Arrow Left icon from lucide-react
- **Styling**: Ghost button with hover effect matching the theme

### 2. GCash Payment Screenshot Upload (Required)

#### Purpose
To verify GCash payments, customers are now **required** to upload a screenshot of their payment confirmation before placing an order.

#### Implementation Details

##### File Upload Validation
- **Accepted formats**: Image files only (JPEG, PNG, WebP, GIF)
- **Maximum file size**: 5 MB
- **Required field**: Users cannot submit GCash payment without uploading a screenshot

##### Storage Configuration
- **Bucket**: `payment-proofs` (public bucket)
- **Storage path**: `payment-proofs/{userId}_{timestamp}.{extension}`
- **Example**: `payment-proofs/abc123_1745678901234.jpg`

##### User Flow
1. Customer selects GCash as payment method
2. Clicks "Place Order"
3. GCash dialog opens with:
   - GCash recipient details
   - Amount to send
   - Link to open GCash app
   - Reference number input field
   - **Screenshot upload field (required)**
4. Customer enters reference number
5. Customer uploads payment screenshot
6. Both fields must be filled before "Confirm Payment" button is enabled
7. Screenshot is uploaded to Supabase Storage
8. Screenshot URL is stored in order notes

##### UI Components
- **File Input**: Standard file input styled with theme colors
- **Preview**: Shows uploaded image with option to remove
- **Remove Button**: Red X button in top-right corner of preview
- **Required Indicator**: Red asterisk (*) next to label

##### Data Storage
Payment screenshot URL is stored in the order's `special_request` field with format:
```
| GCash ref: {reference_number} | GCash proof: {screenshot_url}
```

Example:
```
Customer notes | GCash ref: 1234567890 | GCash proof: https://xyz.supabase.co/storage/v1/object/public/payment-proofs/user123_1234567890.jpg
```

## Database Setup Required

### Create Payment Proofs Storage Bucket

Run the SQL script to create the storage bucket:

```bash
# Execute in Supabase SQL Editor
cat setup_payment_proofs_bucket.sql
```

Or manually via Supabase Dashboard:
1. Go to **Storage** in Supabase Dashboard
2. Click **New Bucket**
3. Configure:
   - Name: `payment-proofs`
   - Public: ✅ Checked
   - File size limit: 5 MB

### Storage Policies

The following RLS policies are automatically created by the SQL script:

1. **Allow authenticated uploads**: Customers can upload their payment proofs
2. **Allow public read access**: Staff can view payment proofs for verification
3. **Allow staff to view all**: Admin and cashier roles have full read access

## Benefits

### For Customers
- ✅ Clear navigation with back button
- ✅ Better payment verification process
- ✅ Visual confirmation of uploaded screenshot

### For Business
- ✅ Reduced payment fraud
- ✅ Visual proof of GCash payments
- ✅ Easier payment verification for staff
- ✅ Better audit trail

## Technical Details

### State Management
```typescript
const [gcashScreenshot, setGcashScreenshot] = useState<File | null>(null)
const [gcashScreenshotPreview, setGcashScreenshotPreview] = useState<string | null>(null)
```

### File Upload Logic
```typescript
// 1. Validate file type and size
if (!file.type.startsWith('image/')) {
  toast.error('Please upload an image file')
  return
}
if (file.size > 5 * 1024 * 1024) {
  toast.error('Image size must be less than 5MB')
  return
}

// 2. Upload to Supabase Storage
const { data, error } = await supabase.storage
  .from('payment-proofs')
  .upload(filePath, gcashScreenshot)

// 3. Get public URL
const { data: urlData } = supabase.storage
  .from('payment-proofs')
  .getPublicUrl(filePath)
```

### Button Validation
The "Confirm Payment" button is disabled when:
- Reference number is empty
- Screenshot is not uploaded
- Order is being submitted (loading state)

## Files Modified

1. **`app/customer/order/page.tsx`**
   - Added back button with navigation to `/customer/dashboard`
   - Added GCash screenshot upload state management
   - Updated GCashDialog component with file upload
   - Added screenshot upload to submitOrder function
   - Added file validation and preview functionality

2. **`setup_payment_proofs_bucket.sql`** (New)
   - SQL script to create payment-proofs storage bucket
   - RLS policies for secure access control

## Migration Notes

### For Existing Installations

1. **Run the SQL setup script** in Supabase SQL Editor:
   ```sql
   -- Execute setup_payment_proofs_bucket.sql
   ```

2. **Verify bucket creation**:
   - Check Storage section in Supabase Dashboard
   - Confirm `payment-proofs` bucket exists

3. **Test the upload**:
   - Place a test order with GCash payment
   - Upload a test screenshot
   - Verify file appears in Storage bucket
   - Verify URL is stored in order notes

## Security Considerations

1. **File Type Validation**: Client-side validation prevents non-image uploads
2. **File Size Limit**: 5 MB limit prevents abuse
3. **Authentication Required**: Only authenticated users can upload
4. **Public Read Access**: Required for staff to verify payments
5. **RLS Policies**: Proper access control via Row Level Security

## Future Enhancements

Potential improvements for future versions:
- [ ] Image compression before upload
- [ ] Thumbnail generation
- [ ] Direct link to payment proof in admin/cashier order view
- [ ] Automatic image validation (check for GCash logo/UI)
- [ ] Payment proof gallery in staff portal

## Support

For issues or questions:
1. Check that the `payment-proofs` bucket exists in Supabase Storage
2. Verify RLS policies are properly configured
3. Check browser console for upload errors
4. Verify file size is under 5 MB
5. Ensure file is a valid image format
