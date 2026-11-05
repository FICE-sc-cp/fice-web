-- The stale database merchFICE/.env points at, in shape only: an old copy with
-- products and orders and none of the later tables. The import must refuse it.
-- Fictional rows.
SET client_encoding = 'UTF8';

CREATE TYPE orderstatus AS ENUM ('pending', 'in_process', 'completed', 'cancelled');
CREATE TYPE deliverymethod AS ENUM ('nova_poshta', 'campus', 'dayf');

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  photo_file_id VARCHAR(255),
  is_active BOOLEAN NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
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
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL
);

INSERT INTO products (id, title, description, photo_file_id, is_active, created_at, updated_at) VALUES
  (1, 'Футболка', 'Єдиний товар.', 'f-stale', TRUE, '2026-04-01 10:00:00', '2026-04-01 10:00:00');

INSERT INTO orders (id, telegram_id, status, delivery_method, address, phone, total_amount, currency, receipt_photo_id, admin_message_id, processed_by_admin, created_at, updated_at) VALUES
  (1, 1001, 'completed', 'campus', 'Самовивіз', '+380500000001', 300.00, 'UAH', 'r-1', 1, 'Оля Адмінка', '2026-04-02 10:00:00', '2026-04-02 11:00:00'),
  (2, 1002, 'pending', 'nova_poshta', 'Київ, відділення 1', '+380500000002', 300.00, 'UAH', 'r-2', 2, NULL, '2026-04-03 10:00:00', '2026-04-03 10:00:00');
