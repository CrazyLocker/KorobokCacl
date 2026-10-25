-- ============================================================
-- V12: seed parts and new constructions
-- ============================================================

-- 1. PVC material
INSERT INTO materials (id, name, type, price_per_sheet, is_active, created_at, updated_at)
VALUES (gen_random_uuid(), 'ПВХ', 'pvc', 60.00, true, now(), now());

-- 2. Move non-zero parts from the legacy JSONB document into the parts table.
--    All migrated parts use coated cardboard (35 rubles per sheet).
INSERT INTO parts (construct_id, name, per_sheet, material_id)
SELECT c.id,
       p ->> 'name',
       COALESCE((p ->> 'perSheet')::int, 0),
       (SELECT id
          FROM materials
         WHERE type = 'coated'
           AND price_per_sheet = 35.00
         ORDER BY name
         LIMIT 1)
FROM constructs c
CROSS JOIN LATERAL jsonb_array_elements(c.parts -> 'parts') AS p
WHERE COALESCE((p ->> 'perSheet')::int, 0) > 0;

-- 3. Classify the ten constructions created in V3.
UPDATE constructs
SET type = CASE
               WHEN name LIKE 'Паллена%' THEN 'PALLENA'
               WHEN name LIKE 'Этне%' THEN 'ETNE'
               WHEN name LIKE 'Элара%' THEN 'ELARA'
               WHEN name LIKE 'Атлас%' THEN 'ATLAS'
               ELSE 'CUSTOM'
           END;

-- 4. New constructions. The legacy parts column is still NOT NULL here,
--    so an empty document is written; V13 drops the column afterwards.
INSERT INTO constructs (id, name, description, parts, type, is_active, created_at, updated_at)
VALUES
    (gen_random_uuid(), 'Нереида', 'Конструкция Нереида', '{"parts":[]}'::jsonb, 'NEREIDA', true, now(), now()),
    (gen_random_uuid(), 'Эгеон', 'Конструкция Эгеон', '{"parts":[]}'::jsonb, 'EGEON', true, now(), now()),
    (gen_random_uuid(), 'Гималия', 'Конструкция Гималия', '{"parts":[]}'::jsonb, 'HIMALAYA', true, now(), now()),
    (gen_random_uuid(), 'Этне 4', 'Конструкция Этне 4', '{"parts":[]}'::jsonb, 'ETNE', true, now(), now()),
    (gen_random_uuid(), 'Этне 10', 'Конструкция Этне 10', '{"parts":[]}'::jsonb, 'ETNE', true, now(), now());

-- 5. Нереида — copy of Элара 4, every part made of designer cardboard 200.
INSERT INTO parts (construct_id, name, per_sheet, material_id)
SELECT target.id,
       source.name,
       source.per_sheet,
       (SELECT id
          FROM materials
         WHERE type = 'designer'
           AND price_per_sheet = 200.00
         ORDER BY name
         LIMIT 1)
FROM constructs target
JOIN constructs donor ON donor.name = 'Элара 4'
JOIN parts source ON source.construct_id = donor.id
WHERE target.name = 'Нереида';

-- 6. Эгеон — copy of Элара 4; lid is PVC, everything else is coated cardboard.
INSERT INTO parts (construct_id, name, per_sheet, material_id)
SELECT target.id,
       source.name,
       source.per_sheet,
       CASE
           WHEN source.name = 'Крышка' THEN
               (SELECT id FROM materials WHERE type = 'pvc' ORDER BY name LIMIT 1)
           ELSE
               (SELECT id FROM materials
                 WHERE type = 'coated' AND price_per_sheet = 35.00
                 ORDER BY name LIMIT 1)
           END
FROM constructs target
JOIN constructs donor ON donor.name = 'Элара 4'
JOIN parts source ON source.construct_id = donor.id
WHERE target.name = 'Эгеон';

-- 7. Гималия — copy of Элара 4 (all coated cardboard), plus a PVC window.
INSERT INTO parts (construct_id, name, per_sheet, material_id)
SELECT target.id,
       source.name,
       source.per_sheet,
       (SELECT id
          FROM materials
         WHERE type = 'coated'
           AND price_per_sheet = 35.00
         ORDER BY name
         LIMIT 1)
FROM constructs target
JOIN constructs donor ON donor.name = 'Элара 4'
JOIN parts source ON source.construct_id = donor.id
WHERE target.name = 'Гималия';

INSERT INTO parts (construct_id, name, per_sheet, material_id)
SELECT target.id,
       'Окно',
       lid.per_sheet,
       (SELECT id FROM materials WHERE type = 'pvc' ORDER BY name LIMIT 1)
FROM constructs target
JOIN constructs donor ON donor.name = 'Элара 4'
JOIN parts lid ON lid.construct_id = donor.id AND lid.name = 'Крышка'
WHERE target.name = 'Гималия';

-- 8. Этне 4 and Этне 10 — copies of Этне 2 (шубер), all coated cardboard.
INSERT INTO parts (construct_id, name, per_sheet, material_id)
SELECT target.id,
       source.name,
       source.per_sheet,
       (SELECT id
          FROM materials
         WHERE type = 'coated'
           AND price_per_sheet = 35.00
         ORDER BY name
         LIMIT 1)
FROM constructs target
JOIN constructs donor ON donor.name = 'Этне 2 (шубер)'
JOIN parts source ON source.construct_id = donor.id
WHERE target.name IN ('Этне 4', 'Этне 10');
