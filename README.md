# Калькулятор себестоимости коробки

Многомодульный Spring Boot 3 + React проект для расчета себестоимости и цены коробок.

## Структура проекта

- **modules/core** — базовые сущности и утилиты
- **modules/security** — Spring Security (HTTP Basic, CORS), JWT в планах
- **modules/persistence** — JPA-сущности, репозитории, миграции Flyway (V1–V4)
- **modules/calculator** — расчёт себестоимости (`CostCalculator`, `PrintCostCalculator`)
- **modules/pricing** — ценообразование: наценки, скидки, НДС (`PriceCalculator`)
- **modules/order** — заказы и история (пока пусто)
- **modules/construct** — управление конструкциями (пока пусто)
- **modules/api** — REST-контроллеры, DTO, `CalculatorService`, точка входа

## REST API

| Эндпоинт | Метод | Описание |
|----------|-------|----------|
| `/api/constructs` | GET | Список активных конструкций |
| `/api/constructs/{id}` | GET | Конструкция по ID |
| `/api/materials` | GET | Справочник материалов |
| `/api/operations` | GET | Справочник операций |
| `/api/calculator/calculate` | POST | Полный расчёт себестоимости и цен |
| `/api/price-lists/by-construct/{constructId}` | GET | Прайс-лист по конструкции |
| `/api/print-tables` | GET | Таблицы печати (3 формата) |

## Сборка

```bash
./gradlew clean build
```

## Запуск

```bash
# Backend
./gradlew :modules:api:bootRun

# Frontend
cd frontend
npm install
npm run dev
```

> БД PostgreSQL должна быть запущена на `localhost:5432`, БД `korobki`.
> Vite proxy: `/api` → `http://localhost:8080`.

## Технологии

- Java 21
- Spring Boot 3.3.4
- PostgreSQL 15+
- Gradle (Kotlin DSL)
- React 18 + TypeScript
- Material-UI v6
- Vite
- Axios
