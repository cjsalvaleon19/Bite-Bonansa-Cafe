-- ============================================================================
-- Migration: 139_add_others_to_categories
-- Description: Add "Others" to the categories table so that the new Others
--              menu items (Coke in Can, Pepsi in Can, Minute Maid, Rite 'N Lite,
--              Mismo, Del Monte Juice in Can, Calamansi Juice) are visible as a
--              category tab in both the Customer and Cashier interfaces.
-- Created: 2026-05-11
-- ============================================================================

INSERT INTO categories (name, sort_order)
VALUES ('Others', 9)
ON CONFLICT (name) DO UPDATE SET sort_order = EXCLUDED.sort_order;
