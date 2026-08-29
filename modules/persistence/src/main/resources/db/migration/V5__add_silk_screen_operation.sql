-- ============================================================
-- V5: Добавить операцию "Шелкография"
-- ============================================================

-- Создаём уникальный индекс для поддержки ON CONFLICT
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE tablename = 'operations' AND indexname = 'idx_operations_name_unique'
    ) THEN
        CREATE UNIQUE INDEX idx_operations_name_unique ON operations(name);
    END IF;
END $$;

INSERT INTO operations (id, name, unit, base_price, price_type, is_active)
VALUES (gen_random_uuid(), 'Шелкография', 'шт', 0, 'fixed', true)
ON CONFLICT (name) DO NOTHING;
