# Storage Bucket Setup Guide

## Overview
This guide explains how to create and configure the `reviews` storage bucket in Supabase for customer review image uploads.

## Error Fixed
The error "Bucket not found" occurs when the `reviews` storage bucket doesn't exist in Supabase.

## Setup Instructions

### 1. Create the Reviews Bucket

#### Via Supabase Dashboard:
1. Go to your Supabase project dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **New Bucket**
4. Configure the bucket:
   - **Name**: `reviews`
   - **Public**: ✅ Checked (allow public access to review images)
   - **File size limit**: 5 MB
   - **Allowed MIME types**: 
     - `image/jpeg`
     - `image/png`
     - `image/webp`
     - `image/gif`

#### Via Supabase SQL Editor (Alternative):
```sql
-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('reviews', 'reviews', true);
```

### 2. Configure Bucket Policies

After creating the bucket, set up the following policies:

#### Policy 1: Allow Authenticated Users to Upload
```sql
CREATE POLICY "Allow authenticated uploads to reviews"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'reviews');
```

#### Policy 2: Allow Public Read Access
```sql
CREATE POLICY "Allow public read access to reviews"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'reviews');
```

#### Policy 3: Allow Users to Update/Delete Their Own Files
```sql
CREATE POLICY "Allow users to update their own review images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'reviews' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Allow users to delete their own review images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'reviews' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### 3. Folder Structure

Review images are stored with the following path structure:
```
reviews/
└── review-images/
    └── {uuid}.{extension}
```

Example: `reviews/review-images/19bfe1aa-3001-41b8-9d8a-9bc712090f25.jpg`

### 4. Verification

To verify the bucket was created successfully:

1. **Via Dashboard**: 
   - Go to Storage → Check if "reviews" bucket appears in the list

2. **Via SQL**:
```sql
SELECT * FROM storage.buckets WHERE id = 'reviews';
```

Expected result:
```
id      | name    | public | created_at
--------|---------|--------|------------
reviews | reviews | true   | <timestamp>
```

### 5. Test Upload

Test the bucket by uploading a test image via the dashboard or programmatically:

```javascript
const { data, error } = await supabase.storage
  .from('reviews')
  .upload('test/test-image.jpg', file);

if (error) {
  console.error('Upload failed:', error);
} else {
  console.log('Upload successful:', data);
}
```

## Image Upload in Customer Reviews

The customer reviews page (`/customer/reviews`) uses this bucket to store review images:

- **Maximum images per review**: 5
- **Maximum file size**: 5 MB per image
- **Supported formats**: JPEG, PNG, WebP, GIF
- **Storage path**: `reviews/review-images/{uuid}.{ext}`

## Troubleshooting

### Error: "Bucket not found"
- **Cause**: The `reviews` bucket hasn't been created yet
- **Solution**: Follow steps 1-2 above to create the bucket

### Error: "New row violates row-level security policy"
- **Cause**: Storage policies haven't been configured
- **Solution**: Run the policy SQL statements from step 2

### Error: "File size exceeds limit"
- **Cause**: Image file is larger than 5 MB
- **Solution**: Ask user to compress the image or choose a smaller file

### Error: "Invalid MIME type"
- **Cause**: User tried to upload a non-image file
- **Solution**: Validate file type on the client side before upload

## Related Files

- **Customer Reviews Page**: `/pages/customer/reviews.js`
- **Database Schema**: `/database_complete_schema.sql`
- **Review Image Upload Guide**: `/REVIEW_IMAGE_UPLOAD_GUIDE.md`

## Security Considerations

1. **Public Bucket**: Review images are publicly accessible by design (for display on website)
2. **RLS Policies**: Users can only modify/delete their own images
3. **File Size Limits**: Prevent abuse by limiting file sizes to 5 MB
4. **MIME Type Validation**: Only allow image uploads
5. **Authentication**: Uploads require authenticated users
