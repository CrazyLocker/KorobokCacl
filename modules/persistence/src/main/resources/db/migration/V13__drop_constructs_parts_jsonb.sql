-- ============================================================
-- V13: remove the legacy JSONB parts column
-- ============================================================

ALTER TABLE constructs DROP COLUMN parts;
