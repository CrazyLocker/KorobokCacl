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

-- База создаётся в UTF8 из template0, поэтому кодировка не зависит от шаблона
-- кластера: на кластере с WIN1251 база всё равно будет UTF8.
SELECT 'CREATE DATABASE korobki OWNER korobki ENCODING ''UTF8'' TEMPLATE template0'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'korobki')
\gexec

-- Расчёт создаёт таблицы через Flyway при старте приложения, поэтому
-- схему руками трогать не нужно.
