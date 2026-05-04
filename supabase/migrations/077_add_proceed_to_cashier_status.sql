-- ============================================================================
-- Add 'proceed_to_cashier' Status to Orders Check Constraint
-- Fixes the constraint violation when accepting dine-in and take-out orders
-- ============================================================================

-- Drop the existing orders_status_check constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'orders_status_check' 
    AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders DROP CONSTRAINT orders_status_check;
    RAISE NOTICE 'Dropped existing orders_status_check constraint';
  END IF;
END $$;

-- Re-create the constraint with 'proceed_to_cashier' included
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check CHECK (
    status IN (
      'pending', 'confirmed', 'preparing', 'ready',
      'out_for_delivery', 'delivered', 'completed', 'cancelled',
      'order_in_queue', 'order_in_process', 'order_delivered',
      'proceed_to_cashier'
    )
  );

COMMENT ON CONSTRAINT orders_status_check ON public.orders IS 
  'Valid order statuses including proceed_to_cashier for dine-in and take-out orders';

DO $$
BEGIN
  RAISE NOTICE 'Successfully updated orders_status_check constraint to include proceed_to_cashier';
END $$;
