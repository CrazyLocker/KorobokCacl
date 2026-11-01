-- Ветвление версий расчёта.
--
-- До этой миграции цепочка была линейной: root_id + сквозной номер, а
-- уникальным был индекс (root_id, version) — два ребёнка одной версии
-- сохранить было нельзя. Теперь версия ссылается на родителя, номер равен
-- глубине ветки (родитель + 1). У двух веток, сделанных из одной версии,
-- номера намеренно совпадают: происхождение показывает вложенность дерева,
-- а не номер, поэтому уникальных ограничений на номер нет.
--
-- Удаление стало мягким: строка помечается deleted_at, но остаётся в дереве
-- зачёркнутой. История изменений нужна при согласовании расчёта с заказчиком,
-- поэтому физического удаления больше нет.

ALTER TABLE calculations ADD COLUMN parent_id UUID;
ALTER TABLE calculations ADD COLUMN deleted_at TIMESTAMP;

-- Существующие цепочки линейные: родитель — строка с предыдущим номером.
UPDATE calculations c
SET parent_id = p.id
FROM calculations p
WHERE c.root_id = p.root_id
  AND c.version > 1
  AND p.version = c.version - 1;

ALTER TABLE calculations
    ADD CONSTRAINT fk_calculations_parent_id
        FOREIGN KEY (parent_id) REFERENCES calculations (id) ON DELETE CASCADE;

ALTER TABLE calculations DROP CONSTRAINT IF EXISTS uk_calculations_root_version;

CREATE INDEX idx_calculations_parent_id ON calculations (parent_id);
CREATE INDEX idx_calculations_deleted_at ON calculations (deleted_at);
