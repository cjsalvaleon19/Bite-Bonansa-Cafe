-- ============================================================================
-- Migration 150: Force-cleanup lingering purchase-tracking triggers on orders
-- ============================================================================
-- ✅ THIS IS THE FILE TO PASTE INTO THE SUPABASE SQL EDITOR.
--    Do NOT paste from RUN_MIGRATION_150.md — that file contains markdown
--    code fences (```) which cause: ERROR: syntax error at or near "```"
-- ============================================================================
-- Use this when migration 149 has already been applied, but order completion
-- still fails with:
--   ON CONFLICT DO UPDATE command cannot affect row a second time
--
-- Root issue in these cases is usually an unexpected/legacy trigger still
-- attached to public.orders (often with a non-standard trigger name), which
-- still executes old purchase-tracking logic and rolls back the UPDATE.
--
-- This migration:
--   1) Drops ANY non-internal trigger on public.orders whose function name or
--      body indicates purchase tracking.
--   2) Drops all existing track_customer_item_purchases()/update_customer_purchases()
--      function variants.
--   3) Recreates ONLY the safe jsonb_extract_path_text() version.
-- ============================================================================

DO $$
DECLARE
  v_trigger RECORD;
  v_fn RECORD;
BEGIN
  -- Drop all purchase-tracking related triggers on public.orders, regardless of
  -- trigger name. This catches legacy custom names not handled by older scripts.
  FOR v_trigger IN
    SELECT
      t.tgname AS trigger_name
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace pn ON pn.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'orders'
      AND NOT t.tgisinternal
      AND (
        p.proname IN ('track_customer_item_purchases', 'update_customer_purchases')
        OR p.proname ILIKE '%customer%purchase%'
        OR pg_get_functiondef(p.oid) ILIKE '%customer_item_purchases%'
      )
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.orders', v_trigger.trigger_name);
  END LOOP;

  -- Drop known purchase-tracking function variants by exact identity.
  FOR v_fn IN
    SELECT
      pn.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_namespace pn ON pn.oid = p.pronamespace
    WHERE p.proname IN ('track_customer_item_purchases', 'update_customer_purchases')
  LOOP
    EXECUTE format(
      'DROP FUNCTION IF EXISTS %I.%I(%s)',
      v_fn.schema_name,
      v_fn.function_name,
      v_fn.identity_args
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.track_customer_item_purchases()
RETURNS TRIGGER AS $$
DECLARE
  v_uuid_pattern CONSTANT TEXT :=
    '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  v_item RECORD;
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
        RAISE WARNING
          '[track_customer_item_purchases] Purchase tracking failed for order %: %',
          NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING
      '[track_customer_item_purchases] Unexpected error for order %: %',
      NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_track_customer_purchases
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.track_customer_item_purchases();

COMMENT ON FUNCTION public.track_customer_item_purchases IS
  'Tracks customer purchases on first order completion. '
  'Migration 150 force-cleans residual legacy trigger/function variants first. '
  'Uses FOR LOOP + jsonb_extract_path_text() with inner/outer exception guards.';

DO $$
BEGIN
  RAISE NOTICE
    'Migration 150 applied: purchase-tracking triggers force-cleaned and safe trigger recreated.';
END $$;
