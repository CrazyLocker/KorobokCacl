# Калькулятор себестоимости коробки

Многомодульный Spring Boot 3 + React проект для расчета себестоимости и цены коробок.

## Структура проекта

- **modules/core** — базовые сущности и утилиты
- **modules/security** — JWT-аутентификация и роли
- **modules/persistence** — JPA-репозитории и миграции
- **modules/calculator** — расчет себестоимости
- **modules/pricing** — наценки, налоги, скидки
- **modules/order** — заказы и история
- **modules/construct** — управление конструкциями
- **modules/api** — REST-контроллеры

## Сборка

\\\ash
./gradlew clean build
\\\

## Запуск

\\\ash
./gradlew :modules:api:bootRun
\\\

## Технологии

- Java 21
- Spring Boot 3.3.4
- PostgreSQL 15+
- Gradle (Kotlin DSL)
- React 18 + TypeScript
- Material-UI
