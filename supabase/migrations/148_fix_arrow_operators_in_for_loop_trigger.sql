-- ============================================================================
-- Migration 148: Fix ->> (text) operators in production track_customer_item_purchases
-- ============================================================================
-- Problem:
--   The production database is running a version of track_customer_item_purchases()
--   that uses the SINGLE-arrow JSON operator  ->  (returns JSONB) instead of the
--   DOUBLE-arrow operator  ->>  (returns TEXT), for example:
--
--       LOWER(item->'id')              ← WRONG: LOWER() requires TEXT, not JSONB
--       COALESCE(item->'quantity', '') ← WRONG: COALESCE types jsonb and text cannot be matched
--       item->'price'                  ← WRONG: regex ~ requires TEXT
--
--   How this happened:
--     Migration 147 was copy-pasted into the Supabase SQL Editor through a web
--     page that HTML-encoded the ->> operator:
--       ->>  →  HTML: -&gt;&gt;  →  pasted as: ->
--     The extra > was silently lost, leaving single-arrow -> in the live function.
--
--   Effects of the corrupted function:
--     1. LOWER(item->'id') raises: function lower(jsonb) does not exist
--     2. COALESCE(item->'id', '') raises: COALESCE types jsonb and text cannot be matched
--     Both are caught by the EXCEPTION WHEN OTHERS block, so purchase tracking
--     is silently skipped — no purchases are recorded, but the order update itself
--     may still succeed IF no legacy trigger is present.
--
--   Why 500 errors persist:
--     If an older trigger (trigger_update_customer_purchases / update_customer_purchases)
--     is still present in the DB alongside the corrupted migration 147 function,
--     that legacy trigger fires too and lacks exception handling — causing a 500
--     on every order completion attempt.
--
-- Fix:
--   Drop ALL purchase-tracking trigger/function variants and recreate using
--   ->> (double-arrow, TEXT extraction) throughout. This is functionally identical
--   to migration 147 but corrects the operator corruption.
--
-- Safe to re-apply:
--   This migration is idempotent: DROP IF EXISTS prevents errors if the named
--   objects do not exist. Running it on a database that already has the correct
--   version simply overwrites it with an identical definition.
-- ============================================================================

-- ── Drop all known purchase-tracking trigger and function variants ────────────
DROP TRIGGER IF EXISTS trigger_update_customer_purchases ON orders;
DROP FUNCTION IF EXISTS update_customer_purchases();
DROP TRIGGER IF EXISTS trg_track_customer_purchases ON orders;
DROP FUNCTION IF EXISTS track_customer_item_purchases();

-- ── Recreate with correct ->> (TEXT) operators ────────────────────────────────
CREATE OR REPLACE FUNCTION track_customer_item_purchases()
RETURNS TRIGGER AS $$
DECLARE
  -- UUID pattern — accept both uppercase and lowercase hex digits.
  -- item->>'id' extracts TEXT, so LOWER() and regex matching work correctly.
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
      -- (that error is exclusive to multi-row INSERT…SELECT where two source
      -- rows map to the same conflict target).
      --
      -- GROUP BY LOWER(item->>'id') collapses any duplicate UUIDs that differ
      -- only in letter case into a single aggregated row before the loop runs,
      -- so each UUID is processed exactly once.
      --
      -- NOTE: item->>'id' (double-arrow) returns TEXT.
      --       item->'id'  (single-arrow) returns JSONB — do NOT use that here.
      FOR v_item IN
        SELECT
          LOWER(item->>'id') AS menu_item_id_text,
          SUM(
            CASE
              WHEN COALESCE(item->>'quantity', '') ~ '^\d+$'
                THEN (item->>'quantity')::INT
              ELSE 1
            END
          ) AS total_quantity,
          SUM(
            CASE
              WHEN COALESCE(item->>'price', '') ~ '^\d+(\.\d+)?$'
                THEN (item->>'price')::NUMERIC
              ELSE 0
            END
          ) AS total_price
        FROM jsonb_array_elements(NEW.items) AS item
        WHERE LOWER(COALESCE(item->>'id', '')) ~ v_uuid_pattern
        GROUP BY LOWER(item->>'id')   -- one row per UUID after normalisation
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
  'Uses FOR LOOP + ->> (TEXT) operators. '
  'Immune to "ON CONFLICT DO UPDATE cannot affect row a second time". '
  'LOWER() GROUP BY prevents mixed-case UUID duplicates. '
  'Double exception guard (inner + outer) ensures the trigger is never blocking.';

COMMENT ON TRIGGER trg_track_customer_purchases ON orders IS
  'Updates customer_item_purchases when an order transitions to completed/delivered. '
  'Failures are logged as warnings and never roll back the order status update.';

DO $$
BEGIN
  RAISE NOTICE
    'Migration 148 applied: track_customer_item_purchases() recreated with ->> (TEXT) operators. '
    'FOR LOOP pattern. Legacy triggers dropped. Purchase tracking is now active and non-blocking.';
END $$;
