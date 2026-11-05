-- The old merch shop for the import, as a long-lived database looks after years
-- of init_db.py ALTERs. Every row is fictional: nobody here exists and the
-- phones lead nowhere.
--
-- Drift from a fresh create_all, on purpose:
--   'ready_for_pickup' was appended to the enum, so it sorts last
--   orders.pickup_slot_id is a plain INTEGER, so a slot id can dangle
--   orders.needs_individual_pickup and shop_configs.is_dayf_delivery_enabled are nullable
--   user_profiles.checkout_expires_at and orders.updated_at are timestamptz
-- Foreign keys of models.py left out so the import's tolerance runs:
--   orders and recipients to user_profiles, product_visibility to user_groups
SET client_encoding = 'UTF8';

CREATE TYPE orderstatus AS ENUM ('pending', 'in_process', 'completed', 'cancelled');
ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'ready_for_pickup';
CREATE TYPE deliverymethod AS ENUM ('nova_poshta', 'campus', 'dayf', 'later_campus');

CREATE TABLE user_profiles (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL UNIQUE,
  username VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  phone VARCHAR(50),
  checkout_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
);

CREATE TABLE recipients (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  is_default BOOLEAN NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
);

CREATE TABLE admin_chat_bindings (
  id SERIAL PRIMARY KEY,
  chat_id BIGINT NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  pinned_config_message_id INTEGER,
  is_active BOOLEAN NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  orders_thread_id INTEGER,
  support_thread_id INTEGER
);

CREATE TABLE shop_configs (
  id SERIAL PRIMARY KEY,
  welcome_text TEXT NOT NULL,
  support_text TEXT NOT NULL,
  currency VARCHAR(10) NOT NULL,
  mono_jar_url VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  card_number VARCHAR(20),
  is_dayf_delivery_enabled BOOLEAN DEFAULT FALSE
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  photo_file_id VARCHAR(255),
  is_active BOOLEAN NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  requires_color BOOLEAN DEFAULT FALSE NOT NULL,
  photo_black_file_id VARCHAR(255)
);

CREATE TABLE product_variants (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  size VARCHAR(20) NOT NULL,
  color VARCHAR(20),
  price NUMERIC(10, 2) NOT NULL,
  stock_quantity INTEGER,
  CONSTRAINT uq_product_variant UNIQUE (product_id, size, color)
);

CREATE TABLE user_groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
);

CREATE TABLE user_group_members (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES user_groups (id) ON DELETE CASCADE,
  telegram_id BIGINT,
  username VARCHAR(255),
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
);

CREATE TABLE product_visibility (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL,
  CONSTRAINT uq_product_visibility UNIQUE (product_id, group_id)
);

CREATE TABLE cart_items (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL,
  product_id INTEGER NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  size VARCHAR(20) NOT NULL,
  color VARCHAR(20),
  price NUMERIC(10, 2) NOT NULL,
  quantity INTEGER NOT NULL
);

CREATE TABLE pickup_slots (
  id SERIAL PRIMARY KEY,
  date TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  start_time VARCHAR(10) NOT NULL,
  end_time VARCHAR(10) NOT NULL,
  is_active BOOLEAN NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL,
  status orderstatus NOT NULL,
  delivery_method deliverymethod,
  address TEXT NOT NULL,
  phone VARCHAR(50) NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  receipt_photo_id VARCHAR(255),
  admin_message_id INTEGER,
  processed_by_admin VARCHAR(255),
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  recipient_name VARCHAR(255),
  pickup_slot_id INTEGER,
  needs_individual_pickup BOOLEAN DEFAULT FALSE
);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products (id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  size VARCHAR(20) NOT NULL,
  unit_price NUMERIC(10, 2) NOT NULL,
  quantity INTEGER NOT NULL,
  color VARCHAR(20)
);

