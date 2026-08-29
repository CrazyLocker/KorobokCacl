# Структура проекта «Калькулятор себестоимости коробки»

> Обзор архитектуры для разработчика. Сгенерировано по состоянию репозитория.

---

## 1. Общее описание

Многомодульное приложение для расчёта себестоимости и цены коробок.

- **Бэкенд:** Java 21, Spring Boot 3.3.4, Gradle (Kotlin DSL), PostgreSQL 15+, Flyway, JPA/Hibernate, Spring Security (JWT — в планах).
- **Фронтенд:** React 18 + TypeScript, Vite, Material-UI v6 (`@mui/material`, `@mui/icons-material`), Emotion, Axios.
- **Сборка бэкенда:** `./gradlew clean build` · **Запуск API:** `./gradlew :modules:api:bootRun`

---

## 2. Дерево каталогов

```
WebCalc/
├── settings.gradle.kts          # include 8 модулей backend
├── build.gradle.kts             # корневой конфиг: Spring Boot 3.3.4, Java 21, JUnit5
├── gradle.properties
├── package.json                 # зависимости MUI (для root-проекта)
├── README.md
├── PROJECT_STRUCTURE.md         # этот файл
├── Prompt(Koda).md              # промпт-задание на перенос HTML-калькулятора
├── UI_Specification_Kalkulyator_Korobki.md   # UI-гайд (Figma): 5 экранов, цвета, типографика
├── Стоимость коробки01.html     # исходный HTML-калькулятор (референс)
├── docs/                        # (пусто)
├── scripts/                     # (пусто)
│
├── modules/                     # ── BACKEND (Gradle multi-project) ──
│   ├── core/                    # базовые утилиты (KorobkiCore — placeholder)
│   ├── security/                # Spring Security, CORS, JWT (в планах)
│   ├── persistence/             # JPA-сущности, репозитории, миграции Flyway (V1–V4)
│   ├── calculator/              # сервисы расчёта (CostCalculator, PrintCostCalculator, …)
│   ├── pricing/                 # наценки, налоги, скидки (PriceCalculator — реализован)
│   ├── order/                   # заказы и история (пока пусто)
│   ├── construct/               # управление конструкциями (пока пусто)
│   └── api/                     # REST-контроллеры, DTO, CalculatorService, точка входа
│
└── frontend/                    # ── FRONTEND (Vite + React + TS) ──
    ├── index.html
    ├── vite.config.ts           # proxy /api → http://localhost:8080
    ├── tsconfig*.json
    ├── eslint.config.js
    ├── package.json
    └── src/
        ├── main.tsx             # bootstrap React
        ├── App.tsx              # главный экран калькулятора (подключён к API)
        ├── App.css / index.css
        ├── api/
        │   └── calculatorApi.ts # HTTP-клиент (axios): calculate, constructs, print-tables, price-lists
        ├── assets/
        ├── components/
        │   ├── Layout/          # Header, Layout
        │   ├── Calculator/      # ConstructionSelector, LayoutTable, ExtrasBlock, PriceTable
        │   └── BoxCalculator/   # legacy-компоненты (не используются в App.tsx)
        ├── hooks/
        │   └── useCalculator.ts # состояние калькулятора + вызовы API
        ├── store/               # (пусто)
        └── types/
            └── index.ts         # TypeScript-типы (Detail, Extra, PriceRow, Construct, …)
```

---

## 3. Backend-модули (детально)

Пакет-корень: `com.korobki` · `group = com.korobki` · `version = 1.0.0`

| Модуль | Назначение | Ключевые классы |
|--------|-----------|-----------------|
| **core** | Базовые утилиты | `KorobkiCore` (placeholder) |
| **security** | Аутентификация/авторизация | `SecurityConfig` (HTTP Basic, CSRF off, CORS; JWT в планах) |
| **persistence** | Сущности + репозитории + миграции | см. раздел 4 |
| **calculator** | Бизнес-логика расчётов | `CostCalculator`, `PrintCostCalculator`, `ConstructService`, `MaterialService`, `OperationService` |
| **pricing** | Ценообразование | `PriceCalculator` (скидка → НДС, по НК РФ; 7 тиражных tiers) |
| **order** | Заказы/история | — (пусто) |
| **construct** | Управление конструкциями | — (пусто) |
| **api** | REST API + запуск | `KorobkiApplication`, контроллеры, DTO, `CalculatorService` |

### 3.1 Точка входа
`modules/api/.../KorobkiApplication.java`
- `@SpringBootApplication(scanBasePackages = "com.korobki")`
- `@EntityScan("com.korobki.persistence.entity")`
- `@EnableJpaRepositories("com.korobki.persistence.repository")`

### 3.2 REST-контроллеры (`modules/api/.../controller/`)

| Контроллер | Базовый путь | Методы |
|-----------|--------------|--------|
| `ConstructController` | `/api/constructs` | `GET /` (активные), `GET /{id}` |
| `MaterialController` | `/api/materials` | (аналогично) |
| `OperationController` | `/api/operations` | (аналогично) |
| `CalculatorController` | `/api/calculator` | `POST /calculate` — полный расчёт себестоимости и цен |
| `PriceListController` | `/api/price-lists` | `GET /by-construct/{constructId}` — прайс-лист по конструкции |
| `PrintTableController` | `/api/print-tables` | `GET /` — все форматы печати (3 формата) |

