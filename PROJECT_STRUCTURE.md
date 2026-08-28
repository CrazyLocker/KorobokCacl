# Структура проекта «Калькулятор себестоимости коробки»

> Обзор архитектуры для разработчика. Сгенерировано по состоянию репозитория.

---

## 1. Общее описание

Многомодульное приложение для расчёта себестоимости и цены коробок.

- **Бэкенд:** Java 21, Spring Boot 3.3.4, Gradle (Kotlin DSL), PostgreSQL 15+, Flyway, JPA/Hibernate, Spring Security (JWT — в планах).
- **Фронтенд:** React 18 + TypeScript, Vite, Material-UI (MUI).
- **Сборка бэкенда:** `./gradlew clean build` · **Запуск API:** `./gradlew :modules:api:bootRun`

---

## 2. Дерево каталогов

```
WebCalc/
├── settings.gradle.kts          # include 8 модулей backend
├── build.gradle.kts             # корневой конфиг: Spring Boot 3.3.4, Java 21, JUnit5
├── gradle.properties
├── package.json                 # зависимости MUI (для frontend)
├── README.md
├── UI_Specification_Kalkulyator_Korobki.md   # UI-гайд (Figma): 5 экранов, цвета, типографика
├── docs/                        # (пусто)
├── scripts/                     # (пусто)
│
├── modules/                     # ── BACKEND (Gradle multi-project) ──
│   ├── core/                    # базовые утилиты (KorobkiCore — placeholder)
│   ├── security/                # Spring Security, JWT-аутентификация, роли
│   ├── persistence/             # JPA-сущности, репозитории, миграции Flyway
│   ├── calculator/              # сервисы расчёта (Construct/Material/Operation)
│   ├── pricing/                 # наценки, налоги, скидки (PriceCalculator — реализован)
│   ├── order/                   # заказы и история (пока пусто)
│   ├── construct/               # управление конструкциями (пока пусто)
│   └── api/                     # REST-контроллеры + точка входа (bootRun)
│
└── frontend/                    # ── FRONTEND (Vite + React + TS) ──
    ├── index.html
    ├── vite.config.ts
    ├── tsconfig*.json
    ├── eslint.config.js
    ├── package.json
    ├── public/
    └── src/
        ├── main.tsx             # bootstrap React
        ├── App.tsx              # главный экран калькулятора (mock-данные)
        ├── App.css / index.css
        ├── api/                 # (пусто — HTTP-клиент не подключён)
        ├── assets/
        ├── components/
        │   ├── Layout/          # Header, Layout
        │   └── BoxCalculator/   # BoxCalculator, PartsList, ConstructSelector
        ├── hooks/
        ├── store/
        └── types/
```

---

## 3. Backend-модули (детально)

Пакет-корень: `com.korobki` · `group = com.korobki` · `version = 1.0.0`

| Модуль | Назначение | Ключевые классы |
|--------|-----------|-----------------|
| **core** | Базовые утилиты | `KorobkiCore` (placeholder) |
| **security** | Аутентификация/авторизация | `SecurityConfig` (HTTP Basic, CSRF off; JWT в планах) |
| **persistence** | Сущности + репозитории + миграции | см. раздел 4 |
| **calculator** | Бизнес-логика расчётов | `ConstructService`, `MaterialService`, `OperationService` |
| **pricing** | Ценообразование | `PriceCalculator` (скидка → НДС, по НК РФ) |
| **order** | Заказы/история | — (пусто) |
| **construct** | Управление конструкциями | — (пусто) |
| **api** | REST API + запуск | `KorobkiApplication`, контроллеры |

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

> Заказы/расчёт/ценообразование — эндпоинты пока не реализованы.

### 3.3 Конфигурация (`modules/api/src/main/resources/application.yml`)
- БД: `jdbc:postgresql://localhost:5432/korobki` (user `postgres`)
- `jpa.hibernate.ddl-auto: validate` + `show-sql: true`
- Flyway: `classpath:db/migration`, `baseline-on-migrate: true`
- JWT: `jwt.secret` (env `JWT_SECRET`), `expiration: 28800000` (8 ч)
- Параметры расчёта (`app.pricing`):
  - `manufacturing-cost: 5.0`, `markup-min: 30.0`, `markup-multiplier: 3.0`, `tax-rate: 0.11`
  - `discount-steps`: 1–9: +7; 10–49: 0; 50–199: −2; 200–499: −4; 500–699: −6; 700+: −8

### 3.4 Security
`SecurityConfig` разрешает без авторизации: `/api/constructs/**`, `/api/materials/**`, `/api/operations/**`, Swagger/OpenAPI. Остальное — `authenticated()`. Сейчас `httpBasic`; полноценный JWT ещё не подключён.

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

- Все ID — `UUID` (`GenerationType.UUID`).
- `Order` использует `@PrePersist`/`@PreUpdate` для `created_at`/`updated_at`.
- Статусы заказа: `draft, ready, sent, in_work, closed`.

### 4.2 Репозитории (`com.korobki.persistence.repository`)
`ConstructRepository`, `MaterialRepository`, `OperationRepository`, `OrderRepository`, `OrderPartRepository`, `OrderOperationRepository`.

### 4.3 Миграции Flyway (`persistence/src/main/resources/db/migration/`)
- **V1__create_schema.sql** — создание 7 таблиц (constructs, materials, operations, orders, order_parts, order_operations, users) с CHECK-ограничениями и FK.
- **V2__insert_initial_data.sql** — справочники: 3 конструкции, 4 материала, 9 операций.

---

## 5. Frontend

### 5.1 Стек
React 18 + TypeScript, сборщик Vite, UI-библиотека MUI v9 (`@mui/material`, `@mui/icons-material`), Emotion.

### 5.2 Структура `src/`
- `main.tsx` — точка входа.
- `App.tsx` — главный экран: выбор конструкции, список деталей, кнопки «Сохранить»/«Рассчитать». Использует **mock-данные** (`mockConstructs`).
- `components/Layout/` — `Header`, `Layout` (шапка с вкладками).
- `components/BoxCalculator/` — `BoxCalculator` (альтернативная версия), `PartsList`, `ConstructSelector`.
- `api/`, `hooks/`, `store/`, `types/` — заготовлены, пока пустые.

> ⚠️ Фронтенд не подключён к backend API — данные захардкожены. HTTP-клиент отсутствует.

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
| Модель данных + миграции Flyway | ✅ готов |
| REST: справочники (constructs/materials/operations) | ✅ базовые GET |
| Расчёт себестоимости (calculator/pricing) | ✅ `CostCalculator` + `PriceCalculator` реализованы |
| Заказы (order) + эндпоинты расчёта/сохранения | ❌ отсутствуют |
| Аутентификация JWT + роли | ⚠️ только HTTP Basic, JWT не подключён |
| Фронтенд: экран калькулятора | ⚠️ mock-данные, без API |
| Экраны: авторизация, список заказов, карточка, настройки | ❌ не реализованы |
| Тесты | ✅ JUnit5, `PriceCalculatorTest` (ветки, коэффициенты, прайс, округления) |

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
