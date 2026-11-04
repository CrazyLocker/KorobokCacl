# Внедрение «Развёртки» в WebCalc — план на будущее

**Статус: FUTURE. Ничего не реализовано, код не менялся.** Старт — после того, как плагин
`dieline-inspector` будет доработан (см. §4 «Что должно быть готово в плагине»).
Файл фиксирует согласованную цель, проверенные возможности плагина, места в коде WebCalc,
которые придётся затронуть, и открытые решения.

## 1. Цель пользователя (дословно)

> Получить от заказчика какую конструкцию он выбрал и нужные ему размеры. Загрузить в плагин
> чертеж и перерисовать в нужных размерах. Затем передать в Расчет заказа данные сколько на
> лист и т.д. В модуль расчет ножа передать чертеж для расчета стоимости ножа.

Цепочка: **конструкция + размеры → чертёж заказчика → проверка → перерисовка → «сколько на
лист» в расчёт заказа → SVG в расчёт ножа**.

## 2. Что умеет плагин (проверено, не по документации)

Плагин: `C:\Users\Alecsey\Documents\deepseek-harness\default-workspace\dieline-inspector-bundle`.
`client.js` — 224 209 б, 4670 строк, чистый React (`require('react')` — единственная внешняя
зависимость), стили инлайновые, без antd. В WebCalc `react ^18.3.1` — совпадает.

Прогон движка на реальных файлах (headless Chrome, страница-обёртка с заглушками `ctx`):

| Файл | Результат |
|---|---|
| `Materials\dieline-100x55x160\lock-bottom-100x55x160-dieline.svg` | 29 ok / 2 warn / 1 fail; паспорт `carton.box_v2.lock_bottom`, `100×55×160`, панелей 5, резов 16, сгибов 7, viewBox `333.3 × 285.95` |
| `out-dno.svg` | паспорт `{length 130, bottom 100, wall 25, shell 10, cardboard 0.4}`, заготовка `248.705 × 298.699` |
| `out-kryshka.svg` | `{130, 100, 25, shell 0}`, заготовка `227.101 × 255.459` |
| `baked-120x110x35.svg` | `{120, 110, 35, shell 5, cardboard 0.5}`, заготовка `279 × 289.002` |

Единственный fail на файле из `Materials` — законный: `flaps.topWidth` «left 54.3 мм вместо
55 мм; right 53.6 вместо 54.3» — это `shrink: 0.7` из `request.json`.

Сверка с ожидаемыми габаритами работает: `new-200x60x40.svg` с inner 200×60×40 →
`fail size.length` «212 мм, нужно 200 мм», `fail size.height` «40 мм, нужно 42 мм».

**Перерисовка в новые размеры работает** (это ключевое для цели):

- одиночный файл: `out-dno.svg` (130×100×25, shell 10) → цель внутр. 200×80×60, картон 2 →
  `{length 200, bottom 100, wall 62, shell 10, cardboard 2}`; `out-kryshka.svg` → `{length 200,
  bottom 80, wall 62}`;
- пара «дно + крышка» через UI: два файла → 120/70/180, картон 0.4, зазор 1 мм →
  «Пересчитать оба» → `Дно 140x90x180.4_0.4.svg` и `Крышка 140x90x180.4_0.4.svg` в миллиметрах.

Программные точки входа (для интеграции без UI):

- `api.__analyze(svgText, expected, creaseText)` → `{checks, passport}`; `TOL = 0.25`,
  `FOLD_TOL = 0.75`;
- `api.__retarget(svgText, target)` → `{svg, name, summary}` либо `{error, …}`;
- форма `target`/`expected`: `{mode: 'inner'|'outer', length, width, height, shell, cardboard,
  outer: {l,w,h}, inner: {l,w,h}}`, где `length = inner.l`, `width = outer.w`, `height = outer.h`;
- паспорт: `mode` (`template` — файл с метаданными конструкции, `geometry` — обычный чертёж),
  `model`, `size`, `blank`, `box`, `strips`, `panels`, `cuts`, `creases`.

## 3. Чего не хватает в WebCalc (по карте кода)

| Звено | Сейчас | Нужно |
|---|---|---|
| Геометрия конструкции | `constructs`/`parts` хранят только `per_sheet` и `price_per_sheet`, размеров нет | паспорт развёртки как источник размеров |
| Генерация/хранение развёртки | SVG есть только в `knives.svg_content`, связи с расчётом нет | таблица `dielines` + API |
| «Сколько на лист» на бэкенде | отсутствует: `countOnSheet`/`colsOnSheet`/`partsPerSheetOnPrint` приходят готовыми (`DetailDto`), `PrintTable` не хранит габаритов листа | подавать `blank L×W` из паспорта в раскладку |
| Раскладка | живёт только на фронте: `frontend/src/features/layout/engine/packParts.ts:628`, `gridLayout.ts:13` | переиспользовать, не портировать на Java |
| Мост «раскладка → расчёт» | уже есть: `frontend/src/hooks/useCalculator.ts:501` `applyLayoutCounts` | прокинуть туда числа из паспорта |
| Нож | `POST /api/knife/calculate` принимает строку SVG (`frontend/src/api/calculatorApi.ts:186`); `saveKnife` объявлен, но не вызывается | передавать новый SVG и сохранять нож |

Модули `modules/construct` и `modules/order` пустые — новый код логичнее класть в
`modules/api` (контроллер/DTO) + `modules/persistence` (сущность/миграция).

