-- ============================================================
-- V16: «Индивидуальная» (INDIVIDUAL) и «Кашированная» (LAMINATED)
-- ============================================================
-- До этой миграции «Индивидуальная» существовала только во фронтенде:
-- виртуальный объект с id = 'individual' и type = 'CUSTOM', который
-- подмешивался в список конструкций в UI. Из-за этого её нельзя было
-- отредактировать в справочнике, а прайс-лист не загружался вовсе.
-- Теперь обе конструкции — обычные записи справочника.
--
-- per_sheet = 1 у всех деталей: per_sheet > 0 означает «деталь
-- включена» в калькуляторе, лишние строки менеджер выключает галочкой.
--
-- Материалы:
--   coated 35   -> 'Мелованный картон' — все детали «Индивидуальной»,
--                  как у Элары;
--   'Заглушка 111' (coated, 111.00) — все детали «Кашированной».
--   111 — это ВРЕМЕННАЯ цена-заглушка, а не реальная стоимость листа:
--   настоящий материал кашировки ещё не заведён, поэтому цена листа
--   в расчётах «Кашированной» условная и должна быть заменена вместе
--   с материалом. Материал создаётся в секции 1, потому что
--   parts.material_id NOT NULL ссылается на него по name.
--
-- constructs.name has no UNIQUE constraint, therefore every insert of a
-- construction is guarded by NOT EXISTS. Parts are inserted with
-- ON CONFLICT (construct_id, name) so the parts_construct_id_name_key
-- constraint can never be violated. price_lists has no UNIQUE
-- (construct_id) either, so the zero price list is inserted only when
-- missing: a duplicate row would break
-- PriceListRepository.findByConstructId (Optional).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Материал-заглушка для «Кашированной».
-- ------------------------------------------------------------
INSERT INTO materials (id, name, type, price_per_sheet, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'Заглушка 111', 'coated', 111.00, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM materials WHERE name = 'Заглушка 111');

-- ------------------------------------------------------------
-- 2. Конструкции. type — значения ConstructType (JPA,
--    @Enumerated(EnumType.STRING)), поэтому пишутся как имена констант.
-- ------------------------------------------------------------
INSERT INTO constructs (id, name, description, type, is_active, created_at, updated_at)
SELECT gen_random_uuid(), v.name, NULL, v.type, true, now(), now()
FROM (VALUES
    ('Индивидуальная', 'INDIVIDUAL'),
    ('Кашированная',   'LAMINATED')
) AS v(name, type)
WHERE NOT EXISTS (SELECT 1 FROM constructs c WHERE c.name = v.name);

-- ------------------------------------------------------------
-- 3. Детали «Индивидуальной» — 7 строк, материал coated 35.
--    «Дно» и «Дно+Разделитель» (как и «Крышка» / «Крышка с окном»)
--    включены одновременно намеренно: состав справочника полный,
--    несовместимые варианты менеджер выключает в калькуляторе.
-- ------------------------------------------------------------
INSERT INTO parts (id, construct_id, name, per_sheet, material_id)
SELECT gen_random_uuid(), c.id, v.part_name, 1,
       (SELECT id FROM materials
         WHERE type = 'coated' AND price_per_sheet = 35
         ORDER BY name LIMIT 1)
FROM constructs c
JOIN (VALUES
    ('Индивидуальная', 'Дно'),
    ('Индивидуальная', 'Дно+Разделитель'),
    ('Индивидуальная', 'Крышка'),
    ('Индивидуальная', 'Крышка с окном'),
    ('Индивидуальная', 'Окно'),
    ('Индивидуальная', 'Разделитель'),
    ('Индивидуальная', 'Шубер')
) AS v(construct_name, part_name)
  ON c.name = v.construct_name
ON CONFLICT (construct_id, name) DO UPDATE
    SET per_sheet = EXCLUDED.per_sheet,
        material_id = EXCLUDED.material_id;

-- ------------------------------------------------------------
-- 4. Детали «Кашированной» — 5 строк, материал 'Заглушка 111'.
-- ------------------------------------------------------------
INSERT INTO parts (id, construct_id, name, per_sheet, material_id)
SELECT gen_random_uuid(), c.id, v.part_name, 1,
       (SELECT id FROM materials WHERE name = 'Заглушка 111' LIMIT 1)
FROM constructs c
JOIN (VALUES
    ('Кашированная', 'Дно-каркас'),
    ('Кашированная', 'Дно-лайнер'),
    ('Кашированная', 'Обложка-каркас'),
    ('Кашированная', 'Обложка-лайнер-внеш.'),
    ('Кашированная', 'Обложка-лайнер-внутр.')
) AS v(construct_name, part_name)
  ON c.name = v.construct_name
ON CONFLICT (construct_id, name) DO UPDATE
    SET per_sheet = EXCLUDED.per_sheet,
        material_id = EXCLUDED.material_id;

-- ------------------------------------------------------------
-- 5. Прайс-листы-нули: цены вводятся вручную на странице «Цены».
--    Набор ключей совпадает с TIER_LABELS во фронтенде.
-- ------------------------------------------------------------
INSERT INTO price_lists (construct_id, price_data)
SELECT c.id,
       '{"до 9":0,"10–49":0,"50–199":0,"200–499":0,"500–699":0,"700–1499":0,"от 1500":0}'::jsonb
FROM constructs c
WHERE c.name IN ('Индивидуальная', 'Кашированная')
  AND NOT EXISTS (SELECT 1 FROM price_lists pl WHERE pl.construct_id = c.id);
