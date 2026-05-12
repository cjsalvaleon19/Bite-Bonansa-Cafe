-- ============================================================================
-- Migration 147: FOR LOOP purchase tracking trigger (immune to "a second time")
-- ============================================================================
-- Problem:
--   Even after migrations 142–146, production databases may still raise:
--
--     "ON CONFLICT DO UPDATE command cannot affect row a second time"
--
--   This error is triggered when the INSERT...SELECT used in 142–146 produces
--   two rows that both target the same (customer_id, menu_item_id) conflict key.
--   This happens when the items JSON contains the same UUID in different letter
--   cases (e.g. "ABC-..." vs "abc-...") AND the GROUP BY is on the raw text
--   rather than the LOWER()-normalised text — so they appear as two distinct
--   groups but both cast to the same UUID value.
--
--   Migration 146 added LOWER() normalisation inside INSERT...SELECT but the
--   error can still occur if that migration was not successfully applied to
--   the production database.
--
-- Root cause of retry failures in the client:
--   The cashier app retries the order-completion update with normalised items,
--   but the trigger in production ignores the supplied JSON and uses its own
--   buggy GROUP BY logic, so the retry hits the same error.
--
-- Fix approach (superior to INSERT...SELECT):
--   Use a FOR LOOP cursor with GROUP BY LOWER(item->>'id').
--   Each iteration of the loop issues ONE separate INSERT ... ON CONFLICT
--   statement.  A single-row INSERT cannot produce "cannot affect row a second
--   time" — that error is exclusive to multi-row INSERT...SELECT.
--
-- Additional safeguards (same as migration 146):
--   • LOWER() normalisation in GROUP BY — mixed-case UUIDs collapse to one row
--   • Inner BEGIN...EXCEPTION WHEN OTHERS — any per-item error is swallowed
--   • Outer EXCEPTION WHEN OTHERS — the whole function is non-blocking
--   • Drops ALL legacy trigger/function variants before recreation
-- ============================================================================

-- Drop every known variant of the purchase tracking trigger and function
-- (handles both the current name and any legacy names still in production)
DROP TRIGGER IF EXISTS trigger_update_customer_purchases ON orders;
DROP FUNCTION IF EXISTS update_customer_purchases();
DROP TRIGGER IF EXISTS trg_track_customer_purchases ON orders;
DROP FUNCTION IF EXISTS track_customer_item_purchases();

CREATE OR REPLACE FUNCTION track_customer_item_purchases()
RETURNS TRIGGER AS $$
DECLARE
  -- UUID pattern — lowercase only (IDs are normalised to lowercase below)
  v_uuid_pattern CONSTANT TEXT :=
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

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

    -- ── Inner block: purchase tracking is best-effort ─────────────────────
    -- Any error here is caught as a WARNING.
    -- The order status update ALWAYS commits regardless of what happens here.
    BEGIN

      -- FOR LOOP over aggregated items.
      --
      -- Why FOR LOOP instead of a single INSERT...SELECT?
      --   Each loop iteration issues ONE INSERT statement.  A single-row
      --   INSERT cannot produce "ON CONFLICT DO UPDATE command cannot affect
      --   row a second time" — that error is only possible when a multi-row
      --   INSERT...SELECT contains two source rows that both map to the same
      --   conflict target.
      --
      -- Why GROUP BY LOWER(item->>'id')?
      --   Two items with the same UUID but different letter case
      --   (e.g. "ABC-..." vs "abc-...") must fold into a single aggregated
      --   row so the FOR LOOP only processes that UUID once.
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
        -- Inner guard: catches any error in the loop (invalid cast, FK issue,
        -- etc.).  Logged as WARNING so it appears in Supabase database logs
        -- without blocking the order completion.
        RAISE WARNING
          '[track_customer_item_purchases] Purchase tracking failed for order %: %',
          NEW.id, SQLERRM;
    END;

  END IF;

  RETURN NEW;

EXCEPTION
  -- ── Outer guard: catches any logic error outside the inner block ──────────
  -- This should never fire in practice but guarantees the function is
  -- completely non-blocking under all circumstances.
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
  'Tracks customer purchases on first completion transition. '
  'Uses FOR LOOP (immune to "ON CONFLICT DO UPDATE cannot affect row a second time"). '
  'Normalises menu item IDs to lowercase before GROUP BY. '
  'Two-layer exception handling (inner + outer) guarantees the trigger never blocks order completion.';

COMMENT ON TRIGGER trg_track_customer_purchases ON orders IS
  'Updates customer_item_purchases when an order transitions to completed/delivered. '
  'Failures are logged as warnings and never roll back the order status update.';

DO $$
BEGIN
  RAISE NOTICE
    'Migration 147 applied: FOR LOOP purchase tracking trigger. '
    'Immune to "ON CONFLICT DO UPDATE cannot affect row a second time". '
    'Legacy trigger/function variants also dropped.';
END $$;
