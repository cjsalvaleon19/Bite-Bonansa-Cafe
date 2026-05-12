-- ============================================================================
-- Migration 146: Bulletproof purchase tracking trigger
-- ============================================================================
-- Problem:
--   Production databases that have not yet applied migration 145 (or earlier
--   exception-handling migrations) still raise a 500 on order completion:
--
--     "ON CONFLICT DO UPDATE command cannot affect row a second time"
--
--   This error propagates out of the trigger and rolls back the main
--   ORDER UPDATE, preventing the cashier from completing orders.
--
-- Root causes addressed:
--   1. Mixed-case UUID strings (e.g. "ABC-123" vs "abc-123") that are
--      textually distinct but cast to the same UUID, causing two INSERT rows
--      that both target the same (customer_id, menu_item_id) conflict key.
--   2. Trigger function lacking a top-level EXCEPTION WHEN OTHERS guard,
--      allowing any SQL error inside the function to propagate to the caller.
--
-- Fix:
--   a. Normalize item IDs to lowercase TEXT before GROUP BY so every
--      (customer_id, menu_item_id) pair appears exactly once.
--   b. Wrap the INSERT inside an inner BEGIN...EXCEPTION block (same as
--      migrations 088, 142, 145).
--   c. ADD an outer-level EXCEPTION WHEN OTHERS handler on the whole
--      function body so that even an unanticipated bug in this function
--      never rolls back the order status update.
-- ============================================================================

DROP TRIGGER IF EXISTS trg_track_customer_purchases ON orders;
DROP FUNCTION IF EXISTS track_customer_item_purchases();

CREATE OR REPLACE FUNCTION track_customer_item_purchases()
RETURNS TRIGGER AS $$
DECLARE
  -- Accept any letter case from the JSON payload; IDs are normalized to
  -- lowercase before grouping so each menu item appears at most once.
  v_uuid_pattern    CONSTANT TEXT := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  v_int_pattern     CONSTANT TEXT := '^-?\d+$';
  v_decimal_pattern CONSTANT TEXT := '^\d+(\.\d+)?$';
BEGIN
  -- ── Only process the first transition into a completed state ──────────────
  IF NEW.status IN ('order_delivered', 'completed')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('order_delivered', 'completed')) THEN

    -- Skip when customer or items payload is not usable
    IF NEW.customer_id IS NULL
       OR NEW.items IS NULL
       OR jsonb_typeof(NEW.items) <> 'array'
       OR jsonb_array_length(NEW.items) = 0 THEN
      RETURN NEW;
    END IF;

    -- ── Inner block: purchase tracking is best-effort only ─────────────────
    -- Any error here is caught and logged as a WARNING.
    -- The order status update ALWAYS commits successfully.
    BEGIN
      INSERT INTO customer_item_purchases (
        customer_id,
        menu_item_id,
        purchase_count,
        total_spent,
        last_purchased_at
      )
      SELECT
        NEW.customer_id,
        grouped.menu_item_id_text::UUID AS menu_item_id,
        grouped.total_quantity,
        grouped.total_price,
        COALESCE(NEW.completed_at, NEW.created_at)
      FROM (
        SELECT
          valid_items.menu_item_id_text,
          SUM(valid_items.quantity) AS total_quantity,
          SUM(valid_items.price)    AS total_price
        FROM (
          -- Normalize to lowercase BEFORE grouping so that "ABC-..." and
          -- "abc-..." are treated as the same item and folded into one row.
          SELECT
            LOWER(COALESCE(item->>'id', '')) AS menu_item_id_text,
            CASE
              WHEN COALESCE(item->>'quantity', '') ~ v_int_pattern
                THEN (item->>'quantity')::INT
              ELSE 1
            END AS quantity,
            CASE
              WHEN COALESCE(item->>'price', '') ~ v_decimal_pattern
                THEN (item->>'price')::NUMERIC
              ELSE 0
            END AS price
          FROM jsonb_array_elements(NEW.items) AS item
        ) AS valid_items
        WHERE valid_items.menu_item_id_text ~ v_uuid_pattern
        GROUP BY valid_items.menu_item_id_text   -- text group → at most one row per UUID
      ) AS grouped
      ON CONFLICT (customer_id, menu_item_id)
      DO UPDATE SET
        purchase_count    = customer_item_purchases.purchase_count    + EXCLUDED.purchase_count,
        total_spent       = customer_item_purchases.total_spent       + EXCLUDED.total_spent,
        last_purchased_at = GREATEST(customer_item_purchases.last_purchased_at, EXCLUDED.last_purchased_at);
    EXCEPTION
      WHEN OTHERS THEN
        -- Inner guard: catches ON CONFLICT duplicates and any other INSERT
        -- error. Logged as WARNING so it appears in Supabase logs without
        -- blocking the order completion.
        RAISE WARNING '[track_customer_item_purchases] Purchase tracking failed for order %: %',
          NEW.id, SQLERRM;
    END;

  END IF;

  RETURN NEW;

EXCEPTION
  -- ── Outer guard: safety net for any logic error outside the inner block ──
  -- This should never fire in practice, but guarantees the trigger function
  -- is completely non-blocking under all circumstances.
  WHEN OTHERS THEN
    RAISE WARNING '[track_customer_item_purchases] Unexpected error for order %: %',
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
  'Normalizes menu item IDs to lowercase before grouping (prevents mixed-case UUID conflicts). '
  'Two-layer exception handling (inner + outer) guarantees the trigger never blocks order completion.';

COMMENT ON TRIGGER trg_track_customer_purchases ON orders IS
  'Updates customer_item_purchases when an order transitions to completed/delivered. '
  'Failures are logged as warnings and never roll back the order status update.';

DO $$
BEGIN
  RAISE NOTICE 'Migration 146 applied: bulletproof purchase tracking trigger with double exception guard.';
END $$;
