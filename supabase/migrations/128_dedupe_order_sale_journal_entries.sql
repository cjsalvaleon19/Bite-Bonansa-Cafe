-- Migration 128:
-- 1) Remove historical duplicate order Sales journal-entry legs
-- 2) Prevent future duplicate Sales legs for the same order/account pair

-- Remove duplicate Sale legs (keep the earliest created row per unique leg)
WITH ranked_sales AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        reference,
        debit_account,
        credit_account
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM journal_entries
  WHERE reference_type = 'order'
    AND description LIKE 'Sale:%'
)
DELETE FROM journal_entries je
USING ranked_sales rs
WHERE je.id = rs.id
  AND rs.rn > 1;

-- Enforce one Sales leg per order/account pair to avoid accidental re-inserts
CREATE UNIQUE INDEX IF NOT EXISTS uq_order_sale_leg_once
  ON journal_entries (reference, debit_account, credit_account)
  WHERE reference_type = 'order'
    AND description LIKE 'Sale:%'
    AND reference IS NOT NULL;

NOTIFY pgrst, 'reload schema';

DO $$ BEGIN
  RAISE NOTICE 'Migration 128: deduplicated order Sale journal rows and enforced unique Sale legs.';
END $$;
