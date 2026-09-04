-- V10: Deactivate operations that must not appear in the calculator
-- (print is configured in its own block; lamination/varnish/blister/gluing are out of scope)
UPDATE operations SET is_active = false WHERE name IN (
    'Печать (офсет)',
    'Печать (цифра)',
    'Ламинация (глянец)',
    'Ламинация (мат)',
    'УФ-лак',
    'Блистер',
    'Оклейка'
);
