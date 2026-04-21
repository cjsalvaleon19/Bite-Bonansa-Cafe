# Review Image Upload Setup Guide

This guide explains how to set up image upload functionality for customer reviews.

## Overview

The customer review system allows users to attach up to 5 images per review. Images are stored in Supabase Storage and referenced in the `customer_reviews` table via the `image_urls` column.

## Setup Steps

### 1. Create Storage Bucket in Supabase

1. Open your Supabase Dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **New Bucket**
4. Configure the bucket:
   - **Name**: `reviews`
   - **Public bucket**: ✅ Enable (so images can be viewed publicly)
   - **File size limit**: 5 MB (recommended)
   - **Allowed MIME types**: `image/jpeg`, `image/jpg`, `image/png`, `image/gif`, `image/webp`

5. Click **Create bucket**

### 2. Set Up Storage Policies

After creating the bucket, you need to set up policies for who can upload and view images.

1. In the Storage section, click on the `reviews` bucket
2. Go to the **Policies** tab
3. Add the following policies:

#### Policy 1: Allow authenticated users to upload images

```sql
CREATE POLICY "Authenticated users can upload review images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'reviews' AND
  (storage.foldername(name))[1] = 'review-images'
);
```

#### Policy 2: Allow public access to view images

```sql
CREATE POLICY "Public can view review images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'reviews');
```

#### Policy 3: Allow users to delete their own uploaded images

```sql
CREATE POLICY "Users can delete their own review images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'reviews' AND
  (storage.foldername(name))[1] = 'review-images' AND
  auth.uid()::text = (storage.filename(name))::text
);
```

### 3. Update Supabase Environment Variables

Make sure your `.env.local` file has the correct Supabase configuration:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 4. Verify Setup

Test the setup by:

1. Log in as a customer
2. Navigate to **Share Review** page
3. Click **Write a Review**
4. Try uploading an image
5. Submit the review
6. Check Supabase Storage > reviews bucket to see if the image was uploaded

## Image Upload Flow

Here's how the image upload process works:

1. **User Selection**: User selects up to 5 images (max 5MB each)
2. **Client-side Validation**: 
   - Check file count (max 5)
   - Check file types (JPEG, PNG, GIF, WebP only)
   - Check file size (max 5MB per file)
3. **Preview**: Images are previewed using `URL.createObjectURL()`
4. **Upload on Submit**: When user submits the review:
   - Images are uploaded to `reviews/review-images/` folder
   - Each file is renamed to: `{userId}-{timestamp}-{random}.{ext}`
   - Public URLs are retrieved
5. **Database Storage**: Array of public URLs is stored in `customer_reviews.image_urls` column

## File Naming Convention

Images are stored with cryptographically secure random filenames:
```
review-images/{secureRandomId}.{extension}
```

Example:
```
review-images/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg
```

The filename uses `crypto.randomUUID()` in modern browsers to ensure uniqueness and prevent filename guessing attacks.

## Security Considerations

1. **File Size Limits**: Each image is limited to 5MB to prevent storage abuse
2. **File Type Validation**: Only image types are allowed (JPEG, PNG, GIF, WebP)
3. **User Authentication**: Only authenticated users can upload images
4. **Folder Isolation**: All review images are stored in `review-images/` folder
5. **Public Access**: Images are publicly accessible (needed for displaying reviews)

## Troubleshooting

### Images not uploading

1. Check if the `reviews` bucket exists in Supabase Storage
2. Verify the bucket is set to **public**
3. Check storage policies are correctly set up
4. Look for errors in browser console
5. Verify Supabase environment variables are correct

### Images not displaying

1. Verify the image URL in the database is correct
2. Check if the bucket has public access enabled
3. Ensure the SELECT policy allows public viewing
4. Check browser console for CORS errors

### Upload fails with "Bucket not found"

1. Make sure the bucket is named exactly `reviews` (case-sensitive)
2. Verify the bucket was created successfully
3. Check network tab for API errors

## Alternative: Using External Storage

If you prefer to use external storage (e.g., AWS S3, Cloudinary):

1. Update the upload function in `pages/customer/reviews.js`
2. Replace Supabase Storage calls with your storage provider's SDK
3. Store the returned URLs in the same `image_urls` array field
4. No changes needed to the database schema

## Database Schema Reference

The `customer_reviews` table has the following image-related field:

```sql
image_urls TEXT[] -- Array of image URLs (can store up to ~1000 URLs)
```

Example data:
```json
{
  "image_urls": [
    "https://your-project.supabase.co/storage/v1/object/public/reviews/review-images/user1-1234567890-abc123.jpg",
    "https://your-project.supabase.co/storage/v1/object/public/reviews/review-images/user1-1234567891-def456.png"
  ]
}
```

## Features Implemented

✅ Upload up to 5 images per review  
✅ Client-side validation (file type, size, count)  
✅ Image preview before submission  
✅ Automatic file renaming for uniqueness  
✅ Public URL generation  
✅ Display images in review cards  
✅ Remove images before submission  

## Next Steps

After setting up the storage bucket:

1. Run the database schema updates (`database_role_and_schema_fixes.sql`)
2. Create the storage bucket as described above
3. Set up the storage policies
4. Test the image upload functionality
5. Monitor storage usage in Supabase Dashboard
