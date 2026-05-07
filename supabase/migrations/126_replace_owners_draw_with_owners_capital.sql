-- ─── Migration 126: Replace Owner's Draw with Owner's Capital in journal entries ───
-- PURPOSE:
--   Normalize all existing journal entry account titles so "Owner's Draw"
--   is replaced by "Owner's Capital" in both debit and credit sides.

UPDATE journal_entries
SET debit_account = 'Owner''s Capital'
WHERE debit_account = 'Owner''s Draw';

UPDATE journal_entries
SET credit_account = 'Owner''s Capital'
WHERE credit_account = 'Owner''s Draw';

NOTIFY pgrst, 'reload schema';
