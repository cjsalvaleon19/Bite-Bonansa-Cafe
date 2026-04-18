-- Menu Items Insert Script for Bite Bonansa Cafe
-- Based on menu images provided

-- Clear existing menu items (optional - uncomment if needed)
-- DELETE FROM menu_items;

-- ============================================================================
-- MAIN DISHES & APPETIZERS
-- ============================================================================

-- Nachos
INSERT INTO menu_items (name, category, price, available, description) VALUES
('Nachos', 'Appetizers', 89.00, true, 'Crispy tortilla chips with toppings');

-- Fries
INSERT INTO menu_items (name, category, price, available, description) VALUES
('Fries - Cheese', 'Appetizers', 89.00, true, 'Crispy fries with cheese sauce'),
('Fries - Meaty Sauce', 'Appetizers', 89.00, true, 'Crispy fries with meaty sauce'),
('Fries - Sour Cream', 'Appetizers', 89.00, true, 'Crispy fries with sour cream'),
('Fries - Barbecue', 'Appetizers', 89.00, true, 'Crispy fries with barbecue sauce');

-- Siomai
INSERT INTO menu_items (name, category, price, available, description) VALUES
('Siomai - Steamed', 'Appetizers', 69.00, true, 'Steamed pork dumplings'),
('Siomai - Fried', 'Appetizers', 69.00, true, 'Fried pork dumplings');

-- Calamares
INSERT INTO menu_items (name, category, price, available, description) VALUES
('Calamares - Meaty Sauce', 'Appetizers', 89.00, true, 'Fried squid rings with meaty sauce'),
('Calamares - Sinamak', 'Appetizers', 89.00, true, 'Fried squid rings with sinamak'),
('Calamares - Mayonnaise', 'Appetizers', 89.00, true, 'Fried squid rings with mayonnaise');

-- ============================================================================
-- PASTA & NOODLES
-- ============================================================================

-- Solo Pasta
INSERT INTO menu_items (name, category, price, available, description) VALUES
('Spag Solo', 'Pasta', 89.00, true, 'Solo serving of spaghetti'),
('Ramyeon Solo', 'Noodles', 99.00, true, 'Solo serving of Korean ramen'),
('Samyang Carbonara Solo', 'Noodles', 129.00, true, 'Solo serving of Samyang carbonara'),
('Tteokbokki Solo', 'Korean', 139.00, true, 'Solo serving of Korean rice cakes');

-- Combo Pasta
INSERT INTO menu_items (name, category, price, available, description) VALUES
('Spag & Chicken', 'Pasta', 129.00, true, 'Spaghetti with fried chicken'),
('Ramyeon Overload', 'Noodles', 129.00, true, 'Korean ramen with extra toppings'),
('Samyang Carbonara Overload', 'Noodles', 159.00, true, 'Samyang carbonara with extra toppings'),
('Tteokbokki Overload', 'Korean', 169.00, true, 'Korean rice cakes with extra toppings');

-- ============================================================================
-- CHICKEN MEALS
-- ============================================================================

INSERT INTO menu_items (name, category, price, available, description) VALUES
('Chicken Meals - Barbecue', 'Chicken', 79.00, true, 'Chicken meal with barbecue flavor'),
('Chicken Meals - Buffalo Wings', 'Chicken', 79.00, true, 'Chicken meal with buffalo wings flavor'),
('Chicken Meals - Honey Butter', 'Chicken', 79.00, true, 'Chicken meal with honey butter flavor'),
('Chicken Meals - Sweet & Sour', 'Chicken', 79.00, true, 'Chicken meal with sweet and sour flavor'),
('Chicken Meals - Sweet & Spicy', 'Chicken', 79.00, true, 'Chicken meal with sweet and spicy flavor'),
('Chicken Meals - Soy Garlic', 'Chicken', 79.00, true, 'Chicken meal with soy garlic flavor'),
('Chicken Meals - Teriyaki', 'Chicken', 79.00, true, 'Chicken meal with teriyaki flavor');

