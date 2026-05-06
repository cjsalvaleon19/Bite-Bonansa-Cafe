-- Migration 125: Add payment_method column to bills table
-- Tracks how a bill was paid (Cash on Hand, Cash in Bank, Credit Card)

ALTER TABLE bills ADD COLUMN IF NOT EXISTS payment_method TEXT;