INSERT INTO user_profiles (id, telegram_id, username, first_name, last_name, phone, checkout_expires_at, created_at) VALUES
  (1, 1001, 'Taras_Vyhadanyi', 'Тарас', 'Вигаданий', '+380500000001', NULL, '2026-01-10 09:00:00'),
  (2, 1002, 'olena_test', 'Олена', 'Тестова', NULL, '2026-03-01 12:00:00+02', '2026-01-11 09:00:00.123456'),
  (3, 1003, NULL, 'Петро', NULL, NULL, NULL, '2026-02-01 09:00:00'),
  (4, 1004, '@Sofia_Demo', 'Софія', 'Демо', NULL, NULL, '2026-02-02 09:00:00'),
  (5, 7000001005, 'ivan_nikto', 'Іван', 'Ніхто', NULL, NULL, '2026-02-03 09:00:00');

-- Telegram id 1007 has no profile. So does 1006 on an order below.
INSERT INTO recipients (id, telegram_id, full_name, phone, is_default, created_at) VALUES
  (1, 1001, 'Тарас Вигаданий', '+380500000001', TRUE, '2026-01-10 09:05:00'),
  (2, 1001, 'Тарас Вигаданий', '050 000 00 01', FALSE, '2026-01-12 09:05:00'),
  (3, 1001, 'Ганна Вигадана', '(050) 000-00-02', FALSE, '2026-01-13 09:05:00'),
  (4, 1002, 'Олена Тестова', '0500000003', TRUE, '2026-01-14 09:05:00'),
  (5, 1002, 'Олена Друга', '0500000004', TRUE, '2026-01-15 09:05:00'),
  (6, 1003, 'Петро', 'не памʼятаю', FALSE, '2026-02-01 09:05:00'),
  (7, 1007, 'Марко Без Профілю', '+380500000007', FALSE, '2026-02-04 09:05:00');

-- Two active rows, the old code's scalar_one_or_none would fail on them. Thread 0 is General.
INSERT INTO admin_chat_bindings (id, chat_id, title, pinned_config_message_id, is_active, created_at, orders_thread_id, support_thread_id) VALUES
  (1, -1001000000001, 'Старий чат', 5, FALSE, '2026-01-01 09:00:00', NULL, NULL),
  (2, -1001000000002, 'Адмінка', NULL, TRUE, '2026-01-02 09:00:00', 11, 12),
  (3, -1001000000003, 'Адмінка нова', NULL, TRUE, '2026-01-03 09:00:00', 0, 77);

INSERT INTO shop_configs (id, welcome_text, support_text, currency, mono_jar_url, updated_at, card_number, is_dayf_delivery_enabled) VALUES
  (1, 'Вітаємо у тестовому магазині мерчу! 🖤', 'Це поле не переноситься', 'UAH', 'https://send.monobank.ua/jar/TESTJAR', '2026-01-04 09:00:00', '0000000000000000', NULL);

-- Ids 10 to 14 were deleted, and the sequence stands at 16.
INSERT INTO products (id, title, description, photo_file_id, is_active, created_at, updated_at, requires_color, photo_black_file_id) VALUES
  (1, 'Футболка ФІОТ', 'Біла або чорна, бавовна.', 'f-tee-white', TRUE, '2026-01-20 10:00:00', '2026-01-21 10:00:00', TRUE, 'f-tee-black'),
  (2, 'Худі ФІОТ', 'Лише чорне.', 'f-hoodie', TRUE, '2026-01-20 11:00:00', '2026-01-21 11:00:00', TRUE, NULL),
  (3, 'Стікерпак', 'Без розмірів.', 'f-sticker', TRUE, '2026-01-20 12:00:00', '2026-01-21 12:00:00', FALSE, NULL),
  (4, 'Шопер', 'Два однакові варіанти без кольору.', 'f-bag', TRUE, '2026-01-20 13:00:00', '2026-01-21 13:00:00', FALSE, NULL),
  (5, 'Кепка', 'Один справжній розмір.', 'f-cap', TRUE, '2026-01-20 14:00:00', '2026-01-21 14:00:00', FALSE, 'f-cap-black'),
  (6, 'Чашка', 'Синя, чорного фото нікуди покласти.', 'f-cup', TRUE, '2026-01-20 15:00:00', '2026-01-21 15:00:00', TRUE, 'f-cup-black'),
  (7, 'Старий значок', 'В архіві, без фото.', NULL, FALSE, '2026-01-20 16:00:00', '2026-01-21 16:00:00', FALSE, NULL),
  (8, 'Брелок куратора', 'Лише для груп, без фото.', NULL, TRUE, '2026-01-20 17:00:00', '2026-01-21 17:00:00', FALSE, NULL),
  (9, 'Плакат', 'Активний, але без варіантів.', 'f-poster', TRUE, '2026-01-20 18:00:00', '2026-01-21 18:00:00', FALSE, NULL),
  (15, 'Шкарпетки', 'Кольори без розмірів.', 'f-socks-white', TRUE, '2026-01-20 19:00:00', '2026-01-21 19:00:00', TRUE, 'f-socks-black');
