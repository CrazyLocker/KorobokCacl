-- ============================================================
-- V14: full construction matrix (family x size)
-- ============================================================
-- perSheet values are the modal values taken from the Excel workbook;
-- nothing is parsed at runtime. All material references are resolved
-- by subquery (no hardcoded UUIDs).
--
-- constructs.name has no UNIQUE constraint, therefore every insert of a
-- construction is guarded by NOT EXISTS. Parts are inserted with
-- ON CONFLICT (construct_id, name) so the parts_construct_id_name_key
-- constraint can never be violated.
--
-- Materials used:
--   coated   35  -> 'Мелованный картон'
--   designer 200 -> 'Дизайнерский картон 200'
--   pvc          -> 'ПВХ'
-- ============================================================

-- ------------------------------------------------------------
-- 1. Remove the sizeless placeholders created in V12.
--    Their parts are removed by ON DELETE CASCADE; price lists are
--    deleted explicitly because that FK has no cascade.
-- ------------------------------------------------------------
DELETE FROM price_lists
 WHERE construct_id IN (
     SELECT id FROM constructs WHERE name IN ('Гималия', 'Эгеон', 'Нереида')
 );

DELETE FROM constructs WHERE name IN ('Гималия', 'Эгеон', 'Нереида');

-- ------------------------------------------------------------
-- 2. Этне shuber variants get the "(шубер)" suffix.
-- ------------------------------------------------------------
UPDATE constructs
   SET name = 'Этне 4 (шубер)', updated_at = now()
 WHERE name = 'Этне 4'
   AND NOT EXISTS (SELECT 1 FROM constructs other WHERE other.name = 'Этне 4 (шубер)');

UPDATE constructs
   SET name = 'Этне 10 (шубер)', updated_at = now()
 WHERE name = 'Этне 10'
   AND NOT EXISTS (SELECT 1 FROM constructs other WHERE other.name = 'Этне 10 (шубер)');

-- Этне 10 (шубер): modal composition is Дно+Разделитель 4 / Шубер 8.
DELETE FROM parts
 WHERE construct_id = (SELECT id FROM constructs WHERE name = 'Этне 10 (шубер)');

-- ------------------------------------------------------------
-- 3. Паллена 4: one merged detail + lid of designer cardboard.
--    The construction is created here when it is still absent.
-- ------------------------------------------------------------
INSERT INTO constructs (id, name, description, type, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'Паллена 4', NULL, 'PALLENA', true, now(), now()
 WHERE NOT EXISTS (SELECT 1 FROM constructs WHERE name = 'Паллена 4');

DELETE FROM parts
 WHERE construct_id = (SELECT id FROM constructs WHERE name = 'Паллена 4');

INSERT INTO parts (id, construct_id, name, per_sheet, material_id)
SELECT gen_random_uuid(), c.id, v.part_name, v.per_sheet,
       CASE WHEN v.part_name = 'Крышка'
            THEN (SELECT id FROM materials
                   WHERE type = 'designer' AND price_per_sheet = 200
                   ORDER BY name LIMIT 1)
            ELSE (SELECT id FROM materials
                   WHERE type = 'coated' AND price_per_sheet = 35
                   ORDER BY name LIMIT 1)
       END
FROM constructs c
JOIN (VALUES
    ('Паллена 4', 'Дно+Разделитель', 8),
    ('Паллена 4', 'Крышка', 12)
) AS v(construct_name, part_name, per_sheet)
  ON c.name = v.construct_name
ON CONFLICT (construct_id, name) DO UPDATE
    SET per_sheet = EXCLUDED.per_sheet,
        material_id = EXCLUDED.material_id;

-- ------------------------------------------------------------
-- 4. Элара: 9, 16, 25, 42 (Элара 4 already exists).
--    Дно / Разделитель / Крышка — coated 35.
-- ------------------------------------------------------------
INSERT INTO constructs (id, name, description, type, is_active, created_at, updated_at)
SELECT gen_random_uuid(), v.name, NULL, 'ELARA', true, now(), now()
FROM (VALUES ('Элара 9'), ('Элара 16'), ('Элара 25'), ('Элара 42')) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM constructs c WHERE c.name = v.name);

INSERT INTO parts (id, construct_id, name, per_sheet, material_id)
SELECT gen_random_uuid(), c.id, v.part_name, v.per_sheet,
       (SELECT id FROM materials
         WHERE type = 'coated' AND price_per_sheet = 35
         ORDER BY name LIMIT 1)
FROM constructs c
JOIN (VALUES
    ('Элара 9',  'Дно', 6), ('Элара 9',  'Разделитель', 15), ('Элара 9',  'Крышка', 6),
    ('Элара 16', 'Дно', 4), ('Элара 16', 'Разделитель', 9),  ('Элара 16', 'Крышка', 6),
    ('Элара 25', 'Дно', 2), ('Элара 25', 'Разделитель', 4),  ('Элара 25', 'Крышка', 2),
    ('Элара 42', 'Дно', 2), ('Элара 42', 'Разделитель', 2),  ('Элара 42', 'Крышка', 2)
) AS v(construct_name, part_name, per_sheet)
  ON c.name = v.construct_name
