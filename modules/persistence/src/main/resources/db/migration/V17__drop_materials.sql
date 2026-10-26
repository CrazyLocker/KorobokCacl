-- ============================================================
-- V17: материалы уходят из модели — цена листа переезжает в деталь
-- ============================================================
-- Раньше parts ссылалась на materials (parts.material_id), и стоимость
-- листа бралась из справочника материалов. Теперь калькулятор знает
-- только цену: «какой картон» — вне модели. Цена листа хранится
-- непосредственно в детали конструкции (parts.price_per_sheet).
--
-- Порядок важен: сначала добавляем колонку и переносим данные, только
-- потом рвём FK и удаляем справочник. material_id NOT NULL, поэтому
-- backfill покрывает все существующие детали.
-- ============================================================

-- 1. Цена листа переезжает в деталь.
ALTER TABLE parts ADD COLUMN price_per_sheet NUMERIC(38,2) NOT NULL DEFAULT 0;

-- 2. Backfill из materials.
UPDATE parts p SET price_per_sheet = m.price_per_sheet
  FROM materials m WHERE m.id = p.material_id;

-- 3. Удаляем FK, индекс, material_id, materials.
ALTER TABLE parts DROP CONSTRAINT parts_material_id_fkey;
DROP INDEX IF EXISTS idx_parts_material_id;
ALTER TABLE parts DROP COLUMN material_id;
DROP TABLE materials;
