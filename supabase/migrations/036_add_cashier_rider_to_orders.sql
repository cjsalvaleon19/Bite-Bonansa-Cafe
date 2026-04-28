-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: Add cashier_id and rider_id to Orders Table
-- ═══════════════════════════════════════════════════════════════════════════
-- This migration adds the missing cashier_id and rider_id columns to the orders
-- table. These columns track which cashier processed the order and which rider
-- delivered it (for delivery orders).
-- ═══════════════════════════════════════════════════════════════════════════

-- Add cashier_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'cashier_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN cashier_id UUID REFERENCES users(id);
    RAISE NOTICE 'Added cashier_id column to orders table';
  ELSE
    RAISE NOTICE 'cashier_id column already exists in orders table';
  END IF;
END $$;

-- Add rider_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'rider_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN rider_id UUID REFERENCES users(id);
    RAISE NOTICE 'Added rider_id column to orders table';
  ELSE
    RAISE NOTICE 'rider_id column already exists in orders table';
  END IF;
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_cashier_id ON orders(cashier_id);
CREATE INDEX IF NOT EXISTS idx_orders_rider_id ON orders(rider_id);

-- Add comments to document the columns
COMMENT ON COLUMN orders.cashier_id IS 'Reference to the cashier who processed/accepted the order';
COMMENT ON COLUMN orders.rider_id IS 'Reference to the rider assigned for delivery (for delivery orders only)';

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
  RAISE NOTICE 'Added columns to orders table:';
  RAISE NOTICE '  - cashier_id: Tracks which cashier processed the order';
  RAISE NOTICE '  - rider_id: Tracks which rider is assigned for delivery';
  RAISE NOTICE '';
  RAISE NOTICE 'Both columns are optional (can be NULL) and reference users.id';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
