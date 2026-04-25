-- ═══════════════════════════════════════════════════════════════════════════
-- Payment Proofs Storage Bucket Setup
-- ═══════════════════════════════════════════════════════════════════════════
-- This script creates a storage bucket for GCash payment confirmation screenshots
-- and sets up appropriate RLS policies.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 1: Create the payment-proofs bucket
-- ─────────────────────────────────────────────────────────────────────────────

-- Create the storage bucket (public for staff verification)
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 2: Configure Bucket Policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated uploads to payment-proofs" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to payment-proofs" ON storage.objects;
DROP POLICY IF EXISTS "Allow staff to view all payment proofs" ON storage.objects;

-- Policy 1: Allow authenticated customers to upload payment proofs
CREATE POLICY "Allow authenticated uploads to payment-proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-proofs' AND
  auth.uid() IS NOT NULL
);

-- Policy 2: Allow public read access (for staff verification)
CREATE POLICY "Allow public read access to payment-proofs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'payment-proofs');

-- Policy 3: Allow staff (admin/cashier) to view all payment proofs
CREATE POLICY "Allow staff to view all payment proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-proofs' AND
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'cashier')
  )
);

-- ═══════════════════════════════════════════════════════════════════════════
-- COMPLETION NOTICE
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Payment Proofs Bucket Setup completed successfully!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'The payment-proofs bucket has been created with the following';
  RAISE NOTICE 'configuration:';
  RAISE NOTICE '';
  RAISE NOTICE '✓ Bucket: payment-proofs (public)';
  RAISE NOTICE '✓ Customers can upload payment screenshots';
  RAISE NOTICE '✓ Public read access enabled for staff verification';
  RAISE NOTICE '✓ Maximum file size: 5 MB (enforced in client)';
  RAISE NOTICE '✓ Allowed formats: JPEG, PNG, WebP, GIF (enforced in client)';
  RAISE NOTICE '';
  RAISE NOTICE 'Payment proofs are stored at:';
  RAISE NOTICE '  payment-proofs/{userId}_{timestamp}.{ext}';
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
