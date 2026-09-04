-- ============================================================
-- V7: Сделать ценовые поля orders nullable (заглушка OrderController)
-- Заказы пока сохраняют только состояние расчёта (calculation_state);
-- ценовые поля не заполняются фиктивными нулями.
-- ============================================================

ALTER TABLE orders ALTER COLUMN material_type DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN sheet_price DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN quantity DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN base_price DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN discount DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN final_price_per_item DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN total_price DROP NOT NULL;
