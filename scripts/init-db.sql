-- Создание роли и базы для альфа-версии.
--
-- Пароль передаётся переменной, чтобы он не попал в репозиторий:
--   psql -U postgres -v app_password='ваш-пароль' -f scripts/init-db.sql
-- Скрипт идемпотентен: повторный запуск ничего не ломает.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'korobki') THEN
        CREATE ROLE korobki LOGIN;
    END IF;
END
$$;

ALTER ROLE korobki PASSWORD :'app_password';

SELECT 'CREATE DATABASE korobki OWNER korobki'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'korobki')
\gexec

-- Расчёт создаёт таблицы через Flyway при старте приложения, поэтому
-- схему руками трогать не нужно.