-- Chicken Platter
INSERT INTO menu_items (name, category, price, available, description) VALUES
('Chicken Platter - Barbecue', 'Chicken', 249.00, true, 'Chicken platter with barbecue flavor'),
('Chicken Platter - Buffalo Wings', 'Chicken', 249.00, true, 'Chicken platter with buffalo wings flavor'),
('Chicken Platter - Honey Butter', 'Chicken', 249.00, true, 'Chicken platter with honey butter flavor'),
('Chicken Platter - Sweet & Sour', 'Chicken', 249.00, true, 'Chicken platter with sweet and sour flavor'),
('Chicken Platter - Sweet & Spicy', 'Chicken', 249.00, true, 'Chicken platter with sweet and spicy flavor'),
('Chicken Platter - Soy Garlic', 'Chicken', 249.00, true, 'Chicken platter with soy garlic flavor'),
('Chicken Platter - Teriyaki', 'Chicken', 249.00, true, 'Chicken platter with teriyaki flavor');

-- Chicken Burger
INSERT INTO menu_items (name, category, price, available, description) VALUES
('Chicken Burger - Barbecue', 'Burgers', 99.00, true, 'Chicken burger with barbecue flavor'),
('Chicken Burger - Buffalo Wings', 'Burgers', 99.00, true, 'Chicken burger with buffalo wings flavor'),
('Chicken Burger - Honey Butter', 'Burgers', 99.00, true, 'Chicken burger with honey butter flavor'),
('Chicken Burger - Sweet & Sour', 'Burgers', 99.00, true, 'Chicken burger with sweet and sour flavor'),
('Chicken Burger - Sweet & Spicy', 'Burgers', 99.00, true, 'Chicken burger with sweet and spicy flavor'),
('Chicken Burger - Soy Garlic', 'Burgers', 99.00, true, 'Chicken burger with soy garlic flavor'),
('Chicken Burger - Teriyaki', 'Burgers', 99.00, true, 'Chicken burger with teriyaki flavor'),
('Chicken Burger - Original', 'Burgers', 99.00, true, 'Original chicken burger');

-- ============================================================================
-- RICE MEALS (SILOG)
-- ============================================================================

INSERT INTO menu_items (name, category, price, available, description) VALUES
('Bangsilog', 'Rice Meals', 109.00, true, 'Bangus, sinangag, itlog'),
('Cornsilog', 'Rice Meals', 109.00, true, 'Corned beef, sinangag, itlog'),
('Tocilog', 'Rice Meals', 109.00, true, 'Tocino, sinangag, itlog'),
('Chicsilog', 'Rice Meals', 109.00, true, 'Chicken, sinangag, itlog'),
('Tapsilog', 'Rice Meals', 109.00, true, 'Tapa, sinangag, itlog'),
('Hotsilog', 'Rice Meals', 109.00, true, 'Hotdog, sinangag, itlog'),
('Siomaisilog', 'Rice Meals', 109.00, true, 'Siomai, sinangag, itlog'),
('Luncheonsilog', 'Rice Meals', 109.00, true, 'Luncheon meat, sinangag, itlog');

-- ============================================================================
-- SANDWICHES & OTHERS
-- ============================================================================

INSERT INTO menu_items (name, category, price, available, description) VALUES
('Waffles', 'Breakfast', 99.00, true, 'Fresh waffles'),
('Clubhouse Sandwich', 'Sandwiches', 99.00, true, 'Classic clubhouse sandwich'),
('Footlong', 'Sandwiches', 89.00, true, 'Footlong hotdog sandwich'),
('Spam Musubi', 'Japanese', 99.00, true, 'Spam musubi rice'),
('Sushi', 'Japanese', 99.00, true, 'Fresh sushi'),
('Caesar Salad', 'Salads', 99.00, true, 'Fresh caesar salad');

-- ============================================================================
-- MILKTEA SERIES
-- ============================================================================

