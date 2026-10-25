-- ============================================================
-- V11: parts table, material types, construction type
-- ============================================================

-- V1 created an unnamed CHECK constraint; PostgreSQL named it
-- materials_type_check automatically. Replace it with an explicit one
-- that also allows PVC.
ALTER TABLE materials DROP CONSTRAINT materials_type_check;

ALTER TABLE materials
    ADD CONSTRAINT materials_type_check
        CHECK (type IN ('coated', 'designer', 'pvc'));

CREATE TABLE parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    construct_id UUID NOT NULL REFERENCES constructs(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    per_sheet INT NOT NULL,
    material_id UUID NOT NULL REFERENCES materials(id),
    CONSTRAINT parts_construct_id_name_key UNIQUE (construct_id, name)
);

CREATE INDEX idx_parts_construct_id ON parts(construct_id);
CREATE INDEX idx_parts_material_id ON parts(material_id);

ALTER TABLE constructs ADD COLUMN type VARCHAR(32);
