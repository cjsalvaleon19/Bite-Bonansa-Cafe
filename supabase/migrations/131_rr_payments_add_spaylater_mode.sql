-- Migration 131: Add 'spaylater' as a valid payment_mode in rr_payments
--
-- The original check constraint (from migration 102) only allowed:
--   cash_on_hand | cash_in_bank | credit_card
--
-- The admin UI now supports SPayLater as a payment option for RR payments,
-- but inserting payment_mode='spaylater' was rejected with HTTP 400 because
-- 'spaylater' was not in the allowed list.
--
-- This migration drops the auto-generated inline constraint and recreates it
-- with 'spaylater' included.

ALTER TABLE rr_payments
  DROP CONSTRAINT IF EXISTS rr_payments_payment_mode_check;

ALTER TABLE rr_payments
  ADD CONSTRAINT rr_payments_payment_mode_check
    CHECK (payment_mode IN ('cash_on_hand', 'cash_in_bank', 'credit_card', 'spaylater'));

DO $$ BEGIN RAISE NOTICE 'Migration 131: rr_payments.payment_mode now accepts spaylater.'; END $$;
