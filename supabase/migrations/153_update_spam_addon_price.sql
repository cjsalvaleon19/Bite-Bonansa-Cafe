-- Migration 153: Update Spam add-on price from 15 to 20
-- Applies to all menu items (e.g. Clubhouse) where the Spam add-on is priced at 15

UPDATE menu_item_variant_options
SET price_modifier = 20
WHERE option_name = 'Spam'
  AND price_modifier = 15;