-- 16oz Milktea
INSERT INTO menu_items (name, category, price, available, description) VALUES
('Milktea - Brown Sugar (16oz)', 'Milktea', 89.00, true, 'Brown sugar milktea 16oz'),
('Milktea - Wintermelon (16oz)', 'Milktea', 89.00, true, 'Wintermelon milktea 16oz'),
('Milktea - Okinawa (16oz)', 'Milktea', 89.00, true, 'Okinawa milktea 16oz'),
('Milktea - Hokkaido (16oz)', 'Milktea', 89.00, true, 'Hokkaido milktea 16oz'),
('Milktea - Ube Taro (16oz)', 'Milktea', 89.00, true, 'Ube taro milktea 16oz'),
('Milktea - Red Velvet (16oz)', 'Milktea', 89.00, true, 'Red velvet milktea 16oz'),
('Milktea - Strawberry (16oz)', 'Milktea', 89.00, true, 'Strawberry milktea 16oz'),
('Milktea - Matcha (16oz)', 'Milktea', 89.00, true, 'Matcha milktea 16oz'),
('Milktea - Cookies & Cream (16oz)', 'Milktea', 99.00, true, 'Cookies and cream milktea 16oz'),
('Milktea - Dark Chocolate (16oz)', 'Milktea', 99.00, true, 'Dark chocolate milktea 16oz'),
('Milktea - Strawberry Matcha (16oz)', 'Milktea', 99.00, true, 'Strawberry matcha milktea 16oz'),
('Milktea - Blueberry Matcha (16oz)', 'Milktea', 99.00, true, 'Blueberry matcha milktea 16oz'),
('Milktea - Oreo Matcha (16oz)', 'Milktea', 99.00, true, 'Oreo matcha milktea 16oz'),
('Milktea - Mocha (16oz)', 'Milktea', 99.00, true, 'Mocha milktea 16oz'),
('Milktea - Caramel Macchiato (16oz)', 'Milktea', 99.00, true, 'Caramel macchiato milktea 16oz'),
('Milktea - Brown Sugar Coffee (16oz)', 'Milktea', 99.00, true, 'Brown sugar coffee milktea 16oz');

-- 22oz Milktea
INSERT INTO menu_items (name, category, price, available, description) VALUES
('Milktea - Brown Sugar (22oz)', 'Milktea', 99.00, true, 'Brown sugar milktea 22oz'),
('Milktea - Wintermelon (22oz)', 'Milktea', 99.00, true, 'Wintermelon milktea 22oz'),
('Milktea - Okinawa (22oz)', 'Milktea', 99.00, true, 'Okinawa milktea 22oz'),
('Milktea - Hokkaido (22oz)', 'Milktea', 99.00, true, 'Hokkaido milktea 22oz'),
('Milktea - Ube Taro (22oz)', 'Milktea', 99.00, true, 'Ube taro milktea 22oz'),
('Milktea - Red Velvet (22oz)', 'Milktea', 99.00, true, 'Red velvet milktea 22oz'),
('Milktea - Strawberry (22oz)', 'Milktea', 99.00, true, 'Strawberry milktea 22oz'),
('Milktea - Matcha (22oz)', 'Milktea', 99.00, true, 'Matcha milktea 22oz'),
('Milktea - Cookies & Cream (22oz)', 'Milktea', 114.00, true, 'Cookies and cream milktea 22oz'),
('Milktea - Dark Chocolate (22oz)', 'Milktea', 114.00, true, 'Dark chocolate milktea 22oz'),
('Milktea - Strawberry Matcha (22oz)', 'Milktea', 114.00, true, 'Strawberry matcha milktea 22oz'),
('Milktea - Blueberry Matcha (22oz)', 'Milktea', 114.00, true, 'Blueberry matcha milktea 22oz'),
('Milktea - Oreo Matcha (22oz)', 'Milktea', 114.00, true, 'Oreo matcha milktea 22oz'),
('Milktea - Mocha (22oz)', 'Milktea', 114.00, true, 'Mocha milktea 22oz'),
('Milktea - Caramel Macchiato (22oz)', 'Milktea', 114.00, true, 'Caramel macchiato milktea 22oz'),
('Milktea - Brown Sugar Coffee (22oz)', 'Milktea', 114.00, true, 'Brown sugar coffee milktea 22oz');

-- ============================================================================
-- HOT/ICED DRINKS
-- ============================================================================

