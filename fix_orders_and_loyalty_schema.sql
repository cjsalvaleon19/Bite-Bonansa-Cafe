-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: Orders Table Schema & Loyalty Transactions
-- ═══════════════════════════════════════════════════════════════════════════
-- This migration ensures all required columns exist in the orders table
-- and creates the loyalty_transactions table with proper foreign key handling
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 1: Ensure all required columns exist in orders table
-- ─────────────────────────────────────────────────────────────────────────────

-- Add delivery-related columns if they don't exist
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_address TEXT;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_latitude DECIMAL(10,8);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_longitude DECIMAL(11,8);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 0;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_fee_pending BOOLEAN DEFAULT TRUE;

-- Add order mode and contact info columns
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_mode VARCHAR(50);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS contact_number VARCHAR(20);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_number VARCHAR(100) UNIQUE;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);

-- Add pricing columns if they don't exist
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(10,2) DEFAULT 0;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2);

-- Add payment columns if they don't exist
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS gcash_reference VARCHAR(100);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS points_used DECIMAL(10,2) DEFAULT 0;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cash_amount DECIMAL(10,2) DEFAULT 0;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS gcash_amount DECIMAL(10,2) DEFAULT 0;

-- Add special request if it doesn't exist
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS special_request TEXT;

-- Add earnings columns if they don't exist
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS earnings_percentage DECIMAL(5,2) DEFAULT 0;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS earnings_amount DECIMAL(10,2) DEFAULT 0;

-- Add timestamp columns if they don't exist
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS out_for_delivery_at TIMESTAMP;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP;

-- Add rider_id if it doesn't exist
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS rider_id UUID REFERENCES public.users(id);

-- Ensure status constraint includes all required values
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'orders_status_check' 
    AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders DROP CONSTRAINT orders_status_check;
  END IF;
