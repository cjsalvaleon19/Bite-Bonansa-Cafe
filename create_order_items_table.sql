-- ═══════════════════════════════════════════════════════════════════════════
-- CREATE ORDER_ITEMS TABLE - UUID COMPATIBLE
-- ═══════════════════════════════════════════════════════════════════════════
-- This migration creates the order_items table to store individual items
-- for each order, replacing the JSONB storage in orders.items.
-- 
-- IMPORTANT: This keeps orders.id as UUID for compatibility with:
--   - Existing data in orders table
--   - Foreign key references in loyalty_transactions
--   - Application code expectations
--   - RLS policies
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 1: Verify orders.id is UUID type
-- ─────────────────────────────────────────────────────────────────────────────

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
  
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'VERIFICATION: orders.id data type is: %', orders_id_type;
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  
  -- Verify it's UUID (recommended)
  IF orders_id_type != 'uuid' THEN
    RAISE WARNING 'WARNING: orders.id is not UUID type! It is: %', orders_id_type;
    RAISE WARNING 'This migration assumes UUID. Please verify compatibility.';
  ELSE
    RAISE NOTICE 'SUCCESS: orders.id is UUID - proceeding with UUID-compatible order_items';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 2: Create order_items table with UUID order_id
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.order_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id  UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  price         DECIMAL(10,2) NOT NULL,
  quantity      INT NOT NULL DEFAULT 1,
  subtotal      DECIMAL(10,2) NOT NULL,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.order_items IS 'Individual items for each order - replaces JSONB storage in orders.items';
COMMENT ON COLUMN public.order_items.order_id IS 'References orders.id (UUID) - cascades on delete';
COMMENT ON COLUMN public.order_items.menu_item_id IS 'References menu_items.id (UUID) - nullable if item deleted';
COMMENT ON COLUMN public.order_items.name IS 'Display name including variants (e.g., "Iced Coffee (16oz | Extra Shot)")';
COMMENT ON COLUMN public.order_items.price IS 'Unit price (base + addons)';
COMMENT ON COLUMN public.order_items.quantity IS 'Quantity ordered';
COMMENT ON COLUMN public.order_items.subtotal IS 'Total for this line item (price * quantity)';

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 3: Create indexes for performance
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_order_items_order_id 
  ON public.order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id 
  ON public.order_items(menu_item_id);

CREATE INDEX IF NOT EXISTS idx_order_items_created_at 
  ON public.order_items(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 4: Enable Row Level Security (RLS)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view order items for their orders" 
  ON public.order_items;
DROP POLICY IF EXISTS "System can insert order items" 
  ON public.order_items;
DROP POLICY IF EXISTS "Staff can view all order items" 
  ON public.order_items;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 5: Create RLS Policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Policy 1: Customers can view order items for their own orders
-- Staff (admin, cashier, rider) can view all order items
CREATE POLICY "Users can view order items for their orders" 
  ON public.order_items 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = order_items.order_id 
      AND (
        orders.customer_id = auth.uid() 
        OR EXISTS (
          SELECT 1 FROM public.users 
          WHERE users.id = auth.uid() 
          AND users.role IN ('admin', 'cashier', 'rider')
        )
      )
    )
  );

-- Policy 2: Allow system/authenticated users to insert order items
-- This is permissive to allow order placement
CREATE POLICY "System can insert order items" 
  ON public.order_items 
  FOR INSERT 
  WITH CHECK (true);

-- Policy 3: Staff can update order items (for corrections)
CREATE POLICY "Staff can update order items" 
  ON public.order_items 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'cashier')
    )
  );

-- Policy 4: Staff can delete order items (for corrections)
CREATE POLICY "Staff can delete order items" 
  ON public.order_items 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('admin', 'cashier')
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 6: Re-create trigger for customer_item_purchases tracking
-- ─────────────────────────────────────────────────────────────────────────────

-- This trigger was defined in fix_orders_and_loyalty_schema.sql but couldn't
-- be created because order_items table didn't exist. Now we can create it.

-- First ensure the function exists (it should from fix_orders_and_loyalty_schema.sql)
-- If it doesn't exist, create it here
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

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS trg_update_customer_item_purchases ON public.order_items;

CREATE TRIGGER trg_update_customer_item_purchases
  AFTER INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_item_purchases();

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 7: Verification Queries
-- ─────────────────────────────────────────────────────────────────────────────

-- Verify table structure
DO $$
DECLARE
  table_exists BOOLEAN;
  index_count INT;
  policy_count INT;
  trigger_count INT;
BEGIN
  -- Check if table exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'order_items'
  ) INTO table_exists;
  
  -- Count indexes
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE tablename = 'order_items' AND schemaname = 'public';
  
  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'order_items' AND schemaname = 'public';
  
  -- Count triggers
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers
  WHERE event_object_table = 'order_items' AND trigger_schema = 'public';
  
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'VERIFICATION RESULTS';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'Table exists: %', table_exists;
  RAISE NOTICE 'Indexes created: %', index_count;
  RAISE NOTICE 'RLS policies created: %', policy_count;
  RAISE NOTICE 'Triggers created: %', trigger_count;
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  
  IF table_exists AND index_count >= 3 AND policy_count >= 4 AND trigger_count >= 1 THEN
    RAISE NOTICE '✓ SUCCESS: order_items table created successfully!';
  ELSE
    RAISE WARNING '⚠ WARNING: Some components may be missing. Please review.';
  END IF;
END $$;

-- Display table schema
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'order_items'
ORDER BY ordinal_position;

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
  RAISE NOTICE 'The order_items table has been created with:';
  RAISE NOTICE '  ✓ UUID order_id (matches orders.id type)';
  RAISE NOTICE '  ✓ Foreign key to orders table (CASCADE on delete)';
  RAISE NOTICE '  ✓ Foreign key to menu_items table (SET NULL on delete)';
  RAISE NOTICE '  ✓ Row Level Security enabled';
  RAISE NOTICE '  ✓ 4 RLS policies (SELECT, INSERT, UPDATE, DELETE)';
  RAISE NOTICE '  ✓ 3 performance indexes';
  RAISE NOTICE '  ✓ Trigger for customer purchase tracking';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. The app code already inserts into order_items';
  RAISE NOTICE '  2. Schema will be auto-detected by Supabase';
  RAISE NOTICE '  3. Test order placement to verify functionality';
  RAISE NOTICE '';
  RAISE NOTICE 'IMPORTANT:';
  RAISE NOTICE '  • orders.id remains UUID (not changed to TEXT)';
  RAISE NOTICE '  • This prevents breaking existing foreign keys';
  RAISE NOTICE '  • Compatible with loyalty_transactions.order_id';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