-- 12oz Hot/Iced Drinks
INSERT INTO menu_items (name, category, price, available, description) VALUES
('Americano (12oz)', 'Coffee', 69.00, true, 'Hot or iced americano 12oz'),
('Spanish Latte (12oz)', 'Coffee', 89.00, true, 'Hot or iced Spanish latte 12oz'),
('Cafe Latte (12oz)', 'Coffee', 89.00, true, 'Hot or iced cafe latte 12oz'),
('Caramel Macchiato (12oz)', 'Coffee', 94.00, true, 'Hot or iced caramel macchiato 12oz'),
('Cafe Mocha (12oz)', 'Coffee', 94.00, true, 'Hot or iced cafe mocha 12oz'),
('Mocha Latte (12oz)', 'Coffee', 94.00, true, 'Hot or iced mocha latte 12oz'),
('Caramel Mocha (12oz)', 'Coffee', 94.00, true, 'Hot or iced caramel mocha 12oz'),
('Matcha Espresso (12oz)', 'Coffee', 89.00, true, 'Hot or iced matcha espresso 12oz'),
('White Choco Matcha Latte (12oz)', 'Coffee', 94.00, true, 'Hot or iced white choco matcha latte 12oz'),
('Dark Chocolate (12oz)', 'Coffee', 94.00, true, 'Hot or iced dark chocolate 12oz'),
('Matcha Latte (12oz)', 'Coffee', 94.00, true, 'Hot or iced matcha latte 12oz'),
('Strawberry Latte (12oz)', 'Coffee', 89.00, true, 'Hot or iced strawberry latte 12oz'),
('Blueberry Latte (12oz)', 'Coffee', 89.00, true, 'Hot or iced blueberry latte 12oz'),
('Ube Taro Latte (12oz)', 'Coffee', 89.00, true, 'Hot or iced ube taro latte 12oz'),
('Biscoff Latte (12oz)', 'Coffee', 89.00, true, 'Hot or iced biscoff latte 12oz'),
('Biscoff Matcha Latte (12oz)', 'Coffee', 94.00, true, 'Hot or iced biscoff matcha latte 12oz'),
('Biscoff Cafe Latte (12oz)', 'Coffee', 94.00, true, 'Hot or iced biscoff cafe latte 12oz'),
('Passion Fruit Latte (12oz)', 'Coffee', 94.00, true, 'Hot or iced passion fruit latte 12oz'),
('Oreo Latte (12oz)', 'Coffee', 94.00, true, 'Hot or iced oreo latte 12oz');

-- 16oz Hot/Iced Drinks
INSERT INTO menu_items (name, category, price, available, description) VALUES
('Americano (16oz)', 'Coffee', 69.00, true, 'Hot or iced americano 16oz'),
('Spanish Latte (16oz)', 'Coffee', 89.00, true, 'Hot or iced Spanish latte 16oz'),
('Cafe Latte (16oz)', 'Coffee', 89.00, true, 'Hot or iced cafe latte 16oz'),
('Caramel Macchiato (16oz)', 'Coffee', 94.00, true, 'Hot or iced caramel macchiato 16oz'),
('Cafe Mocha (16oz)', 'Coffee', 94.00, true, 'Hot or iced cafe mocha 16oz'),
('Mocha Latte (16oz)', 'Coffee', 94.00, true, 'Hot or iced mocha latte 16oz'),
('Caramel Mocha (16oz)', 'Coffee', 94.00, true, 'Hot or iced caramel mocha 16oz'),
('Matcha Espresso (16oz)', 'Coffee', 89.00, true, 'Hot or iced matcha espresso 16oz'),
('White Choco Matcha Latte (16oz)', 'Coffee', 99.00, true, 'Hot or iced white choco matcha latte 16oz'),
('Dark Chocolate (16oz)', 'Coffee', 99.00, true, 'Hot or iced dark chocolate 16oz'),
('Matcha Latte (16oz)', 'Coffee', 94.00, true, 'Hot or iced matcha latte 16oz'),
('Strawberry Latte (16oz)', 'Coffee', 89.00, true, 'Hot or iced strawberry latte 16oz'),
('Blueberry Latte (16oz)', 'Coffee', 89.00, true, 'Hot or iced blueberry latte 16oz'),
('Ube Taro Latte (16oz)', 'Coffee', 89.00, true, 'Hot or iced ube taro latte 16oz'),
('Biscoff Latte (16oz)', 'Coffee', 94.00, true, 'Hot or iced biscoff latte 16oz'),
('Biscoff Matcha Latte (16oz)', 'Coffee', 99.00, true, 'Hot or iced biscoff matcha latte 16oz'),
('Biscoff Cafe Latte (16oz)', 'Coffee', 99.00, true, 'Hot or iced biscoff cafe latte 16oz'),
('Passion Fruit Latte (16oz)', 'Coffee', 99.00, true, 'Hot or iced passion fruit latte 16oz'),
('Oreo Latte (16oz)', 'Coffee', 99.00, true, 'Hot or iced oreo latte 16oz');