ON CONFLICT (construct_id, name) DO UPDATE
    SET per_sheet = EXCLUDED.per_sheet,
        material_id = EXCLUDED.material_id;

-- ------------------------------------------------------------
-- 5. Паллена: 42 (4 is created above, 9/16/25 already exist).
--    Дно / Разделитель — coated 35, Крышка — designer 200.
-- ------------------------------------------------------------
INSERT INTO constructs (id, name, description, type, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'Паллена 42', NULL, 'PALLENA', true, now(), now()
 WHERE NOT EXISTS (SELECT 1 FROM constructs WHERE name = 'Паллена 42');

INSERT INTO parts (id, construct_id, name, per_sheet, material_id)
SELECT gen_random_uuid(), c.id, v.part_name, v.per_sheet,
       CASE WHEN v.part_name = 'Крышка'
            THEN (SELECT id FROM materials
                   WHERE type = 'designer' AND price_per_sheet = 200
                   ORDER BY name LIMIT 1)
            ELSE (SELECT id FROM materials
                   WHERE type = 'coated' AND price_per_sheet = 35
                   ORDER BY name LIMIT 1)
       END
FROM constructs c
JOIN (VALUES
    ('Паллена 42', 'Дно', 2),
    ('Паллена 42', 'Разделитель', 2),
    ('Паллена 42', 'Крышка', 2)
) AS v(construct_name, part_name, per_sheet)
  ON c.name = v.construct_name
ON CONFLICT (construct_id, name) DO UPDATE
    SET per_sheet = EXCLUDED.per_sheet,
        material_id = EXCLUDED.material_id;

-- ------------------------------------------------------------
-- 6. Этне: 15, 16 (2/4/5/6/10/12 already exist).
--    Этне 3 was seeded by V3 but is missing from the current database;
--    it is restored with the V3 values (see TODO item 6).
--    Дно+Разделитель и Шубер — coated 35.
-- ------------------------------------------------------------
INSERT INTO constructs (id, name, description, type, is_active, created_at, updated_at)
SELECT gen_random_uuid(), v.name, NULL, 'ETNE', true, now(), now()
FROM (VALUES ('Этне 3 (шубер)'), ('Этне 15 (шубер)'), ('Этне 16 (шубер)')) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM constructs c WHERE c.name = v.name);

INSERT INTO parts (id, construct_id, name, per_sheet, material_id)
SELECT gen_random_uuid(), c.id, v.part_name, v.per_sheet,
       (SELECT id FROM materials
         WHERE type = 'coated' AND price_per_sheet = 35
         ORDER BY name LIMIT 1)
FROM constructs c
JOIN (VALUES
    ('Этне 3 (шубер)',  'Дно+Разделитель', 6), ('Этне 3 (шубер)',  'Шубер', 20),
    ('Этне 10 (шубер)', 'Дно+Разделитель', 4), ('Этне 10 (шубер)', 'Шубер', 8),
    ('Этне 15 (шубер)', 'Дно+Разделитель', 4), ('Этне 15 (шубер)', 'Шубер', 5),
    ('Этне 16 (шубер)', 'Дно+Разделитель', 4), ('Этне 16 (шубер)', 'Шубер', 4)
) AS v(construct_name, part_name, per_sheet)
  ON c.name = v.construct_name
ON CONFLICT (construct_id, name) DO UPDATE
    SET per_sheet = EXCLUDED.per_sheet,
        material_id = EXCLUDED.material_id;


-- ------------------------------------------------------------
-- 7. Гималия: 4, 9, 16, 25, 42.
--    Дно / Разделитель / Крышка — coated 35, Окно — PVC.
-- ------------------------------------------------------------
INSERT INTO constructs (id, name, description, type, is_active, created_at, updated_at)
SELECT gen_random_uuid(), v.name, NULL, 'HIMALAYA', true, now(), now()
FROM (VALUES ('Гималия 4'), ('Гималия 9'), ('Гималия 16'), ('Гималия 25'), ('Гималия 42')) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM constructs c WHERE c.name = v.name);

INSERT INTO parts (id, construct_id, name, per_sheet, material_id)
SELECT gen_random_uuid(), c.id, v.part_name, v.per_sheet,
       CASE WHEN v.part_name = 'Окно'
            THEN (SELECT id FROM materials WHERE type = 'pvc' ORDER BY name LIMIT 1)
            ELSE (SELECT id FROM materials
                   WHERE type = 'coated' AND price_per_sheet = 35
                   ORDER BY name LIMIT 1)
       END
