-- ============================================================================
-- Migration 145: Fix remaining ON CONFLICT edge case in customer purchase tracking
-- ============================================================================
-- Problem:
--   Some databases still raise:
--   "ON CONFLICT DO UPDATE command cannot affect row a second time"
--   inside track_customer_item_purchases().
--
-- Root cause:
--   The function aggregates by raw JSON id text before casting to UUID.
--   If one order payload contains the same UUID with different letter case
--   (e.g. ABC... and abc...), they become separate grouped rows, then both map
--   to the same UUID key during INSERT, causing a duplicate conflict target.
--
-- Fix:
--   Normalize item IDs to lowercase text first, then group on the normalized
--   value so each (customer_id, menu_item_id) is emitted once per order.
-- ============================================================================

DROP TRIGGER IF EXISTS trg_track_customer_purchases ON orders;
DROP FUNCTION IF EXISTS track_customer_item_purchases();

CREATE OR REPLACE FUNCTION track_customer_item_purchases()
RETURNS TRIGGER AS $$
DECLARE
  -- Accept either case from payload; ids are normalized to lowercase before grouping.
  v_uuid_pattern    CONSTANT TEXT := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  v_int_pattern     CONSTANT TEXT := '^-?\d+$';
  v_decimal_pattern CONSTANT TEXT := '^\d+(\.\d+)?$';
BEGIN
  IF NEW.status IN ('order_delivered', 'completed')
     AND (OLD.status IS NULL OR OLD.status NOT IN ('order_delivered', 'completed')) THEN

    IF NEW.customer_id IS NULL
       OR NEW.items IS NULL
       OR jsonb_typeof(NEW.items) <> 'array'
       OR jsonb_array_length(NEW.items) = 0 THEN
      RETURN NEW;
    END IF;

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
        GROUP BY valid_items.menu_item_id_text
      ) AS grouped
      ON CONFLICT (customer_id, menu_item_id)
      DO UPDATE SET
        purchase_count = customer_item_purchases.purchase_count + EXCLUDED.purchase_count,
        total_spent = customer_item_purchases.total_spent + EXCLUDED.total_spent,
        last_purchased_at = GREATEST(customer_item_purchases.last_purchased_at, EXCLUDED.last_purchased_at);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '[track_customer_item_purchases] Purchase tracking failed for order %: %',
          NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_track_customer_purchases
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION track_customer_item_purchases();

COMMENT ON FUNCTION track_customer_item_purchases IS
  'Tracks customer purchases on first completion transition. Normalizes menu item IDs to lowercase before grouping to prevent duplicate ON CONFLICT rows.';

COMMENT ON TRIGGER trg_track_customer_purchases ON orders IS
  'Updates customer_item_purchases when order transitions to completed/delivered. Failures are warnings only and never block order completion.';

DO $$
BEGIN
  RAISE NOTICE 'Migration 145 applied: normalized lowercase grouping for menu_item_id in track_customer_item_purchases().';
END $$;