SELECT setval('products_id_seq', 16);

INSERT INTO product_variants (id, product_id, size, color, price, stock_quantity) VALUES
  (1, 1, 'S', 'Білий', 350.00, 5),
  (2, 1, 'M', 'Білий', 350.00, 3),
  (3, 1, 'S', 'Чорний', 350.00, 2),
  (4, 1, 'M', 'Чорний', 350.00, -2),
  (5, 2, 'M', 'Чорний', 799.50, NULL),
  (6, 2, 'L', 'Чорний', 799.50, NULL),
  (7, 3, 'ONE', NULL, 50.00, 40),
  (8, 4, 'ONE SIZE', NULL, 120.00, 7),
  (9, 4, 'ONE SIZE', NULL, 130.00, 9),
  (10, 5, 'M', NULL, 250.00, 4),
  (11, 6, '330 МЛ', 'Синій', 200.00, 6),
  (12, 7, 'ONE', NULL, 30.00, 0),
  (13, 8, 'ONE', NULL, 90.00, 12),
  (14, 15, 'УНІВЕРСАЛЬНИЙ', 'Білий', 100.00, 10),
  (15, 15, 'УНІВЕРСАЛЬНИЙ', 'Чорний', 100.00, 0),
  (16, 1, 'L', 'Білий', 350.00, NULL);

INSERT INTO user_groups (id, name, created_at) VALUES
  (1, 'Куратори', '2026-01-05 09:00:00'),
  (2, 'Рада студентів', '2026-01-05 10:00:00'),
  (5, 'Порожня група', '2026-01-05 11:00:00');

INSERT INTO user_group_members (id, group_id, telegram_id, username, created_at) VALUES
  (1, 1, NULL, '@Curator_One', '2026-01-06 09:00:00'),
  (2, 1, NULL, 'curator_one', '2026-01-06 09:01:00'),
  (3, 1, 1001, NULL, '2026-01-06 09:02:00'),
  (4, 1, 1001, NULL, '2026-01-06 09:03:00'),
  (5, 2, 1002, 'olena_test', '2026-01-06 09:04:00'),
  (6, 2, NULL, NULL, '2026-01-06 09:05:00'),
  (7, 2, NULL, 'Rada_Head', '2026-01-06 09:06:00');

INSERT INTO product_visibility (id, product_id, group_id) VALUES
  (1, 8, 1),
  (2, 8, 2),
  (3, 8, 99);

-- Never imported.
INSERT INTO cart_items (id, telegram_id, product_id, size, color, price, quantity) VALUES
  (1, 1005, 1, 'S', 'Білий', 350.00, 1);

INSERT INTO pickup_slots (id, date, start_time, end_time, is_active, created_at) VALUES
  (1, '2026-11-12 00:00:00', '12:00', '14:00', TRUE, '2026-10-01 09:00:00'),
  (2, '2026-11-13 00:00:00', 'banana', '15:00', TRUE, '2026-10-01 09:01:00'),
  (4, '2026-10-01 00:00:00', '10:00', '11:00', FALSE, '2026-09-20 09:00:00');

