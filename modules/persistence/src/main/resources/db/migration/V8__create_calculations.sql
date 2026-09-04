-- ============================================================
-- V8: Таблица сохранённых расчётов коробки
-- Заменяет использование orders для хранения состояний расчётов.
-- ============================================================

CREATE TABLE calculations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    client_name VARCHAR NOT NULL,
    manager_name VARCHAR NOT NULL,
    status VARCHAR DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'sent', 'in_work', 'closed')),
    calculation_state JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_calculations_client_name ON calculations(client_name);
