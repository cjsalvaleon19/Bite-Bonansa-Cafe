-- ============================================================================
-- Add Missing balance_after Column to loyalty_transactions Table
-- Fixes: ERROR: 42703: column "balance_after" of relation "loyalty_transactions" does not exist
--
-- Background:
-- The loyalty_transactions table was created in an earlier migration without
-- the balance_after column. Migration 042 tried to create the table with 
-- IF NOT EXISTS, but since the table already existed, it skipped creation.
-- This migration adds the missing column to the existing table.
-- ============================================================================

-- Add balance_after column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'loyalty_transactions' 
      AND column_name = 'balance_after'
  ) THEN
    ALTER TABLE public.loyalty_transactions 
      ADD COLUMN balance_after DECIMAL(10,2) NOT NULL DEFAULT 0;
    
    COMMENT ON COLUMN public.loyalty_transactions.balance_after 
      IS 'Running balance after this transaction';
    
    RAISE NOTICE 'Added balance_after column to loyalty_transactions';
  ELSE
    RAISE NOTICE 'balance_after column already exists in loyalty_transactions';
  END IF;
END $$;

-- Also ensure amount column is DECIMAL (it might be INT in older schema)
DO $$ 
BEGIN
  -- Check if amount is INT and needs conversion
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'loyalty_transactions' 
      AND column_name = 'amount'
      AND data_type = 'integer'
  ) THEN
    -- Convert amount from INT to DECIMAL(10,2)
    ALTER TABLE public.loyalty_transactions 
      ALTER COLUMN amount TYPE DECIMAL(10,2);
    
    RAISE NOTICE 'Converted amount column from INT to DECIMAL(10,2)';
  ELSE
    RAISE NOTICE 'amount column is already correct type';
  END IF;
END $$;

-- Ensure transaction_type is VARCHAR(50) for consistency
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'loyalty_transactions' 
      AND column_name = 'transaction_type'
      AND data_type = 'text'
  ) THEN
    -- Convert transaction_type from TEXT to VARCHAR(50)
    ALTER TABLE public.loyalty_transactions 
      ALTER COLUMN transaction_type TYPE VARCHAR(50);
    
    RAISE NOTICE 'Converted transaction_type from TEXT to VARCHAR(50)';
  ELSE
    RAISE NOTICE 'transaction_type column is already correct type';
  END IF;
END $$;

-- Add description column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'loyalty_transactions' 
      AND column_name = 'description'
  ) THEN
    ALTER TABLE public.loyalty_transactions 
      ADD COLUMN description TEXT;
    
    RAISE NOTICE 'Added description column to loyalty_transactions';
  ELSE
    RAISE NOTICE 'description column already exists in loyalty_transactions';
  END IF;
END $$;

-- Ensure created_at uses TIMESTAMP (not TIMESTAMPTZ)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'loyalty_transactions' 
      AND column_name = 'created_at'
      AND data_type = 'timestamp with time zone'
  ) THEN
    -- Convert from TIMESTAMPTZ to TIMESTAMP
    ALTER TABLE public.loyalty_transactions 
      ALTER COLUMN created_at TYPE TIMESTAMP;
    
    RAISE NOTICE 'Converted created_at from TIMESTAMPTZ to TIMESTAMP';
  ELSE
    RAISE NOTICE 'created_at column is already correct type';
  END IF;
END $$;

-- Similarly, ensure customer_item_purchases has total_spent column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'customer_item_purchases' 
      AND column_name = 'total_spent'
  ) THEN
    ALTER TABLE public.customer_item_purchases 
      ADD COLUMN total_spent DECIMAL(10,2) DEFAULT 0;
    
    RAISE NOTICE 'Added total_spent column to customer_item_purchases';
  ELSE
    RAISE NOTICE 'total_spent column already exists in customer_item_purchases';
  END IF;
END $$;

-- Add index on balance_after for performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_balance 
  ON public.loyalty_transactions(balance_after);

COMMENT ON INDEX idx_loyalty_transactions_balance 
  IS 'Index for querying transactions by balance';