FROM constructs c
JOIN (VALUES
    ('Гималия 4',  'Дно', 8), ('Гималия 4',  'Разделитель', 42), ('Гималия 4',  'Крышка', 12), ('Гималия 4',  'Окно', 80),
    ('Гималия 9',  'Дно', 6), ('Гималия 9',  'Разделитель', 15), ('Гималия 9',  'Крышка', 6),  ('Гималия 9',  'Окно', 35),
    ('Гималия 16', 'Дно', 4), ('Гималия 16', 'Разделитель', 9),  ('Гималия 16', 'Крышка', 6),  ('Гималия 16', 'Окно', 24),
    ('Гималия 25', 'Дно', 2), ('Гималия 25', 'Разделитель', 4),  ('Гималия 25', 'Крышка', 2),  ('Гималия 25', 'Окно', 12),
    ('Гималия 42', 'Дно', 2), ('Гималия 42', 'Разделитель', 2),  ('Гималия 42', 'Крышка', 2),  ('Гималия 42', 'Окно', 8)
) AS v(construct_name, part_name, per_sheet)
  ON c.name = v.construct_name
ON CONFLICT (construct_id, name) DO UPDATE
    SET per_sheet = EXCLUDED.per_sheet,
        material_id = EXCLUDED.material_id;

-- ------------------------------------------------------------
-- 8. Эгеон: 4, 9, 16, 25, 42.
--    Дно / Разделитель — coated 35, Крышка — PVC.
--    Эгеон 4 / 25 / 42 lid perSheet = 0 is a placeholder, see
--    docs/features/construction-todo.md (item 4).
-- ------------------------------------------------------------
INSERT INTO constructs (id, name, description, type, is_active, created_at, updated_at)
SELECT gen_random_uuid(), v.name, NULL, 'EGEON', true, now(), now()
FROM (VALUES ('Эгеон 4'), ('Эгеон 9'), ('Эгеон 16'), ('Эгеон 25'), ('Эгеон 42')) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM constructs c WHERE c.name = v.name);

INSERT INTO parts (id, construct_id, name, per_sheet, material_id)
SELECT gen_random_uuid(), c.id, v.part_name, v.per_sheet,
       CASE WHEN v.part_name = 'Крышка'
            THEN (SELECT id FROM materials WHERE type = 'pvc' ORDER BY name LIMIT 1)
            ELSE (SELECT id FROM materials
                   WHERE type = 'coated' AND price_per_sheet = 35
                   ORDER BY name LIMIT 1)
       END
FROM constructs c
JOIN (VALUES
    ('Эгеон 4',  'Дно', 8), ('Эгеон 4',  'Разделитель', 42), ('Эгеон 4',  'Крышка', 0),
    ('Эгеон 9',  'Дно', 6), ('Эгеон 9',  'Разделитель', 15), ('Эгеон 9',  'Крышка', 8),
    ('Эгеон 16', 'Дно', 4), ('Эгеон 16', 'Разделитель', 9),  ('Эгеон 16', 'Крышка', 6),
    ('Эгеон 25', 'Дно', 2), ('Эгеон 25', 'Разделитель', 4),  ('Эгеон 25', 'Крышка', 0),
    ('Эгеон 42', 'Дно', 2), ('Эгеон 42', 'Разделитель', 2),  ('Эгеон 42', 'Крышка', 0)
) AS v(construct_name, part_name, per_sheet)
  ON c.name = v.construct_name
ON CONFLICT (construct_id, name) DO UPDATE
    SET per_sheet = EXCLUDED.per_sheet,
        material_id = EXCLUDED.material_id;

-- ------------------------------------------------------------
-- 9. Нереида: 4, 9, 16, 25, 42. Every detail is designer 200.
--    Нереида 4 — one merged detail + lid (same shape as Паллена 4).
-- ------------------------------------------------------------
INSERT INTO constructs (id, name, description, type, is_active, created_at, updated_at)
SELECT gen_random_uuid(), v.name, NULL, 'NEREIDA', true, now(), now()
FROM (VALUES ('Нереида 4'), ('Нереида 9'), ('Нереида 16'), ('Нереида 25'), ('Нереида 42')) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM constructs c WHERE c.name = v.name);

INSERT INTO parts (id, construct_id, name, per_sheet, material_id)
SELECT gen_random_uuid(), c.id, v.part_name, v.per_sheet,
       (SELECT id FROM materials
         WHERE type = 'designer' AND price_per_sheet = 200
         ORDER BY name LIMIT 1)
FROM constructs c
JOIN (VALUES
    ('Нереида 4',  'Дно+Разделитель', 8), ('Нереида 4',  'Крышка', 12),
    ('Нереида 9',  'Дно', 6), ('Нереида 9',  'Разделитель', 15), ('Нереида 9',  'Крышка', 6),
    ('Нереида 16', 'Дно', 4), ('Нереида 16', 'Разделитель', 9),  ('Нереида 16', 'Крышка', 6),
    ('Нереида 25', 'Дно', 2), ('Нереида 25', 'Разделитель', 4),  ('Нереида 25', 'Крышка', 2),
    ('Нереида 42', 'Дно', 2), ('Нереида 42', 'Разделитель', 2),  ('Нереида 42', 'Крышка', 2)
) AS v(construct_name, part_name, per_sheet)
  ON c.name = v.construct_name
ON CONFLICT (construct_id, name) DO UPDATE
    SET per_sheet = EXCLUDED.per_sheet,
        material_id = EXCLUDED.material_id;

