-- Add shipping and payment fields to users table for online ordering
-- Migration: Add shipping details and payment preferences
-- Created: 2026-04-16

-- Add shipping address fields
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS shipping_address TEXT,
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'cash_on_delivery';

-- Add comment for documentation
COMMENT ON COLUMN users.shipping_address IS 'Customer shipping/delivery address for online orders';
COMMENT ON COLUMN users.city IS 'City for shipping address';
COMMENT ON COLUMN users.postal_code IS 'Postal/ZIP code for shipping address';
COMMENT ON COLUMN users.payment_method IS 'Preferred payment method: cash_on_delivery, gcash, paymaya, bank_transfer, credit_card';
