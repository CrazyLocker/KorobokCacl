CREATE TABLE constructs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    description TEXT,
    parts JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    type VARCHAR NOT NULL CHECK (type IN ('coated', 'designer')),
    price_per_sheet DECIMAL NOT NULL,
    min_purchase_price DECIMAL,
    max_purchase_price DECIMAL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    unit VARCHAR NOT NULL,
    base_price DECIMAL NOT NULL,
    price_type VARCHAR DEFAULT 'fixed' CHECK (price_type IN ('fixed', 'per_unit')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name VARCHAR NOT NULL,
    client_inn VARCHAR,
    manager_id UUID,
    order_date TIMESTAMP DEFAULT NOW(),
    construct_id UUID REFERENCES constructs(id),
    construct_name VARCHAR NOT NULL,
    material_type VARCHAR NOT NULL CHECK (material_type IN ('coated', 'designer')),
    purchase_price DECIMAL,
    sheet_price DECIMAL NOT NULL,
    quantity INTEGER NOT NULL,
    base_price DECIMAL NOT NULL,
    discount DECIMAL NOT NULL,
    final_price_per_item DECIMAL NOT NULL,
    total_price DECIMAL NOT NULL,
    status VARCHAR DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'sent', 'in_work', 'closed')),
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE order_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    part_name VARCHAR NOT NULL,
    parts_per_sheet INTEGER NOT NULL,
    cost_per_part DECIMAL NOT NULL,
    sort_order INTEGER DEFAULT 0
);

CREATE TABLE order_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    operation_id UUID REFERENCES operations(id),
    operation_name VARCHAR NOT NULL,
    quantity INTEGER DEFAULT 1,
    cost_per_unit DECIMAL NOT NULL,
    total_cost DECIMAL NOT NULL,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL
);