> Заказы/история — эндпоинты пока не реализованы.

### 3.3 CalculatorService (оркестратор расчёта)
`modules/api/.../controller/CalculatorService.java` — `@Service`, связывает `CostCalculator` + `PriceCalculator` + `PrintCostCalculator`:
1. Конвертация API DTO → внутренние типы `CostCalculator.DetailInfo` / `ExtraInfo`
2. Расчёт полной себестоимости (`CostCalculator.calculateTotalCost`) — единый цикл по `operations` Map для каждой детали
3. Округление до целого (rounding #1)
4. Генерация цен по 7 тиражам (`PriceCalculator.generatePrices`)
5. Сборка `CalculationResponse`

> **Унификация операций:** все операции (стандартные: Лак, Конгрев, Тиснение, Ламинация — и кастомные) работают через единый механизм `Map<String, Boolean> operations` в `DetailDto`. Ключ — имя операции, значение — включена/выключена для конкретной детали. Стоимость операции ищется в общем списке `extras` по имени.

### 3.4 DTO (`modules/api/.../dto/`)
| DTO | Назначение |
|-----|-----------|
| `CalculationRequest` | construction, details[], extras[] (все операции в одном списке), printSettings, workPrice, priceList |
| `CalculationResponse` | totalCost, basePrice, branch, basePriceWithVAT, prices[] |
| `DetailDto` | name, countOnSheet, sheetPrice, isPrinted, enabled, **operations** (`Map<String, Boolean>`) |
| `ExtraDto` | name, cost, enabled, isCustom |
| `PrintSettingsDto` | enabled, format, quantity |
| `PriceRowDto` | label, withoutVAT, calculatedPrice, priceListPrice, finalPrice, isBase, isPriceListUsed |

### 3.5 Конфигурация (`modules/api/src/main/resources/application.yml`)
- БД: `jdbc:postgresql://localhost:5432/korobki` (user `postgres`)
- `jpa.hibernate.ddl-auto: validate` + `show-sql: true`
- Flyway: `classpath:db/migration`, `baseline-on-migrate: true`
- JWT: `jwt.secret` (env `JWT_SECRET`), `expiration: 28800000` (8 ч)
- Параметры расчёта (`app.pricing`):
  - `manufacturing-cost: 5.0`, `markup-min: 30.0`, `markup-multiplier: 3.0`, `tax-rate: 0.11`
  - `discount-steps`: 1–9: +7; 10–49: 0; 50–199: −2; 200–499: −4; 500–699: −6; 700+: −8

> **Примечание:** `PriceCalculator` использует захардкоженные константы (7 tiers, коэффициенты, корректировки), а не значения из `app.pricing`. Конфиг в `application.yml` — справочный.

### 3.6 Security
`SecurityConfig` разрешает без авторизации: `/api/constructs/**`, `/api/materials/**`, `/api/operations/**`, `/api/calculator/**`, `/api/print-tables/**`, `/api/price-lists/**`, Swagger/OpenAPI. Остальное — `authenticated()`. Сейчас `httpBasic`; полноценный JWT ещё не подключён. CORS: все origin, все методы, все заголовки.

---

## 4. Модель данных (persistence)

### 4.1 Сущности (`com.korobki.persistence.entity`)

| Сущность | Таблица | Описание |
|----------|---------|----------|
| `User` | `users` | email, password_hash, role |
| `Construct` | `constructs` | name, description, **parts (JSONB)**, is_active |
| `Material` | `materials` | name, type (`coated`/`designer`), price_per_sheet, диапазон закупочной цены |
| `Operation` | `operations` | name, unit, base_price, price_type (`fixed`/`per_unit`) |
| `Order` | `orders` | клиент, конструкция, материал, тираж, цены, статус, даты |
| `OrderPart` | `order_parts` | детали заказа (part_name, parts_per_sheet, cost_per_part) |
| `OrderOperation` | `order_operations` | доп. операции заказа (quantity, cost_per_unit, total_cost) |
| `PriceList` | `price_lists` | construct_id, **price_data (JSONB)** — прайс по 7 тиражным tiers |
| `PrintTable` | `print_tables` | format_id, format_name, **steps (JSONB)**, step_after_3000 |

- Все ID — `UUID` (`GenerationType.UUID`).
- `Construct.parts` — JSONB в формате `{"parts": [{"name": "Дно", "perSheet": 6}, ...]}`.
- `PriceList.priceData` — JSONB `{"до 9": 34, "10–49": 27, ...}`.
- `PrintTable.steps` — JSONB `[{"minQty": 100, "price": 5500}, ...]`, плюс `stepAfter3000` для линейной экстраполяции выше 3000 шт.
- `Order` использует `@PrePersist`/`@PreUpdate` для `created_at`/`updated_at`.
- Статусы заказа: `draft, ready, sent, in_work, closed`.

### 4.2 Репозитории (`com.korobki.persistence.repository`)
`ConstructRepository`, `MaterialRepository`, `OperationRepository`, `OrderRepository`, `OrderPartRepository`, `OrderOperationRepository`, `PriceListRepository` (`findByConstructId`), `PrintTableRepository` (`findByFormatId`, `findAllByOrderByFormatIdAsc`).

### 4.3 Миграции Flyway (`persistence/src/main/resources/db/migration/`)
- **V1__create_schema.sql** — создание 7 таблиц (constructs, materials, operations, orders, order_parts, order_operations, users) с CHECK-ограничениями и FK.
- **V2__insert_initial_data.sql** — справочники: 3 конструкции (старые), 4 материала, 9 операций.
- **V3__update_constructions.sql** — замена старых конструкций на 10 новых (Этне 2/3/5/6/12, Элара 4, Паллена 9/16/25, Атлас) в новом формате parts.
- **V4__create_price_lists_and_print_tables.sql** — таблицы `price_lists` (10 прайс-листов) и `print_tables` (3 формата печати).

---

## 5. Frontend

### 5.1 Стек
React 18 + TypeScript, сборщик Vite, UI-библиотека MUI v6 (`@mui/material`, `@mui/icons-material`), Emotion, Axios. Vite proxy: `/api` → `http://localhost:8080`.

### 5.2 Структура `src/`
- `main.tsx` — точка входа.
- `App.tsx` — главный экран: выбор конструкции, таблица раскладки деталей, доп. операции (печать/лак/конгрев/тиснение/ламинация + кастомные), цены для клиента. **Подключён к backend API** через `useCalculator`.
- `api/calculatorApi.ts` — HTTP-клиент (axios): `calculate`, `getConstructs`, `getPrintTables`, `getPriceList`.
- `hooks/useCalculator.ts` — полное состояние калькулятора: загрузка конструкций/прайс-листов/таблиц печати из API, управление деталями/операциями (через единый `operations` Map)/настройками печати, вызов расчёта.
- `types/index.ts` — TypeScript-типы: `Detail` (с `operations: Record<string, boolean>`), `Extra`, `PrintSettings`, `CalculationRequest/Response`, `PriceRow`, `PrintTable`, `PriceListData`, `Construct`, `ConstructPart`.
- `components/Layout/` — `Header` (шапка с вкладками), `Layout`.
- `components/Calculator/` — `ConstructionSelector` (Select конструкций), `LayoutTable` (таблица деталей: вкл./выкл., шт./лист, руб./лист, чекбоксы Печать + все операции из единого списка `extras`), `ExtrasBlock` (печать: формат + тираж; все операции в одном списке: стандартные + кастомные), `PriceTable` (7 тиражей: Без НДС, С НДС, Прайс, Итог; базовая строка выделена).
- `components/BoxCalculator/` — legacy-компоненты (`BoxCalculator`, `PartsList`, `ConstructSelector`), не используются в `App.tsx`.
- `store/` — заготовлен, пока пустой.

> Фронтенд полностью подключён к backend API. Данные загружаются из БД через REST-эндпоинты.

---

## 6. UI-спецификация

`UI_Specification_Kalkulyator_Korobki.md` — подробный гайд для Figma:
- **5 экранов:** Авторизация → Список заказов → Новый расчёт → Карточка заказа → Настройки (админ).
- Цветовая схема (primary `#1a73e8`), типографика (Inter), компоненты/состояния, мобильная адаптация.

---

## 7. Статус реализации (что готово / что в планах)

| Область | Статус |
|---------|--------|
| Многомодульный каркас Gradle | ✅ готов |
| Модель данных + миграции Flyway (V1–V4) | ✅ готов |
| REST: справочники (constructs/materials/operations) | ✅ базовые GET |
| REST: расчёт (`POST /api/calculator/calculate`) | ✅ реализован |
| REST: прайс-листы (`GET /api/price-lists/by-construct/{id}`) | ✅ реализован |
| REST: таблицы печати (`GET /api/print-tables`) | ✅ реализован |
| Расчёт себестоимости (CostCalculator + PrintCostCalculator) | ✅ реализован (BigDecimal) |
| Ценообразование (PriceCalculator: 7 tiers, ×3/+30, НДС, прайс) | ✅ реализован |
| Фронтенд: экран калькулятора | ✅ подключён к API, полный функционал |
| Фронтенд: таблица раскладки, доп. операции, цены | ✅ реализованы (MUI) |
| Заказы (order) + эндпоинты сохранения | ❌ отсутствуют |
| Аутентификация JWT + роли | ⚠️ только HTTP Basic, JWT не подключён |
| Экраны: авторизация, список заказов, карточка, настройки | ❌ не реализованы |
| Тесты | ✅ JUnit5: `PriceCalculatorTest`, `CostCalculatorTest` (11 тестов) |

---

## 8. Команды

```bash
# Backend
./gradlew clean build
./gradlew :modules:api:bootRun

# Frontend
cd frontend
npm install
npm run dev
```

> БД PostgreSQL должна быть запущена на `localhost:5432`, БД `korobki`, пароль из `application.yml`.