-- 22oz Hot/Iced Drinks
INSERT INTO menu_items (name, category, price, available, description) VALUES
('Americano (22oz)', 'Coffee', 79.00, true, 'Hot or iced americano 22oz'),
('Spanish Latte (22oz)', 'Coffee', 99.00, true, 'Hot or iced Spanish latte 22oz'),
('Cafe Latte (22oz)', 'Coffee', 99.00, true, 'Hot or iced cafe latte 22oz'),
('Caramel Macchiato (22oz)', 'Coffee', 109.00, true, 'Hot or iced caramel macchiato 22oz'),
('Cafe Mocha (22oz)', 'Coffee', 109.00, true, 'Hot or iced cafe mocha 22oz'),
('Mocha Latte (22oz)', 'Coffee', 109.00, true, 'Hot or iced mocha latte 22oz'),
('Caramel Mocha (22oz)', 'Coffee', 109.00, true, 'Hot or iced caramel mocha 22oz'),
('Matcha Espresso (22oz)', 'Coffee', 99.00, true, 'Hot or iced matcha espresso 22oz'),
('White Choco Matcha Latte (22oz)', 'Coffee', 114.00, true, 'Hot or iced white choco matcha latte 22oz'),
('Dark Chocolate (22oz)', 'Coffee', 114.00, true, 'Hot or iced dark chocolate 22oz'),
('Matcha Latte (22oz)', 'Coffee', 109.00, true, 'Hot or iced matcha latte 22oz'),
('Strawberry Latte (22oz)', 'Coffee', 99.00, true, 'Hot or iced strawberry latte 22oz'),
('Blueberry Latte (22oz)', 'Coffee', 99.00, true, 'Hot or iced blueberry latte 22oz'),
('Ube Taro Latte (22oz)', 'Coffee', 99.00, true, 'Hot or iced ube taro latte 22oz'),
('Biscoff Latte (22oz)', 'Coffee', 109.00, true, 'Hot or iced biscoff latte 22oz'),
('Biscoff Matcha Latte (22oz)', 'Coffee', 114.00, true, 'Hot or iced biscoff matcha latte 22oz'),
('Biscoff Cafe Latte (22oz)', 'Coffee', 114.00, true, 'Hot or iced biscoff cafe latte 22oz'),
('Passion Fruit Latte (22oz)', 'Coffee', 114.00, true, 'Hot or iced passion fruit latte 22oz'),
('Oreo Latte (22oz)', 'Coffee', 114.00, true, 'Hot or iced oreo latte 22oz');

-- ============================================================================
-- FRUIT SODA SERIES
-- ============================================================================

INSERT INTO menu_items (name, category, price, available, description) VALUES
('Fruit Soda - Strawberry (16oz)', 'Soda', 49.00, true, 'Strawberry fruit soda 16oz'),
('Fruit Soda - Green Apple (16oz)', 'Soda', 49.00, true, 'Green apple fruit soda 16oz'),
('Fruit Soda - Blue Lemonade (16oz)', 'Soda', 49.00, true, 'Blue lemonade fruit soda 16oz'),
('Fruit Soda - Lychee (16oz)', 'Soda', 49.00, true, 'Lychee fruit soda 16oz'),
('Fruit Soda - Blueberry (16oz)', 'Soda', 59.00, true, 'Blueberry fruit soda 16oz'),
('Fruit Soda - Passion Fruit (16oz)', 'Soda', 69.00, true, 'Passion fruit soda 16oz'),
('Fruit Soda - Strawberry (22oz)', 'Soda', 59.00, true, 'Strawberry fruit soda 22oz'),
('Fruit Soda - Green Apple (22oz)', 'Soda', 59.00, true, 'Green apple fruit soda 22oz'),
('Fruit Soda - Blue Lemonade (22oz)', 'Soda', 59.00, true, 'Blue lemonade fruit soda 22oz'),
('Fruit Soda - Lychee (22oz)', 'Soda', 59.00, true, 'Lychee fruit soda 22oz'),
('Fruit Soda - Blueberry (22oz)', 'Soda', 69.00, true, 'Blueberry fruit soda 22oz'),
('Fruit Soda - Passion Fruit (22oz)', 'Soda', 79.00, true, 'Passion fruit soda 22oz');

-- ============================================================================
-- LEMONADE SERIES
-- ============================================================================

