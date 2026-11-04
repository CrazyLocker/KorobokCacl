-- V20: клиенты и заказы вместо свободного текста client_name.
--
-- Расчёт принадлежит заказу, заказ — клиенту. Клиент теперь справочник:
-- имя, ИНН, контакт. Сумма и статус заказа выводятся из расчётов.
--
-- Старые таблицы orders / order_parts / order_operations пришли из первой
-- схемы (V1) и остались без кода: сущностей и контроллеров под ними нет.
-- Не удаляем, а уводим в «legacy_» — в orders лежит одна историческая
-- запись, которую жалко терять.

ALTER TABLE order_parts RENAME TO legacy_order_parts;
ALTER TABLE order_operations RENAME TO legacy_order_operations;
ALTER TABLE orders RENAME TO legacy_orders;

CREATE TABLE customers (
    id         UUID PRIMARY KEY     DEFAULT gen_random_uuid(),
    name       VARCHAR NOT NULL,
    inn        VARCHAR,
    contact    VARCHAR,
    is_active  BOOLEAN NOT NULL     DEFAULT true,
    created_at TIMESTAMP NOT NULL   DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL   DEFAULT NOW()
);

-- Один и тот же клиент не должен появляться дважды из-за регистра.
CREATE UNIQUE INDEX uk_customers_name_lower ON customers (LOWER(name));

CREATE TABLE calculation_orders (
    id          UUID PRIMARY KEY   DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL      REFERENCES customers (id) ON DELETE RESTRICT,
    number      VARCHAR NOT NULL,
    order_date  DATE NOT NULL      DEFAULT CURRENT_DATE,
    status      VARCHAR NOT NULL   DEFAULT 'draft'
        CHECK (status IN ('draft', 'ready', 'sent', 'in_work', 'closed')),
    comment     TEXT,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_calculation_orders_customer ON calculation_orders (customer_id);

-- Номер заказа уникален в пределах клиента.
CREATE UNIQUE INDEX uk_calculation_orders_customer_number
    ON calculation_orders (customer_id, LOWER(number));

ALTER TABLE calculations ADD COLUMN customer_id UUID
    REFERENCES customers (id) ON DELETE SET NULL;
ALTER TABLE calculations ADD COLUMN order_id UUID
    REFERENCES calculation_orders (id) ON DELETE SET NULL;

CREATE INDEX idx_calculations_customer ON calculations (customer_id);
CREATE INDEX idx_calculations_order ON calculations (order_id);

-- Переносим имена клиентов, уже сохранённые в расчётах. DISTINCT ON берёт
-- самое раннее написание имени при совпадении без учёта регистра.
INSERT INTO customers (name)
SELECT DISTINCT ON (LOWER(BTRIM(client_name))) BTRIM(client_name)
FROM calculations
WHERE client_name IS NOT NULL AND BTRIM(client_name) <> ''
ORDER BY LOWER(BTRIM(client_name)), created_at;

UPDATE calculations c
SET customer_id = cu.id
FROM customers cu
WHERE c.customer_id IS NULL
  AND LOWER(cu.name) = LOWER(BTRIM(c.client_name));
