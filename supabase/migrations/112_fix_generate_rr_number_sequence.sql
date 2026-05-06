-- ─── Migration 112: Fix generate_rr_number() sequence bug ───────────────────
-- PROBLEM:
--   generate_rr_number() parses the sequence part of existing RR numbers with
--   SUBSTRING(rr_number FROM 4), which starts at the 4th character and includes
--   the 2-digit year prefix (e.g. for 'RR-260000001' it yields '260000001'
--   instead of just '0000001').  As a result:
--     • The second RR gets sequence = 260000001 + 1 = 260000002, which is
--       padded to 9 digits: 'RR-26260000002'  (12 chars instead of 12 OK but wrong digits)
--     • Every subsequent number grows by the year-prefixed offset, so the
--       numbers are NOT in sequence: RR-260000001, RR-26260000002, …
--
-- FIX:
--   1. Replace SUBSTRING(rr_number FROM 4) with RIGHT(rr_number, 7) so only
--      the last 7 characters (the actual sequence digits) are cast to BIGINT.
--      This is safe for both valid numbers ('RR-260000001' → '0000001')
--      and any already-inflated numbers ('RR-26260000002' → '0000002').
--
--   2. Renumber any existing RR records whose rr_number has more than 12
--      characters (the canonical length of RR-YY0000001) back to the correct
--      sequential format, ordered by created_at so history is preserved.
--      Renaming is done only within the same year so the year prefix is kept.
--      References in journal_entries (column 'reference') are updated to match.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Fix the function
CREATE OR REPLACE FUNCTION generate_rr_number() RETURNS VARCHAR AS $$
DECLARE
  v_year CHAR(2);
  v_seq  BIGINT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YY');
  SELECT COALESCE(MAX(CAST(RIGHT(rr_number, 7) AS BIGINT)), 0) + 1
    INTO v_seq
    FROM receiving_reports
   WHERE rr_number LIKE 'RR-' || v_year || '%';
  RETURN 'RR-' || v_year || LPAD(v_seq::TEXT, 7, '0');
END;
$$ LANGUAGE plpgsql;

-- 2. Renumber any inflated RR numbers (length > 12) to sequential values
DO $$
DECLARE
  rec          RECORD;
  v_year       CHAR(2);
  v_seq        BIGINT;
  v_new_num    VARCHAR(20);
  v_old_num    VARCHAR(50);
  v_count      INT := 0;
BEGIN
  -- Process each year that has inflated RR numbers, oldest first
  FOR rec IN
    SELECT DISTINCT SUBSTRING(rr_number FROM 4 FOR 2) AS yr
      FROM receiving_reports
     WHERE LENGTH(rr_number) > 12
     ORDER BY yr
  LOOP
    v_year := rec.yr;
    v_seq  := 0;

    -- Re-assign sequential numbers to ALL RRs for this year, ordered by
    -- creation date, so the relative order is preserved.
    FOR rec IN
      SELECT id, rr_number
        FROM receiving_reports
       WHERE rr_number LIKE 'RR-' || v_year || '%'
       ORDER BY created_at ASC, rr_number ASC
    LOOP
      v_seq     := v_seq + 1;
      v_old_num := rec.rr_number;
      v_new_num := 'RR-' || v_year || LPAD(v_seq::TEXT, 7, '0');

      IF v_old_num <> v_new_num THEN
        -- Update the receiving_reports header
        UPDATE receiving_reports
           SET rr_number = v_new_num
         WHERE id = rec.id;

        -- Keep journal_entries in sync (column is named 'reference' in production)
        BEGIN
          UPDATE journal_entries
             SET description = REPLACE(description, v_old_num, v_new_num)
           WHERE description LIKE '%' || v_old_num || '%';
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'Migration 112: could not update journal_entries for %: %', v_old_num, SQLERRM;
        END;

        v_count := v_count + 1;
        RAISE NOTICE 'Migration 112: renumbered % → %', v_old_num, v_new_num;
      END IF;
    END LOOP;
  END LOOP;

  IF v_count = 0 THEN
    RAISE NOTICE 'Migration 112: no inflated RR numbers found, nothing to renumber.';
  ELSE
    RAISE NOTICE 'Migration 112: renumbered % RR record(s).', v_count;
  END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
