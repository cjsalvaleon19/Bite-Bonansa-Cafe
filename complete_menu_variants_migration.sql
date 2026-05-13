-- ============================================================
-- 012 Add Variant Columns & Seed Full Bite Bonansa Menu
-- ============================================================
-- Run AFTER scripts 001–011.
-- Safe to re-run:
--   • ALTER TABLE uses ADD COLUMN IF NOT EXISTS
--   • INSERT uses ON CONFLICT (name) DO UPDATE
-- ============================================================

-- ============================================================
-- 1. Add variant columns to menu_items
-- ============================================================
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS category_id        UUID        REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description        TEXT,
  ADD COLUMN IF NOT EXISTS image_url          TEXT,
  ADD COLUMN IF NOT EXISTS available          BOOLEAN     DEFAULT true,
  ADD COLUMN IF NOT EXISTS featured           BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS varieties          JSONB       DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS addons             JSONB       DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sizes              JSONB       DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS preparation_time   INT         DEFAULT 5,
  ADD COLUMN IF NOT EXISTS kitchen_department TEXT,
  ADD COLUMN IF NOT EXISTS created_at         TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ DEFAULT NOW();

-- ============================================================
-- 2. Ensure name is unique (required for ON CONFLICT upsert)
--    First, collapse any duplicate names (keep newest row).
-- ============================================================
DELETE FROM public.menu_items
WHERE id NOT IN (
  SELECT DISTINCT ON (name) id
  FROM public.menu_items
  ORDER BY name, created_at DESC
);

ALTER TABLE public.menu_items
  DROP CONSTRAINT IF EXISTS menu_items_name_key;
ALTER TABLE public.menu_items
  ADD CONSTRAINT menu_items_name_key UNIQUE (name);

-- ============================================================
-- 3. Upsert real Bite Bonansa categories
-- ============================================================
INSERT INTO public.categories (name, description, sort_order) VALUES
  ('Snacks & Bites',        'Crispy bites and snacks',                 1),
  ('Noodles',               'Korean-inspired noodle dishes',            2),
  ('Chicken',               'Flavor-loaded chicken meals and burgers',  3),
  ('Rice & More',           'Silog meals, waffles, and more',           4),
  ('Milktea Series',        'Classic and specialty milk teas',          5),
  ('Hot/Iced Drinks',       'Espresso-based hot and iced drinks',       6),
  ('Frappe Series',         'Blended frozen frappe drinks',             7),
  ('Fruit Soda & Lemonade', 'Fresh fruit sodas and lemonades',          8)
ON CONFLICT (name) DO UPDATE
  SET description = EXCLUDED.description,
      sort_order  = EXCLUDED.sort_order;

-- ============================================================
-- 4. Upsert full menu with variants
-- ============================================================
INSERT INTO public.menu_items
  (name, price, category, category_id, varieties, sizes, addons, kitchen_department, available, featured)
SELECT
  v.name,
  v.price,
  v.category_name,
  c.id,
  v.varieties::jsonb,
  v.sizes::jsonb,
  v.addons::jsonb,
  v.kitchen,
  true,
  false
