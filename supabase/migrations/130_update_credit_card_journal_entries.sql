-- Migration 130: Update Credit Card journal entries to use Credit Card Payable
-- Previously, credit card payments (RR and Bills) used "Owner's Capital" as the credit account.
-- Per business requirement, all such entries should now reflect "Credit Card Payable".

UPDATE journal_entries
SET credit_account = 'Credit Card Payable'
WHERE reference_type IN ('rr_payment', 'bill')
  AND credit_account = 'Owner''s Capital';