END $$;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check CHECK (
    status IN (
      'pending', 'confirmed', 'preparing', 'ready',
      'out_for_delivery', 'delivered', 'completed', 'cancelled',
      'order_in_queue', 'order_in_process', 'order_delivered'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 2: Detect orders.id data type and create loyalty_transactions accordingly
-- ─────────────────────────────────────────────────────────────────────────────

-- First, let's check what type orders.id actually is
DO $$
DECLARE
  orders_id_type TEXT;
BEGIN
  -- Get the data type of orders.id
  SELECT data_type INTO orders_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'orders'
    AND column_name = 'id';
  
  RAISE NOTICE 'orders.id data type is: %', orders_id_type;
  
  -- Drop loyalty_transactions if it exists (we'll recreate with correct type)
  DROP TABLE IF EXISTS public.loyalty_transactions CASCADE;
  
  -- Create loyalty_transactions with matching order_id type
  IF orders_id_type = 'uuid' THEN
    -- orders.id is UUID, so use UUID for order_id
    CREATE TABLE public.loyalty_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
      amount INT NOT NULL DEFAULT 0,
      transaction_type TEXT NOT NULL DEFAULT 'earned'
        CHECK (transaction_type IN ('earned', 'redeemed', 'spent', 'adjustment')),
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    RAISE NOTICE 'Created loyalty_transactions with UUID order_id';
  ELSE
    -- orders.id is TEXT (or something else), so use TEXT for order_id
    CREATE TABLE public.loyalty_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      order_id TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
      amount INT NOT NULL DEFAULT 0,
      transaction_type TEXT NOT NULL DEFAULT 'earned'
        CHECK (transaction_type IN ('earned', 'redeemed', 'spent', 'adjustment')),
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    RAISE NOTICE 'Created loyalty_transactions with TEXT order_id';
  END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_customer 
  ON public.loyalty_transactions(customer_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Customers can view their own loyalty transactions"
  ON public.loyalty_transactions;
DROP POLICY IF EXISTS "System can insert loyalty transactions"
  ON public.loyalty_transactions;
DROP POLICY IF EXISTS "Staff can view all loyalty transactions"
  ON public.loyalty_transactions;

-- Create RLS policies
CREATE POLICY "Customers can view their own loyalty transactions"
  ON public.loyalty_transactions
  FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "System can insert loyalty transactions"
  ON public.loyalty_transactions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Staff can view all loyalty transactions"
  ON public.loyalty_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 3: Create customer_item_purchases table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.customer_item_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  purchase_count INT NOT NULL DEFAULT 1,
  last_purchased_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (customer_id, menu_item_id)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_customer_purchases 
  ON public.customer_item_purchases(customer_id, purchase_count DESC);

-- Enable RLS
ALTER TABLE public.customer_item_purchases ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Customers can view their own purchase history"
  ON public.customer_item_purchases;
DROP POLICY IF EXISTS "System can upsert customer item purchases"
  ON public.customer_item_purchases;
DROP POLICY IF EXISTS "Staff can view all purchases"
  ON public.customer_item_purchases;

-- Create RLS policies
CREATE POLICY "Customers can view their own purchase history"
  ON public.customer_item_purchases
  FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "System can upsert customer item purchases"
  ON public.customer_item_purchases
  FOR ALL USING (true);

CREATE POLICY "Staff can view all purchases"
  ON public.customer_item_purchases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'cashier')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 4: Create triggers for auto-updating purchase history and loyalty points
-- ─────────────────────────────────────────────────────────────────────────────

-- Trigger to update customer_item_purchases when order_items are inserted
CREATE OR REPLACE FUNCTION update_customer_item_purchases()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if we can find the customer_id from the order
  INSERT INTO public.customer_item_purchases (customer_id, menu_item_id, purchase_count, last_purchased_at)
  SELECT
    o.customer_id,
    NEW.menu_item_id,
    NEW.quantity,
    NOW()
  FROM public.orders o
  WHERE o.id = NEW.order_id AND o.customer_id IS NOT NULL
  ON CONFLICT (customer_id, menu_item_id)
  DO UPDATE SET
    purchase_count = customer_item_purchases.purchase_count + EXCLUDED.purchase_count,
    last_purchased_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_customer_item_purchases ON public.order_items;

-- Only create trigger if order_items table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'order_items'
  ) THEN
    CREATE TRIGGER trg_update_customer_item_purchases
      AFTER INSERT ON public.order_items
      FOR EACH ROW
      EXECUTE FUNCTION update_customer_item_purchases();
    RAISE NOTICE 'Created trigger on order_items table';
  ELSE
    RAISE NOTICE 'order_items table does not exist, skipping trigger creation';
  END IF;
END $$;

-- Trigger to award loyalty points when an order is placed
CREATE OR REPLACE FUNCTION award_loyalty_points()
RETURNS TRIGGER AS $$
DECLARE
  pts INT;
BEGIN
  -- Only award points if customer_id is present
  IF NEW.customer_id IS NULL THEN 
    RETURN NEW; 
  END IF;
  
  -- Calculate points: 0.2% for orders ≤ ₱500, 0.35% for orders > ₱500
  -- Using subtotal for calculation (before delivery fee)
  pts := FLOOR(NEW.subtotal * CASE 
    WHEN NEW.subtotal <= 500 THEN 0.002  -- 0.2%
    ELSE 0.0035  -- 0.35%
  END);
  
  -- Only insert if points > 0
  IF pts > 0 THEN
    INSERT INTO public.loyalty_transactions (
      customer_id, 
      order_id, 
      amount, 
      transaction_type, 
      description
    )
    VALUES (
      NEW.customer_id, 
      NEW.id::TEXT,  -- Cast to TEXT to handle both UUID and TEXT types
      pts, 
      'earned', 
      'Points earned from order'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_award_loyalty_points ON public.orders;

CREATE TRIGGER trg_award_loyalty_points
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION award_loyalty_points();

-- ═══════════════════════════════════════════════════════════════════════════
-- COMPLETION NOTICE
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'IMPORTANT: You must now reload the Supabase schema cache:';
  RAISE NOTICE '';
  RAISE NOTICE '1. Go to Supabase Dashboard → Project Settings';
  RAISE NOTICE '2. Click on "API" in the sidebar';
  RAISE NOTICE '3. Scroll down to "Schema Cache" section';
  RAISE NOTICE '4. Click the "Reload schema" button';
  RAISE NOTICE '';
  RAISE NOTICE 'OR use the Supabase CLI:';
  RAISE NOTICE '   npx supabase db reset --linked';
  RAISE NOTICE '';
  RAISE NOTICE 'This is required for the new columns to be visible in the';
  RAISE NOTICE 'REST API and for your application to work correctly.';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
