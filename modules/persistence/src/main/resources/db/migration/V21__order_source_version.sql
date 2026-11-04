-- V21: заказ рождается из конкретной версии расчёта.
--
-- Заказчик выбирает вариант расчёта (скажем, третью версию), и заказ растёт
-- именно из неё. Расчёт при этом остаётся на месте: все версии, включая
-- выбранную, продолжают жить в дереве клиента. Поэтому связь переезжает с
-- «расчёт числится в заказе» (calculations.order_id) на «у заказа есть
-- версия-источник» (calculation_orders.source_calculation_id).
--
-- Побочный эффект и есть цель: один расчёт может дать несколько заказов —
-- клиент вернулся через месяц, выбрал уже пятую версию и сделал второй заказ.

ALTER TABLE calculation_orders ADD COLUMN source_calculation_id UUID
    REFERENCES calculations (id) ON DELETE SET NULL;

CREATE INDEX idx_calculation_orders_source ON calculation_orders (source_calculation_id);

-- Сохраняем уже заведённые связи: заказ, к которому был привязан расчёт,
-- получает самую свежую версию этого расчёта как источник.
UPDATE calculation_orders o
SET source_calculation_id = (
    SELECT c.id
    FROM calculations c
    WHERE c.order_id = o.id
    ORDER BY c.updated_at DESC
    LIMIT 1
);

ALTER TABLE calculations DROP COLUMN order_id;
