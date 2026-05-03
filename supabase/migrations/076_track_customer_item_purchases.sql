-- ============================================================================
-- Track Customer Item Purchases
-- 
-- Purpose:
-- - Automatically populate customer_item_purchases table when orders complete
-- - Track purchase count and total spent per customer per item
-- - Enable "Most Purchased Items" feature in customer dashboard
--
-- Fixes:
-- - customer_item_purchases table not being populated
-- - Dashboard showing empty "Most Purchased Items" section
-- ============================================================================

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS trg_track_customer_purchases ON orders;
DROP FUNCTION IF EXISTS track_customer_item_purchases();

-- Create function to update customer purchase tracking
CREATE OR REPLACE FUNCTION track_customer_item_purchases()
RETURNS TRIGGER AS $$
DECLARE
  v_order_item RECORD;
  v_item_price DECIMAL(10,2);
BEGIN
  -- Only process when order status changes to completed/delivered
  IF NEW.status IN ('order_delivered', 'completed') AND 
     (OLD.status IS NULL OR OLD.status NOT IN ('order_delivered', 'completed')) THEN
    
    -- Check if customer_id exists
    IF NEW.customer_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    -- Parse items from the JSONB column
    -- Items are stored as: [{"id": "uuid", "name": "Item Name", "quantity": 1, "price": 100, ...}, ...]
    FOR v_order_item IN 
      SELECT 
        (item->>'id')::UUID as menu_item_id,
        COALESCE((item->>'quantity')::INT, 1) as quantity,
        COALESCE((item->>'price')::DECIMAL(10,2), 0) as total_price
      FROM jsonb_array_elements(NEW.items) AS item
      WHERE (item->>'id') IS NOT NULL
    LOOP
      -- Calculate price per unit
      v_item_price := CASE 
        WHEN v_order_item.quantity > 0 THEN v_order_item.total_price / v_order_item.quantity
        ELSE v_order_item.total_price
      END;
      
      -- Upsert into customer_item_purchases
      INSERT INTO customer_item_purchases (
        customer_id,
        menu_item_id,
        purchase_count,
        total_spent,
        last_purchased_at
      ) VALUES (
        NEW.customer_id,
        v_order_item.menu_item_id,
        v_order_item.quantity,
        v_order_item.total_price,
        NEW.created_at
      )
      ON CONFLICT (customer_id, menu_item_id) 
      DO UPDATE SET
        purchase_count = customer_item_purchases.purchase_count + EXCLUDED.purchase_count,
        total_spent = customer_item_purchases.total_spent + EXCLUDED.total_spent,
        last_purchased_at = EXCLUDED.last_purchased_at;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on orders table
CREATE TRIGGER trg_track_customer_purchases
  AFTER INSERT OR UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION track_customer_item_purchases();

COMMENT ON FUNCTION track_customer_item_purchases IS 
  'Automatically tracks customer purchase history when orders are completed';

COMMENT ON TRIGGER trg_track_customer_purchases ON orders IS 
  'Updates customer_item_purchases table when order status changes to completed/delivered';

-- Backfill existing completed orders (optional - only run if needed)
-- This will process all existing completed orders to populate purchase history
DO $$
DECLARE
  v_order RECORD;
  v_order_item RECORD;
  v_item_price DECIMAL(10,2);
  v_processed_count INT := 0;
BEGIN
  RAISE NOTICE 'Starting backfill of customer item purchases...';
  
  -- Process all completed orders that have customer_id and items
  FOR v_order IN 
    SELECT id, customer_id, items, created_at
    FROM orders
    WHERE status IN ('order_delivered', 'completed')
      AND customer_id IS NOT NULL
      AND items IS NOT NULL
      AND jsonb_array_length(items) > 0
    ORDER BY created_at ASC
  LOOP
    -- Process each item in the order
    FOR v_order_item IN 
      SELECT 
        (item->>'id')::UUID as menu_item_id,
        COALESCE((item->>'quantity')::INT, 1) as quantity,
        COALESCE((item->>'price')::DECIMAL(10,2), 0) as total_price
      FROM jsonb_array_elements(v_order.items) AS item
      WHERE (item->>'id') IS NOT NULL
    LOOP
      -- Calculate price per unit
      v_item_price := CASE 
        WHEN v_order_item.quantity > 0 THEN v_order_item.total_price / v_order_item.quantity
        ELSE v_order_item.total_price
      END;
      
      -- Upsert into customer_item_purchases
      INSERT INTO customer_item_purchases (
        customer_id,
        menu_item_id,
        purchase_count,
        total_spent,
        last_purchased_at
      ) VALUES (
        v_order.customer_id,
        v_order_item.menu_item_id,
        v_order_item.quantity,
        v_order_item.total_price,
        v_order.created_at
      )
      ON CONFLICT (customer_id, menu_item_id) 
      DO UPDATE SET
        purchase_count = customer_item_purchases.purchase_count + EXCLUDED.purchase_count,
        total_spent = customer_item_purchases.total_spent + EXCLUDED.total_spent,
        last_purchased_at = GREATEST(customer_item_purchases.last_purchased_at, EXCLUDED.last_purchased_at);
      
      v_processed_count := v_processed_count + 1;
    END LOOP;
  END LOOP;
  
  RAISE NOTICE 'Backfill complete. Processed % order items.', v_processed_count;
END $$;