-- Ids below 41 went with /clear_orders, and the sequence stands ahead of the rows at 57.
INSERT INTO orders (id, telegram_id, status, delivery_method, address, phone, total_amount, currency, receipt_photo_id, admin_message_id, processed_by_admin, created_at, updated_at, recipient_name, pickup_slot_id, needs_individual_pickup) VALUES
  (41, 1001, 'completed', 'nova_poshta', 'Київ, відділення 1', '+380500000001', 700.00, 'UAH', 'r-41', 101, 'Оля Адмінка', '2026-09-01 10:00:00', '2026-09-02 10:00:00+03', 'Тарас Вигаданий', NULL, FALSE),
  (42, 1002, 'cancelled', 'campus', 'Самовивіз', '+380500000003', 350.00, 'UAH', 'r-42', 102, 'Оля Адмінка', '2026-09-03 10:00:00', '2026-09-04 10:00:00+03', 'Олена Тестова', NULL, FALSE),
  (43, 1001, 'pending', 'nova_poshta', 'Київ, відділення 2', '+380500000001', 350.00, 'UAH', 'r-43', 103, NULL, '2026-10-20 10:00:00.654321', '2026-10-20 15:30:00+03', 'Ганна Вигадана', NULL, NULL),
  (44, 1003, 'in_process', 'later_campus', 'Корпус 18, кімната 232', '+380500000005', 999.50, 'UAH', 'r-44', 104, 'Оля Адмінка', '2026-10-21 10:00:00', '2026-10-21 11:00:00+03', 'Петро', NULL, FALSE),
  (45, 1004, 'ready_for_pickup', 'later_campus', 'Корпус 18, кімната 232', '+380500000006', 120.00, 'UAH', 'r-45', 105, 'Оля Адмінка', '2026-10-22 10:00:00', '2026-10-22 11:00:00+03', 'Софія Демо', 1, FALSE),
  (46, 1004, 'ready_for_pickup', 'later_campus', 'Корпус 18, кімната 232', '+380500000006', 500.00, 'UAH', 'r-46', 106, 'Оля Адмінка', '2026-10-23 10:00:00', '2026-10-23 11:00:00+03', 'Софія Демо', 9999, TRUE),
  (47, 1006, 'pending', 'dayf', 'День факультету', '+380500000008', 100.00, 'UAH', 'r-47', NULL, NULL, '2026-10-24 10:00:00', '2026-10-24 11:00:00+03', 'Без Профілю', NULL, FALSE),
  (48, 1002, 'in_process', NULL, 'Старе замовлення', '+380500000003', 750.00, 'UAH', NULL, 108, 'Іра Адмінка', '2026-04-01 10:00:00', '2026-04-02 10:00:00+03', NULL, NULL, FALSE),
  (49, 1003, 'completed', 'campus', 'Самовивіз', '+380500000005', 90.00, 'UAH', 'r-49', 109, 'Іра Адмінка', '2026-04-03 10:00:00', '2026-04-04 10:00:00+03', 'Петро', NULL, FALSE);
SELECT setval('orders_id_seq', 57);

INSERT INTO order_items (id, order_id, product_id, title, size, unit_price, quantity, color) VALUES
  (1, 41, 1, 'Футболка ФІОТ', 'S', 350.00, 2, 'Білий'),
  (2, 42, 1, 'Футболка ФІОТ', 'M', 350.00, 1, 'Білий'),
  (3, 43, 1, 'Футболка ФІОТ', 'M', 350.00, 1, 'Чорний'),
  (4, 44, 2, 'Худі ФІОТ', 'M', 799.50, 1, 'Чорний'),
  (5, 44, 3, 'Стікерпак', 'ONE', 50.00, 4, NULL),
  (6, 45, 4, 'Шопер', 'ONE SIZE', 120.00, 1, NULL),
  (7, 46, 5, 'Кепка', 'M', 250.00, 2, NULL),
  (8, 47, 15, 'Шкарпетки', 'УНІВЕРСАЛЬНИЙ', 100.00, 1, 'Чорний'),
  (9, 48, NULL, 'Видалений товар', 'XL', 400.00, 1, NULL),
  (10, 48, 1, 'Футболка ФІОТ', 'XXL', 350.00, 1, 'Білий'),
  (11, 49, 7, 'Старий значок', 'ONE', 30.00, 3, NULL);