## 4. Что должно быть готово в плагине до старта

1. Вкладка «Самосборная» — сейчас заглушка («плагин ещё не обучен самосборной конструкции»).
2. Пересчёт нестандартных конструкций: сейчас только распознанная сетка полос (П-профиль /
   лоток); иначе `retarget.unsupported` «…сетка полос не распознана как известная конструкция».
3. Файлы с метаданными (`mode: 'template'`, как `carton.box_v2.lock_bottom`) сейчас **только
   анализируются** — блок «Изменить размеры» скрыт (`canRetarget: passport.mode === 'geometry'`).
   Решить: либо плагин учится пересчитывать шаблоны, либо перерисовка для них остаётся в
   генераторе WebCalc, а плагин работает как контроль качества.
4. Дефекты обработки плохих файлов: в `detail` утекает сырой текст парсера браузера
   («This page contains the following errors:…»); SVG из одной линии даёт
   `Cannot read properties of null (reading 'blank')`.
5. Пункт «Развёртка» в сайдбаре desktop-клиента DSH не открывает панель (слот `main` занят
   чатом) — на внедрение в WebCalc не влияет, но для работы с плагином руками мешает.

## 5. План внедрения по этапам

### Этап 1. Страница «Развёртка» во фронте (без БД)

- Порт движка: `frontend/src/features/dieline/engine/dielineInspector.js` — `client.js` как
  vendor-модуль, `require('react')` подменяется адаптером (UMD-обёртка `window.__ModuleLoader__`).
- `frontend/src/features/dieline/hooks/useDielineAnalysis.ts` — обёртка над `__analyze`/`__retarget`.
- `frontend/src/features/dieline/ui/DielinePage.tsx` — загрузка SVG (файл/вставка кода), отчёт
  с паспортом, вкладки «Один файл» / «Дно + Крышка», поля габаритов → «Пересчитать»,
  «Скачать SVG», «В расчёт», «Рассчитать нож».
- Роут в `frontend/src/App.tsx` (рядом с `case 'knife'`) + пункт в `frontend/src/navigation.ts`
  сразу после «Расчет коробки».
- Заодно закрыть дефекты §4.4.

### Этап 2. Хранение и связь с расчётом

- Миграция `modules/persistence/src/main/resources/db/migration/V24__create_dielines.sql`
  (следующая после `V23__restore_varnish_operation.sql`): `id`, `calculation_id` (nullable),
  `customer_id` (nullable), `name`, `kind` (`single`/`pair`), `svg_content TEXT`,
  `lid_svg_content TEXT`, `passport JSONB`, `blank_width_mm`, `blank_length_mm`,
  `target_length/width/height`, `created_at`.
- Entity `Dieline` в `modules/persistence/.../entity/`, контроллер `DielineController`
  (`/api/dielines`): `POST` (анализ + сохранение), `GET /{id}`, `GET ?calculationId=`,
  `DELETE /{id}`.
- Связь с версией расчёта: развёртка прикрепляется к конкретной `calculations.id` (как заказ
  «прорастает» из версии, `calculation_orders.source_calculation_id`).

### Этап 3. «Сколько на лист»

- Из паспорта берём `blank {w, h}` и подставляем в существующую раскладку
  (`frontend/src/features/layout/engine/packParts.ts`), формат листа — из `print_tables.format_id`
  либо из пресетов `LayoutPage.tsx:47`.
- Результат уходит в расчёт через `applyLayoutCounts` (`frontend/src/hooks/useCalculator.ts:501`)
  → `countOnSheet` деталей; для режима сборки — `colsOnSheet`.
- Автозаполнение `assemblySettings {enabled, format, quantity}` (`AssemblySettingsDto`).

### Этап 4. Нож

- `calculateKnife` (`frontend/src/api/calculatorApi.ts:186`) на перерисованном SVG →
  `totalLengthMm`, `knifeCost`.
- Кнопка «Сохранить нож» (сейчас `saveKnife` объявлен, но не вызывается) → `knives` с привязкой
  к расчёту; стоимость ножа в итог расчёта не входит (см. §6).

## 6. Решения, которые ещё не приняты

- **Куда попадает стоимость ножа** — пользователь ответил «пока никуда, всё в план». Текущее
  поведение: `knifeCost` считается (`KnifeCalculator`: `totalLengthMm * knifePricePerMm +
  knifeBaseCost`), но в `CostCalculator`/`CalculationService` не добавляется ни в `totalCost`,
  ни в прайс. Варианты на будущее: отдельная строка в заказе / справочно / в себестоимость.
- Кто загружает чертёж: менеджер в кабинете или сам заказчик.
- Хранить SVG в БД (`TEXT`) или файлами на диске.
- Нужна ли версионность развёртки (перерисовали размеры → новая запись или правка старой).

## 7. Риски

- `<use>`, `<text>`, `<image>`, `clipPath` не учитываются при измерении длины
  (`SvgLengthCalculator`, `IGNORED_TAGS:46`) — нож может посчитаться меньше реального.
- Стоимость ножа зависит от `app.pricing.knifePricePerMm` / `knifeBaseCost` — при их смене
  старые сохранённые ножи не пересчитываются.
- Перерисовка выдаёт миллиметровые координаты (1 user unit = 1 mm) — импорт таких SVG в другие
  редакторы может потребовать настройки единиц.
- Раскладка на фронте не знает про толщину картона и bleed: `blank` из паспорта включает клапаны,
  но не зазоры резки.
