# Калькулятор себестоимости коробки

Многомодульный Spring Boot 3 + React проект для расчёта себестоимости и цены коробок.

## Что умеет

- Расчёт себестоимости по деталям: материал (₽/лист ÷ шт/лист) + работа + доп. операции + печать ÷ тираж,
  затем наценка, скидки по тирам и НДС.
- Два режима печати: печать по деталям и «сборка на печатный лист».
- Сохранение расчётов с деревом версий, ветвление от любой версии, мягкое удаление зачёркиванием.
- Клиенты и заказы: заказ «прорастает» из выбранной версии расчёта, история версий остаётся на месте.
- Справочники: конструкции, операции, прайсы, таблицы печати, клиенты; импорт/экспорт JSON.
- Расчёт ножа по SVG и раскладка деталей на листе.

## Структура проекта

- **modules/core** — базовые сущности и утилиты
- **modules/security** — Spring Security: одна учётная запись ADMIN, CORS для dev-сервера
- **modules/persistence** — JPA-сущности, репозитории, миграции Flyway (V1–V23)
- **modules/calculator** — расчёт себестоимости (`CostCalculator`, `PrintCostCalculator`)
- **modules/pricing** — ценообразование: наценки, скидки, НДС (`PriceCalculator`)
- **modules/order** — домен заказов
- **modules/construct** — домен конструкций
- **modules/api** — REST-контроллеры, DTO, сервисы, точка входа

## Требования

- JDK 21 (проверено на Temurin 21.0.11)
- Node.js 22 + npm 10
- PostgreSQL 15+ (проверено на 18.6), БД `korobki`

## Установка

```powershell
# 1. Роль и база (идемпотентно, пароль передаётся переменной и не попадает в git)
psql -U postgres -v app_password='пароль-роли' -f scripts/init-db.sql

# 2. Локальный запуск: положите application-local.yml в корень проекта (в .gitignore)
#    или задайте DB_PASSWORD в env
Copy-Item scripts\env.example .env   # только для нестандартных кредов

# 3. Схема создаётся сама: Flyway прогонит V1–V23 при первом старте
.\scripts\dev-env.ps1 -Run
```

Пароля БД в `application.yml` нет (`password: ${DB_PASSWORD:}`): локальные креды живут в
`application-local.yml` в корне проекта (в `.gitignore`, подхватывается через `spring.config.import`,
в jar не попадает) либо приходят из `DB_PASSWORD`; переменная окружения имеет приоритет.
Без пароля приложение не стартует — подключение к БД падает с ошибкой аутентификации.
Если при старте ошибка `The server requested SCRAM-based authentication, but no password was provided` —
не задан `DB_PASSWORD` и нет `./application-local.yml` в корне проекта.

Аутентификации на альфе нет: всё API открыто, защита — только петлевой интерфейс
и CORS. Это принятый риск (P0-1 в `docs/alpha-readiness-review.md`).

## Запуск для разработки (две консоли)

```powershell
# консоль 1 — бэкенд на 127.0.0.1:8080
.\scripts\dev-env.ps1 -Run

# консоль 2 — фронтенд с прокси /api → localhost:8080
cd frontend
npm install
npm run dev
```

## Запуск альфа-сборки

```powershell
cd frontend; npm run build; npm run preview   # dist на 5173 (+ тот же прокси)
.\scripts\dev-env.ps1 -Run                    # бэкенд на 127.0.0.1:8080
```

## Запуск альфа-артефакта

```powershell
.\gradlew.bat :modules:api:bootJar
cd modules\api\build\libs
$env:DB_PASSWORD = '<пароль>'
java -jar api-1.0.0.jar
```

Запуск из каталога с jar: пароль приходит только из `DB_PASSWORD`, файл `application-local.yml`
рядом с jar не нужен. Остальное — дефолты `application.yml`: `localhost:5432/korobki`, пользователь
`postgres` (переопределяется `DB_USER`), порт 8080.

## REST API

Чтение (`GET /api/**`) открыто, всё изменяющее требует роль ADMIN (HTTP Basic).

| Эндпоинт | Метод | Описание |
|----------|-------|----------|
| `/api/constructs` | GET | Список активных конструкций |
| `/api/constructs/{id}` | GET | Конструкция по ID |
| `/api/operations` | GET | Справочник операций |
| `/api/calculator/calculate` | POST | Полный расчёт себестоимости и цен |
| `/api/price-lists/by-construct/{constructId}` | GET | Прайс-лист по конструкции |
| `/api/print-tables` | GET | Таблицы печати |
| `/api/calculations/save` | POST | Сохранить расчёт (v1) |
| `/api/calculations/{id}/iterate` | POST | Сохранить правку как новую версию |
| `/api/calculations/list` | GET | Расчёты (одна строка на дерево) |
| `/api/calculations/{id}/versions` | GET | Дерево версий (плоско, с `parentId`) |
| `/api/calculations/tree` | GET | Дерево клиент → заказ + расчёт |
| `/api/calculations/{id}` | DELETE | Пометить версию и подветки удалёнными |
| `/api/calculations/purge` | POST | Стереть помеченные версии из базы |
| `/api/orders`, `/api/orders/{id}` | GET | Заказы и заказ |
| `/api/orders` | POST | Создать заказ из версии расчёта |
| `/api/orders/{id}` | PUT | Изменить номер, дату, статус, комментарий |
| `/api/orders/{id}` | DELETE | Пометить заказ удалённым |
| `/api/orders/purge` | POST | Стереть помеченные заказы |
| `/api/customers` | GET / POST | Клиенты |
| `/api/customers/{id}` | PUT | Переименовать/скрыть клиента |

## Тесты

```powershell
.\gradlew.bat test          # бэкенд
cd frontend; npm test       # фронтенд
```

## Известные ограничения альфы

- Клише, конгрев и шелкография — заглушки разделов, расчёт по ним не ведётся.
- Данные конструкций не подтверждены технологом: Эгеон 4/25/42 (perSheet крышки ПВХ = 0),
  Этне 4 (perSheet 6/30), Этне 10 (Шубер 8 или 10), Нереида 4 («Дно + Разделитель»).
- Детали, пришедшие из раскладки, попадают в расчёт с `sheetPrice = 0`: материал в себестоимость не входит,
  пока материал не выбирается в интерфейсе.
- Откат изменений — только из дампа базы (`pg_dump`), кнопки «отменить миграцию» нет.
- Swagger в альфе отключён; полного аудита действий пользователя нет.

## Технологии

- Java 21, Spring Boot 3.3.4, Spring Security (HTTP Basic)
- PostgreSQL 15+, Flyway, Spring Data JPA, Gradle (Kotlin DSL)
- React 18 + TypeScript, Ant Design 6, Vite, Axios
