-- ============================================================
-- V6: Добавить поле calculation_state в таблицу orders
-- ============================================================

ALTER TABLE orders ADD COLUMN calculation_state JSONB;

CREATE INDEX idx_orders_calculation_state ON orders USING gin (calculation_state);
