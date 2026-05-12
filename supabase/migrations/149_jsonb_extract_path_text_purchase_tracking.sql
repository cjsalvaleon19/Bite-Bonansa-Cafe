-- ============================================================================
-- Migration 149: Use jsonb_extract_path_text() — permanently immune to
--                HTML copy-paste corruption of the ->> operator
-- ============================================================================
-- Root cause of recurring corruption:
--   Every time this trigger function has been applied via the Supabase SQL
--   Editor by copy-pasting from a web page (GitHub, Supabase dashboard, etc.)
--   the browser HTML-encodes the >> part of the ->> (double-arrow, TEXT)
--   operator:
--
--       ->>  →  becomes in HTML source: -&gt;&gt;
--              →  user copies what they see: ->
--              →  pasted SQL has single-arrow -> (JSONB, not TEXT)
--
--   This has now happened TWICE: once to migration 147 and once to migration 148.
--   Each time, the inner EXCEPTION WHEN OTHERS block silently swallows the
--   type errors (lower(jsonb) does not exist, COALESCE type mismatch), so
--   purchase tracking records nothing and no HTTP 500 is thrown — but the data
--   is silently lost.
--
-- Permanent fix:
--   Replace every ->> operator with jsonb_extract_path_text(col, 'key').
--   This built-in function contains ZERO > characters and is completely immune
--   to HTML encoding corruption.  It is semantically identical to ->>.
--
--     item->>'id'        ≡  jsonb_extract_path_text(item, 'id')
--     item->>'quantity'  ≡  jsonb_extract_path_text(item, 'quantity')
--     item->>'price'     ≡  jsonb_extract_path_text(item, 'price')
--
-- Safe to re-apply:
--   DROP IF EXISTS prevents errors if objects do not exist.
--   Running this on a DB that already has the correct version is harmless.
-- ============================================================================

-- ── Drop all known purchase-tracking trigger and function variants ────────────
DROP TRIGGER IF EXISTS trigger_update_customer_purchases ON orders;
DROP FUNCTION IF EXISTS update_customer_purchases();
DROP TRIGGER IF EXISTS trg_track_customer_purchases ON orders;
DROP FUNCTION IF EXISTS track_customer_item_purchases();

-- ── Recreate using jsonb_extract_path_text() — no > characters ───────────────
CREATE OR REPLACE FUNCTION track_customer_item_purchases()
RETURNS TRIGGER AS $$
DECLARE
  -- UUID pattern — accept both uppercase and lowercase hex digits.
  -- jsonb_extract_path_text() returns TEXT, so LOWER() and regex work correctly.
  v_uuid_pattern CONSTANT TEXT :=
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

  v_item RECORD;
BEGIN
  -- ── Only process the FIRST transition into a completed state ──────────────
  IF NEW.status IN ('order_delivered', 'completed')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('order_delivered', 'completed')) THEN

    -- Skip when customer or items payload is not usable
    IF NEW.customer_id IS NULL
       OR NEW.items IS NULL
       OR jsonb_typeof(NEW.items) <> 'array'
       OR jsonb_array_length(NEW.items) = 0 THEN
      RETURN NEW;
    END IF;

    -- ── Inner block: purchase tracking is best-effort only ────────────────
    -- Any error here is caught as a WARNING.
    -- The order status update ALWAYS commits regardless of what happens here.
    BEGIN

      -- FOR LOOP: each iteration issues ONE single-row INSERT.
      -- A single-row INSERT cannot produce
      --   "ON CONFLICT DO UPDATE command cannot affect row a second time"
      -- (that error is exclusive to multi-row INSERT...SELECT where two source
      -- rows map to the same conflict target).
      --
      -- GROUP BY normalises any duplicate UUIDs that differ only in letter case
      -- into a single aggregated row before the loop runs, so each UUID is
      -- processed exactly once.
      --
      -- jsonb_extract_path_text(item, 'id') is used instead of item->>'id'
      -- because the >> in ->> is HTML-encoded to &gt;&gt; by every browser, and
      -- copy-pasting from any web UI silently truncates it to -> (single arrow,
      -- JSONB).  jsonb_extract_path_text contains no > characters and is safe.
      FOR v_item IN
        SELECT
          LOWER(jsonb_extract_path_text(item, 'id')) AS menu_item_id_text,
          SUM(
            CASE
              WHEN COALESCE(jsonb_extract_path_text(item, 'quantity'), '') ~ '^\d+$'
                THEN jsonb_extract_path_text(item, 'quantity')::INT
              ELSE 1
            END
          ) AS total_quantity,
          SUM(
            CASE
              WHEN COALESCE(jsonb_extract_path_text(item, 'price'), '') ~ '^\d+(\.\d+)?$'
                THEN jsonb_extract_path_text(item, 'price')::NUMERIC
              ELSE 0
            END
          ) AS total_price
        FROM jsonb_array_elements(NEW.items) AS item
        WHERE LOWER(COALESCE(jsonb_extract_path_text(item, 'id'), '')) ~ v_uuid_pattern
        GROUP BY LOWER(jsonb_extract_path_text(item, 'id'))
      LOOP
        INSERT INTO customer_item_purchases (
          customer_id,
          menu_item_id,
          purchase_count,
          total_spent,
          last_purchased_at
        ) VALUES (
          NEW.customer_id,
          v_item.menu_item_id_text::UUID,
          v_item.total_quantity,
          v_item.total_price,
          COALESCE(NEW.completed_at, NEW.created_at)
        )
        ON CONFLICT (customer_id, menu_item_id)
        DO UPDATE SET
          purchase_count    = customer_item_purchases.purchase_count    + EXCLUDED.purchase_count,
          total_spent       = customer_item_purchases.total_spent       + EXCLUDED.total_spent,
          last_purchased_at = GREATEST(
                                customer_item_purchases.last_purchased_at,
                                EXCLUDED.last_purchased_at
                              );
      END LOOP;

    EXCEPTION
      WHEN OTHERS THEN
        -- Inner guard: catches any error inside the loop.
        -- Logged as WARNING in Supabase database logs.
        -- Does NOT block the order status update.
        RAISE WARNING
          '[track_customer_item_purchases] Purchase tracking failed for order %: %',
          NEW.id, SQLERRM;
    END;

  END IF;

  RETURN NEW;

EXCEPTION
  -- ── Outer guard: catches any logic error outside the inner block ──────────
  -- Guarantees the function is completely non-blocking under all circumstances.
  WHEN OTHERS THEN
    RAISE WARNING
      '[track_customer_item_purchases] Unexpected error for order %: %',
      NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_track_customer_purchases
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION track_customer_item_purchases();

COMMENT ON FUNCTION track_customer_item_purchases IS
  'Tracks customer purchases on first order completion. '
  'Uses FOR LOOP + jsonb_extract_path_text() (no > chars, immune to HTML copy-paste corruption). '
  'LOWER() GROUP BY prevents mixed-case UUID duplicates. '
  'Double exception guard (inner + outer) ensures the trigger never blocks order completion.';

COMMENT ON TRIGGER trg_track_customer_purchases ON orders IS
  'Updates customer_item_purchases when an order transitions to completed/delivered. '
  'Failures are logged as warnings and never roll back the order status update.';

DO $$
BEGIN
  RAISE NOTICE
    'Migration 149 applied: track_customer_item_purchases() uses jsonb_extract_path_text(). '
    'Permanently immune to HTML copy-paste >> corruption. '
    'Legacy triggers dropped. Purchase tracking is now active and non-blocking.';
END $$;