INSERT INTO menu_items (name, category, price, available, description) VALUES
('Lemonade Juice (16oz)', 'Lemonade', 49.00, true, 'Fresh lemonade 16oz'),
('Lemon Strawberry Juice (16oz)', 'Lemonade', 59.00, true, 'Lemon strawberry juice 16oz'),
('Lemon Blueberry Juice (16oz)', 'Lemonade', 59.00, true, 'Lemon blueberry juice 16oz'),
('Lemon Passion Fruit Juice (16oz)', 'Lemonade', 79.00, true, 'Lemon passion fruit juice 16oz'),
('Lemon Yogurt Slush (16oz)', 'Lemonade', 89.00, true, 'Lemon yogurt slush 16oz'),
('Lemonade Juice (22oz)', 'Lemonade', 59.00, true, 'Fresh lemonade 22oz'),
('Lemon Strawberry Juice (22oz)', 'Lemonade', 69.00, true, 'Lemon strawberry juice 22oz'),
('Lemon Blueberry Juice (22oz)', 'Lemonade', 69.00, true, 'Lemon blueberry juice 22oz'),
('Lemon Passion Fruit Juice (22oz)', 'Lemonade', 89.00, true, 'Lemon passion fruit juice 22oz'),
('Lemon Yogurt Slush (22oz)', 'Lemonade', 99.00, true, 'Lemon yogurt slush 22oz');

-- ============================================================================
-- FRAPPE SERIES
-- ============================================================================

INSERT INTO menu_items (name, category, price, available, description) VALUES
('Frappe - Caramel Macchiato (16oz)', 'Frappe', 99.00, true, 'Caramel macchiato frappe 16oz'),
('Frappe - Cookies & Cream (16oz)', 'Frappe', 99.00, true, 'Cookies and cream frappe 16oz'),
('Frappe - Matcha (16oz)', 'Frappe', 99.00, true, 'Matcha frappe 16oz'),
('Frappe - Strawberry (16oz)', 'Frappe', 99.00, true, 'Strawberry frappe 16oz'),
('Frappe - Red Velvet (16oz)', 'Frappe', 99.00, true, 'Red velvet frappe 16oz'),
('Frappe - Ube Taro (16oz)', 'Frappe', 99.00, true, 'Ube taro frappe 16oz'),
('Frappe - Dark Chocolate (16oz)', 'Frappe', 109.00, true, 'Dark chocolate frappe 16oz'),
('Frappe - Mocha (16oz)', 'Frappe', 109.00, true, 'Mocha frappe 16oz'),
('Frappe - Mocha Latte (16oz)', 'Frappe', 109.00, true, 'Mocha latte frappe 16oz'),
('Frappe - Lotus Biscoff (16oz)', 'Frappe', 114.00, true, 'Lotus biscoff frappe 16oz'),
('Frappe - Mango Graham (16oz)', 'Frappe', 114.00, true, 'Mango graham frappe 16oz'),
('Frappe - Caramel Macchiato (22oz)', 'Frappe', 114.00, true, 'Caramel macchiato frappe 22oz'),
('Frappe - Cookies & Cream (22oz)', 'Frappe', 114.00, true, 'Cookies and cream frappe 22oz'),
('Frappe - Matcha (22oz)', 'Frappe', 114.00, true, 'Matcha frappe 22oz'),
('Frappe - Strawberry (22oz)', 'Frappe', 114.00, true, 'Strawberry frappe 22oz'),
('Frappe - Red Velvet (22oz)', 'Frappe', 114.00, true, 'Red velvet frappe 22oz'),
('Frappe - Ube Taro (22oz)', 'Frappe', 114.00, true, 'Ube taro frappe 22oz'),
('Frappe - Dark Chocolate (22oz)', 'Frappe', 119.00, true, 'Dark chocolate frappe 22oz'),
('Frappe - Mocha (22oz)', 'Frappe', 119.00, true, 'Mocha frappe 22oz'),
('Frappe - Mocha Latte (22oz)', 'Frappe', 119.00, true, 'Mocha latte frappe 22oz'),
('Frappe - Lotus Biscoff (22oz)', 'Frappe', 124.00, true, 'Lotus biscoff frappe 22oz'),
('Frappe - Mango Graham (22oz)', 'Frappe', 124.00, true, 'Mango graham frappe 22oz');