FROM (VALUES

  -- Snacks & Bites
  ('Nachos', 94.00, 'Snacks & Bites',
   '[]', '[]',
   '[{"name":"Sinamak","price":0},{"name":"Meaty Sauce","price":0},{"name":"Mayonnaise","price":0}]',
   'Fryer 1'),
  ('Fries', 94.00, 'Snacks & Bites',
   '[]', '[]',
   '[{"name":"Cheese","price":0},{"name":"Meaty Sauce","price":0},{"name":"Sour Cream","price":0},{"name":"Barbeque","price":0}]',
   'Fryer 1'),
  ('Siomai', 74.00, 'Snacks & Bites',
   '["Steamed","Fried"]', '[]',
   '[{"name":"Spicy","price":0},{"name":"Regular","price":0}]',
   'Fryer 2'),
  ('Calamares', 94.00, 'Snacks & Bites',
   '[]', '[]',
   '[{"name":"Meaty Sauce","price":0},{"name":"Sinamak","price":0},{"name":"Mayonnaise","price":0}]',
   'Fryer 1'),

  -- Noodles
  ('Spag Solo', 94.00, 'Noodles', '[]', '[]', '[{"name":"Meaty Sauce","price":15}]', 'Fryer 1'),
  ('Spag & Chicken', 134.00, 'Noodles', '[]', '[]', '[{"name":"Meaty Sauce","price":15}]', 'Fryer 1'),
  ('Ramyeon Solo', 104.00, 'Noodles',
   '["Mild","Spicy"]', '[]',
   '[{"name":"Spam","price":20},{"name":"Egg","price":15},{"name":"Cheese","price":20}]',
   'Fryer 1'),
  ('Ramyeon Overload', 139.00, 'Noodles',
   '["Mild","Spicy"]', '[]',
   '[{"name":"Spam","price":20},{"name":"Egg","price":15},{"name":"Cheese","price":20}]',
   'Fryer 1'),
  ('Samyang Carbonara Solo', 134.00, 'Noodles',
   '["Mild","Spicy"]', '[]',
   '[{"name":"Spam","price":20},{"name":"Egg","price":15},{"name":"Cheese","price":20}]',
   'Fryer 1'),
  ('Samyang Carbonara Overload', 174.00, 'Noodles',
   '["Mild","Spicy"]', '[]',
   '[{"name":"Spam","price":20},{"name":"Egg","price":15},{"name":"Cheese","price":20}]',
   'Fryer 1'),
  ('Samyang Carbonara & Chicken', 174.00, 'Noodles',
   '["Mild","Spicy"]', '[]',
   '[{"name":"Spam","price":20},{"name":"Egg","price":15},{"name":"Cheese","price":20}]',
   'Fryer 1'),
  ('Tteokbokki Solo', 144.00, 'Noodles',
   '["Mild","Spicy"]', '[]',
   '[{"name":"Spam","price":20},{"name":"Egg","price":15},{"name":"Cheese","price":20}]',
   'Fryer 1'),
  ('Tteokbokki Overload', 179.00, 'Noodles',
   '["Mild","Spicy"]', '[]',
   '[{"name":"Spam","price":20},{"name":"Egg","price":15},{"name":"Cheese","price":20}]',
   'Fryer 1'),

  -- Chicken
  ('Chicken Meals', 84.00, 'Chicken',
   '["Honey Butter","Soy Garlic","Sweet & Sour","Sweet & Spicy","Teriyaki","Buffalo","Barbecue"]',
   '[]', '[{"name":"Rice","price":15}]', 'Fryer 1'),
  ('Chicken Platter', 254.00, 'Chicken',
   '["Honey Butter","Soy Garlic","Sweet & Sour","Sweet & Spicy","Teriyaki","Buffalo","Barbecue"]',
   '[]', '[{"name":"Rice","price":15}]', 'Fryer 1'),
  ('Chicken Burger', 104.00, 'Chicken',
   '["Honey Butter","Soy Garlic","Sweet & Sour","Sweet & Spicy","Teriyaki","Buffalo","Barbecue","Original"]',
   '[]', '[]', 'Fryer 1'),

  -- Rice & More
  ('Silog Meals', 114.00, 'Rice & More',
   '["Luncheonsilog","Tapsilog","Tocilog","Cornsilog","Chicsilog","Hotsilog","Siomaisilog"]',
   '[]', '[]', 'Fryer 1'),
  ('Waffles', 104.00, 'Rice & More',
   '["Biscoff","Strawberry","Oreo","Mallows"]', '[]', '[]', 'Pastries'),
  ('Clubhouse', 104.00, 'Rice & More',
   '[]', '[]',
   '[{"name":"No Veggies","price":0},{"name":"Spam","price":20}]',
   'Fryer 2'),
  ('Footlong', 94.00, 'Rice & More',
   '["Regular","Spicy"]', '[]', '[{"name":"No Veggies","price":0}]', 'Fryer 2'),
  ('Spam Musubi', 104.00, 'Rice & More', '[]', '[]', '[]', 'Fryer 2'),
  ('Sushi', 104.00, 'Rice & More', '[]', '[]', '[]', 'Fryer 2'),
  ('Caesar Salad', 104.00, 'Rice & More', '[]', '[]', '[]', 'Fryer 2'),

  -- Milktea Series
  ('Brown Sugar Milktea', 99.00, 'Milktea Series', '[]',
   '[{"name":"16oz","price":99},{"name":"22oz","price":114}]',
   '[{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15},{"name":"Coffee Jelly","price":15}]',
   'Drinks'),
  ('Wintermelon Milktea', 99.00, 'Milktea Series', '[]',
   '[{"name":"16oz","price":99},{"name":"22oz","price":114}]',
   '[{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15},{"name":"Coffee Jelly","price":15}]',
   'Drinks'),
  ('Okinawa Milktea', 99.00, 'Milktea Series', '[]',
   '[{"name":"16oz","price":99},{"name":"22oz","price":114}]',
   '[{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15},{"name":"Coffee Jelly","price":15}]',
   'Drinks'),
  ('Hokkaido Milktea', 99.00, 'Milktea Series', '[]',
   '[{"name":"16oz","price":99},{"name":"22oz","price":114}]',
   '[{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15},{"name":"Coffee Jelly","price":15}]',
   'Drinks'),
  ('Ube Taro Milktea', 99.00, 'Milktea Series', '[]',
   '[{"name":"16oz","price":99},{"name":"22oz","price":114}]',
   '[{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15},{"name":"Coffee Jelly","price":15}]',
   'Drinks'),
  ('Red Velvet Milktea', 104.00, 'Milktea Series', '[]',
   '[{"name":"16oz","price":104},{"name":"22oz","price":119}]',
   '[{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15},{"name":"Coffee Jelly","price":15}]',
   'Drinks'),
  ('Strawberry Milktea', 99.00, 'Milktea Series', '[]',
   '[{"name":"16oz","price":99},{"name":"22oz","price":114}]',
   '[{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15},{"name":"Coffee Jelly","price":15}]',
   'Drinks'),
  ('Matcha Milktea', 104.00, 'Milktea Series', '[]',
   '[{"name":"16oz","price":104},{"name":"22oz","price":119}]',
   '[{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15},{"name":"Coffee Jelly","price":15}]',
   'Drinks'),
  ('Cookies & Cream Milktea', 104.00, 'Milktea Series', '[]',
   '[{"name":"16oz","price":104},{"name":"22oz","price":119}]',
   '[{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15},{"name":"Coffee Jelly","price":15}]',
   'Drinks'),
  ('Dark Chocolate Milktea', 104.00, 'Milktea Series', '[]',
   '[{"name":"16oz","price":104},{"name":"22oz","price":119}]',
   '[{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15},{"name":"Coffee Jelly","price":15}]',
   'Drinks'),
  ('Strawberry Matcha Milktea', 109.00, 'Milktea Series', '[]',
   '[{"name":"16oz","price":109},{"name":"22oz","price":124}]',
   '[{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15},{"name":"Coffee Jelly","price":15}]',
   'Drinks'),
  ('Blueberry Matcha Milktea', 109.00, 'Milktea Series', '[]',
   '[{"name":"16oz","price":109},{"name":"22oz","price":124}]',
   '[{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15},{"name":"Coffee Jelly","price":15}]',
   'Drinks'),
  ('Oreo Matcha Milktea', 109.00, 'Milktea Series', '[]',
   '[{"name":"16oz","price":109},{"name":"22oz","price":124}]',
   '[{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15},{"name":"Coffee Jelly","price":15}]',
   'Drinks'),
  ('Mocha Milktea', 109.00, 'Milktea Series', '[]',
   '[{"name":"16oz","price":109},{"name":"22oz","price":124}]',
   '[{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15},{"name":"Coffee Jelly","price":15}]',
   'Drinks'),
  ('Caramel Macchiato Milktea', 109.00, 'Milktea Series', '[]',
   '[{"name":"16oz","price":109},{"name":"22oz","price":124}]',
   '[{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15},{"name":"Coffee Jelly","price":15}]',
   'Drinks'),
  ('Brown Sugar Coffee Milktea', 109.00, 'Milktea Series', '[]',
   '[{"name":"16oz","price":109},{"name":"22oz","price":124}]',
   '[{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15},{"name":"Coffee Jelly","price":15},{"name":"Extra Shot","price":15}]',
   'Drinks'),

  -- Hot/Iced Drinks
  ('Americano', 74.00, 'Hot/Iced Drinks', '["Hot","Iced"]',
   '[{"name":"12oz","price":74},{"name":"16oz","price":74},{"name":"22oz","price":84}]',
   '[{"name":"Extra Shot","price":15}]', 'Drinks'),
  ('Spanish Latte', 99.00, 'Hot/Iced Drinks', '["Hot","Iced"]',
   '[{"name":"12oz","price":99},{"name":"16oz","price":104},{"name":"22oz","price":119}]',
   '[{"name":"Extra Shot","price":15},{"name":"Coffee Jelly","price":15},{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15}]',
   'Drinks'),
  ('Cafe Latte', 99.00, 'Hot/Iced Drinks', '["Hot","Iced"]',
   '[{"name":"12oz","price":99},{"name":"16oz","price":104},{"name":"22oz","price":119}]',
   '[{"name":"Extra Shot","price":15},{"name":"Coffee Jelly","price":15},{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15}]',
   'Drinks'),
  ('Caramel Macchiato', 104.00, 'Hot/Iced Drinks', '["Hot","Iced"]',
   '[{"name":"12oz","price":104},{"name":"16oz","price":114},{"name":"22oz","price":129}]',
   '[{"name":"Extra Shot","price":15},{"name":"Coffee Jelly","price":15},{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15}]',
   'Drinks'),
  ('Cafe Mocha', 104.00, 'Hot/Iced Drinks', '["Hot","Iced"]',
   '[{"name":"12oz","price":104},{"name":"16oz","price":114},{"name":"22oz","price":129}]',
   '[{"name":"Extra Shot","price":15},{"name":"Coffee Jelly","price":15},{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15}]',
   'Drinks'),
  ('Mocha Latte', 104.00, 'Hot/Iced Drinks', '["Hot","Iced"]',
   '[{"name":"12oz","price":104},{"name":"16oz","price":114},{"name":"22oz","price":129}]',
   '[{"name":"Extra Shot","price":15},{"name":"Coffee Jelly","price":15},{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15}]',
   'Drinks'),
  ('Caramel Mocha', 104.00, 'Hot/Iced Drinks', '["Hot","Iced"]',
   '[{"name":"12oz","price":104},{"name":"16oz","price":114},{"name":"22oz","price":129}]',
   '[{"name":"Extra Shot","price":15},{"name":"Coffee Jelly","price":15},{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15}]',
   'Drinks'),
  ('Matcha Espresso', 104.00, 'Hot/Iced Drinks', '["Hot","Iced"]',
   '[{"name":"12oz","price":104},{"name":"16oz","price":114},{"name":"22oz","price":129}]',
   '[{"name":"Extra Shot","price":15},{"name":"Coffee Jelly","price":15},{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15}]',
   'Drinks'),
  ('White Choco Matcha Latte', 104.00, 'Hot/Iced Drinks', '["Hot","Iced"]',
   '[{"name":"12oz","price":104},{"name":"16oz","price":114},{"name":"22oz","price":129}]',
   '[{"name":"Extra Shot","price":15},{"name":"Coffee Jelly","price":15},{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15}]',
   'Drinks'),
  ('Dark Chocolate', 104.00, 'Hot/Iced Drinks', '["Hot","Iced"]',
   '[{"name":"12oz","price":104},{"name":"16oz","price":114},{"name":"22oz","price":129}]',
   '[{"name":"Extra Shot","price":15},{"name":"Coffee Jelly","price":15},{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15}]',
   'Drinks'),
  ('Matcha Latte', 104.00, 'Hot/Iced Drinks', '["Hot","Iced"]',
   '[{"name":"12oz","price":104},{"name":"16oz","price":114},{"name":"22oz","price":129}]',
   '[{"name":"Extra Shot","price":15},{"name":"Coffee Jelly","price":15},{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15}]',
   'Drinks'),
  ('Strawberry Latte', 99.00, 'Hot/Iced Drinks', '["Hot","Iced"]',
   '[{"name":"12oz","price":99},{"name":"16oz","price":104},{"name":"22oz","price":119}]',
   '[{"name":"Extra Shot","price":15},{"name":"Coffee Jelly","price":15},{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15}]',
   'Drinks'),
  ('Blueberry Latte', 99.00, 'Hot/Iced Drinks', '["Hot","Iced"]',
   '[{"name":"12oz","price":99},{"name":"16oz","price":104},{"name":"22oz","price":119}]',
   '[{"name":"Extra Shot","price":15},{"name":"Coffee Jelly","price":15},{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15}]',
   'Drinks'),
  ('Ube Taro Latte', 99.00, 'Hot/Iced Drinks', '["Hot","Iced"]',
   '[{"name":"12oz","price":99},{"name":"16oz","price":104},{"name":"22oz","price":119}]',
   '[{"name":"Extra Shot","price":15},{"name":"Coffee Jelly","price":15},{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15}]',
   'Drinks'),
  ('Biscoff Latte', 99.00, 'Hot/Iced Drinks', '["Hot","Iced"]',
   '[{"name":"12oz","price":99},{"name":"16oz","price":109},{"name":"22oz","price":124}]',
   '[{"name":"Extra Shot","price":15},{"name":"Coffee Jelly","price":15},{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15}]',
   'Drinks'),
  ('Biscoff Matcha Latte', 104.00, 'Hot/Iced Drinks', '["Hot","Iced"]',
   '[{"name":"12oz","price":104},{"name":"16oz","price":119},{"name":"22oz","price":134}]',
   '[{"name":"Extra Shot","price":15},{"name":"Coffee Jelly","price":15},{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15}]',
   'Drinks'),
  ('Biscoff Cafe Latte', 104.00, 'Hot/Iced Drinks', '["Hot","Iced"]',
   '[{"name":"12oz","price":104},{"name":"16oz","price":119},{"name":"22oz","price":134}]',
   '[{"name":"Extra Shot","price":15},{"name":"Coffee Jelly","price":15},{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15}]',
   'Drinks'),
  ('Passion Fruit Latte', 99.00, 'Hot/Iced Drinks', '["Hot","Iced"]',
   '[{"name":"12oz","price":99},{"name":"16oz","price":104},{"name":"22oz","price":119}]',
   '[{"name":"Extra Shot","price":15},{"name":"Coffee Jelly","price":15},{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15}]',
   'Drinks'),
  ('Oreo Latte', 104.00, 'Hot/Iced Drinks', '["Hot","Iced"]',
   '[{"name":"12oz","price":104},{"name":"16oz","price":114},{"name":"22oz","price":129}]',
   '[{"name":"Extra Shot","price":15},{"name":"Coffee Jelly","price":15},{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15}]',
   'Drinks'),

  -- Frappe Series
  ('Caramel Macchiato Frappe', 124.00, 'Frappe Series', '[]',
   '[{"name":"16oz","price":124},{"name":"22oz","price":139}]',
   '[{"name":"Coffee Jelly","price":15},{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15}]',
   'Drinks'),
  ('Cookies & Cream Frappe', 124.00, 'Frappe Series', '[]',
   '[{"name":"16oz","price":124},{"name":"22oz","price":139}]',
   '[{"name":"Coffee Jelly","price":15},{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15}]',
   'Drinks'),
  ('Matcha Frappe', 124.00, 'Frappe Series', '[]',
   '[{"name":"16oz","price":124},{"name":"22oz","price":139}]',
   '[{"name":"Coffee Jelly","price":15},{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15}]',
   'Drinks'),
  ('Strawberry Frappe', 119.00, 'Frappe Series', '[]',
   '[{"name":"16oz","price":119},{"name":"22oz","price":134}]',
   '[{"name":"Coffee Jelly","price":15},{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15}]',
   'Drinks'),
  ('Red Velvet Frappe', 119.00, 'Frappe Series', '[]',
   '[{"name":"16oz","price":119},{"name":"22oz","price":134}]',
   '[{"name":"Coffee Jelly","price":15},{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15}]',
   'Drinks'),
  ('Ube Taro Frappe', 119.00, 'Frappe Series', '[]',
   '[{"name":"16oz","price":119},{"name":"22oz","price":134}]',
   '[{"name":"Coffee Jelly","price":15},{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15}]',
   'Drinks'),
  ('Dark Chocolate Frappe', 124.00, 'Frappe Series', '[]',
   '[{"name":"16oz","price":124},{"name":"22oz","price":139}]',
   '[{"name":"Coffee Jelly","price":15},{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15}]',
   'Drinks'),
  ('Mocha Frappe', 124.00, 'Frappe Series', '[]',
   '[{"name":"16oz","price":124},{"name":"22oz","price":139}]',
   '[{"name":"Coffee Jelly","price":15},{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15}]',
   'Drinks'),
  ('Mocha Latte Frappe', 124.00, 'Frappe Series', '[]',
   '[{"name":"16oz","price":124},{"name":"22oz","price":139}]',
   '[{"name":"Coffee Jelly","price":15},{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15}]',
   'Drinks'),
  ('Lotus Biscoff Frappe', 134.00, 'Frappe Series', '[]',
   '[{"name":"16oz","price":134},{"name":"22oz","price":149}]',
   '[{"name":"Coffee Jelly","price":15},{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15}]',
   'Drinks'),
  ('Mango Graham Frappe', 134.00, 'Frappe Series', '[]',
   '[{"name":"16oz","price":134},{"name":"22oz","price":149}]',
   '[{"name":"Pearls","price":15},{"name":"Cream Cheese","price":15}]',
   'Drinks'),

  -- Fruit Soda & Lemonade
  ('Strawberry Soda', 54.00, 'Fruit Soda & Lemonade', '[]',
   '[{"name":"16oz","price":54},{"name":"22oz","price":69}]', '[]', 'Drinks'),
  ('Green Apple Soda', 54.00, 'Fruit Soda & Lemonade', '[]',
   '[{"name":"16oz","price":54},{"name":"22oz","price":69}]', '[]', 'Drinks'),
  ('Blue Lemonade Soda', 54.00, 'Fruit Soda & Lemonade', '[]',
   '[{"name":"16oz","price":54},{"name":"22oz","price":69}]', '[]', 'Drinks'),
  ('Lychee Soda', 54.00, 'Fruit Soda & Lemonade', '[]',
   '[{"name":"16oz","price":54},{"name":"22oz","price":69}]', '[]', 'Drinks'),
  ('Blueberry Soda', 64.00, 'Fruit Soda & Lemonade', '[]',
   '[{"name":"16oz","price":64},{"name":"22oz","price":79}]', '[]', 'Drinks'),
  ('Passion Fruit Soda', 74.00, 'Fruit Soda & Lemonade', '[]',
   '[{"name":"16oz","price":74},{"name":"22oz","price":89}]', '[]', 'Drinks'),
  ('Lemonade Juice', 54.00, 'Fruit Soda & Lemonade', '[]',
   '[{"name":"16oz","price":54},{"name":"22oz","price":69}]', '[]', 'Drinks'),
  ('Lemon Strawberry Juice', 64.00, 'Fruit Soda & Lemonade', '[]',
   '[{"name":"16oz","price":64},{"name":"22oz","price":79}]', '[]', 'Drinks'),
  ('Lemon Blueberry Juice', 64.00, 'Fruit Soda & Lemonade', '[]',
   '[{"name":"16oz","price":64},{"name":"22oz","price":79}]', '[]', 'Drinks'),
  ('Lemon Passion Fruit Juice', 84.00, 'Fruit Soda & Lemonade', '[]',
   '[{"name":"16oz","price":84},{"name":"22oz","price":99}]', '[]', 'Drinks'),
  ('Lemon Yogurt Slush', 94.00, 'Fruit Soda & Lemonade', '[]',
   '[{"name":"16oz","price":94},{"name":"22oz","price":109}]', '[]', 'Drinks')

) AS v(name, price, category_name, varieties, sizes, addons, kitchen)
JOIN public.categories c ON c.name = v.category_name
ON CONFLICT (name) DO UPDATE SET
  price               = EXCLUDED.price,
  category            = EXCLUDED.category,
  category_id         = EXCLUDED.category_id,
  varieties           = EXCLUDED.varieties,
  sizes               = EXCLUDED.sizes,
  addons              = EXCLUDED.addons,
  kitchen_department  = EXCLUDED.kitchen_department,
  updated_at          = NOW();

-- ============================================================
-- 5. Verification
-- ============================================================
SELECT c.name AS category, COUNT(m.id) AS item_count
FROM public.categories c
LEFT JOIN public.menu_items m ON m.category_id = c.id
WHERE c.name IN (
  'Snacks & Bites','Noodles','Chicken','Rice & More',
  'Milktea Series','Hot/Iced Drinks','Frappe Series','Fruit Soda & Lemonade'
)
GROUP BY c.name, c.sort_order
ORDER BY c.sort_order;
