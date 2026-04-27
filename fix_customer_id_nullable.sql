-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: Make customer_id nullable in orders table
-- ═══════════════════════════════════════════════════════════════════════════
-- This fixes the foreign key constraint violation error when placing orders.
-- The issue occurs when:
-- 1. User is authenticated via Supabase Auth (auth.users)
-- 2. But no corresponding record exists in public.users table
-- 3. Order insertion fails due to foreign key constraint
-- 
-- Solution: Make customer_id nullable to support:
-- - Guest orders (when user is not logged in)
-- - Orders before user record is created in public.users
-- ═══════════════════════════════════════════════════════════════════════════

-- Step 1: Drop the existing foreign key constraint
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_customer_id_fkey;

-- Step 2: Make customer_id column nullable
ALTER TABLE public.orders
  ALTER COLUMN customer_id DROP NOT NULL;

-- Step 3: Re-add the foreign key constraint (now allows NULL)
ALTER TABLE public.orders
  ADD CONSTRAINT orders_customer_id_fkey 
  FOREIGN KEY (customer_id) 
  REFERENCES public.users(id) 
  ON DELETE SET NULL;

-- Step 4: Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);

-- Verification query (optional - run this to check):
-- SELECT 
--   column_name, 
--   is_nullable, 
--   data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' 
--   AND table_name = 'orders' 
--   AND column_name = 'customer_id';
