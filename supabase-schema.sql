-- ============================================================
-- Bite Bonansa Cafe — Loyalty Points System
-- Supabase SQL Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 0. Sequence for atomic Customer ID generation (avoids race conditions)
CREATE SEQUENCE IF NOT EXISTS public.customer_id_seq START 1 INCREMENT 1;

-- Expose the sequence as a callable RPC function
CREATE OR REPLACE FUNCTION public.nextval_customer_id_seq()
RETURNS BIGINT
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT nextval('public.customer_id_seq');
$$;

-- 1. Customers table
--    Extends Supabase auth.users with loyalty profile data.
CREATE TABLE IF NOT EXISTS public.customers (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id   TEXT UNIQUE NOT NULL,           -- e.g. BBC-000001
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  phone         TEXT,
  points_balance NUMERIC(12, 4) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. Points transactions table
--    Records every earn and redeem event.
CREATE TABLE IF NOT EXISTS public.points_transactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    TEXT NOT NULL REFERENCES public.customers(customer_id) ON DELETE CASCADE,
  type           TEXT NOT NULL CHECK (type IN ('earn', 'redeem')),
  points         NUMERIC(12, 4) NOT NULL,
  order_amount   NUMERIC(10, 2),
  order_id       UUID,
  payment_method TEXT,
  description    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    TEXT REFERENCES public.customers(customer_id) ON DELETE SET NULL,
  items          JSONB NOT NULL,
  total_amount   NUMERIC(10, 2) NOT NULL,
  points_used    NUMERIC(12, 4) NOT NULL DEFAULT 0,
  cash_amount    NUMERIC(10, 2) NOT NULL DEFAULT 0,
  gcash_amount   NUMERIC(10, 2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL,
  order_type     TEXT NOT NULL CHECK (order_type IN ('online', 'cashier')),
  order_status   TEXT NOT NULL DEFAULT 'Pending'
                   CHECK (order_status IN ('Pending', 'Processing', 'Completed', 'Cancelled')),
  points_earned  NUMERIC(12, 4) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Customers: each user can read/update their own row
CREATE POLICY "customers_self_read" ON public.customers
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "customers_self_update" ON public.customers
  FOR UPDATE USING (auth.uid() = id);

-- Service role (used by API routes) bypasses RLS automatically.

-- Points transactions: customers can read their own transactions
CREATE POLICY "transactions_self_read" ON public.points_transactions
  FOR SELECT USING (
    customer_id = (
      SELECT customer_id FROM public.customers WHERE id = auth.uid()
    )
  );

-- Orders: customers can read their own orders
CREATE POLICY "orders_self_read" ON public.orders
  FOR SELECT USING (
    customer_id = (
      SELECT customer_id FROM public.customers WHERE id = auth.uid()
    )
  );

-- ============================================================
-- Indexes for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_customers_customer_id ON public.customers(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON public.points_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.points_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
