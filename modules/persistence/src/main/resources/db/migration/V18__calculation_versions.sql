-- ============================================================
-- V18: Версионирование сохранённых расчётов.
--
-- Каждая правка сохранённого расчёта — новая строка, история не теряется.
-- Цепочка версий: root_id указывает на первую версию (у неё самой root_id = id),
-- version — номер версии внутри цепочки, начиная с 1.
--
-- root_id намеренно без NOT NULL: первичный ключ генерируется Hibernate при
-- INSERT, поэтому сервис проставляет root_id сразу после вставки, в той же
-- транзакции. Для уже существующих расчётов значение заполняет бэкфилл ниже.
-- ============================================================

ALTER TABLE calculations ADD COLUMN root_id UUID;
ALTER TABLE calculations ADD COLUMN version INTEGER;
ALTER TABLE calculations ADD COLUMN calculation_result JSONB;

-- Старые расчёты — первые версии собственных цепочек.
UPDATE calculations SET root_id = id WHERE root_id IS NULL;
UPDATE calculations SET version = 1 WHERE version IS NULL;

ALTER TABLE calculations ALTER COLUMN version SET NOT NULL;
ALTER TABLE calculations ALTER COLUMN version SET DEFAULT 1;

-- Удаление первой версии уносит всю цепочку: сервис удаляет именно root-строку.
ALTER TABLE calculations
    ADD CONSTRAINT fk_calculations_root_id FOREIGN KEY (root_id)
    REFERENCES calculations(id) ON DELETE CASCADE;

ALTER TABLE calculations
    ADD CONSTRAINT uk_calculations_root_version UNIQUE (root_id, version);

CREATE INDEX idx_calculations_root_id ON calculations(root_id);
