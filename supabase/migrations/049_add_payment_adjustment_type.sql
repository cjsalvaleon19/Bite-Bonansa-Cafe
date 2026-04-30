-- ============================================================================
-- Migration 049: Add payment adjustment type for cash-to-gcash conversions
-- ============================================================================
-- This migration adds support for tracking payment method adjustments,
-- specifically for cash-to-gcash conversions that need to be reconciled.
--
-- Use case: When a customer initially pays cash but later the payment is
-- converted to GCash (e.g., cashier deposits cash and registers it as GCash),
-- this needs to be tracked for audit and reconciliation purposes.
-- ============================================================================

-- Add payment_adjustment_type column to cash_drawer_transactions
ALTER TABLE cash_drawer_transactions 
ADD COLUMN IF NOT EXISTS payment_adjustment_type VARCHAR(50);

-- Add reference_order_id to link adjustment to original order
ALTER TABLE cash_drawer_transactions 
ADD COLUMN IF NOT EXISTS reference_order_id UUID REFERENCES orders(id);

-- Add comments for clarity
COMMENT ON COLUMN cash_drawer_transactions.payment_adjustment_type IS 
  'Type of payment adjustment: cash-to-gcash, gcash-to-cash, correction, etc.';

COMMENT ON COLUMN cash_drawer_transactions.reference_order_id IS 
  'Reference to the order if this adjustment is related to an order payment change';

-- Create index for payment adjustments queries
CREATE INDEX IF NOT EXISTS idx_cash_drawer_adjustment_type 
ON cash_drawer_transactions(payment_adjustment_type) 
WHERE payment_adjustment_type IS NOT NULL;

-- Create index for order reference lookups
CREATE INDEX IF NOT EXISTS idx_cash_drawer_reference_order 
ON cash_drawer_transactions(reference_order_id) 
WHERE reference_order_id IS NOT NULL;
