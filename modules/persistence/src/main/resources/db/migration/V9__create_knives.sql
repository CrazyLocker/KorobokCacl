-- ============================================================
-- V9: Таблица сохранённых ножей
-- ============================================================

CREATE TABLE knives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    svg_content TEXT NOT NULL,
    total_length_mm DECIMAL NOT NULL,
    knife_cost DECIMAL NOT NULL,
    client_name VARCHAR NOT NULL,
    manager_name VARCHAR NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
