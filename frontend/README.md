# Frontend — Калькулятор себестоимости коробки

React 18 + TypeScript + Vite + Ant Design v6.

## Запуск

```bash
npm ci           # установка зависимостей строго по package-lock.json
npm run dev      # dev-сервер на http://localhost:5173
npm run build    # production-сборка (tsc -b && vite build)
npm run lint     # ESLint (flat config, typescript-eslint)
npm run test     # unit-тесты (vitest run)
npm run preview  # локальный просмотр production-сборки
```

> Vite proxy: `/api` → `http://localhost:8080` (backend должен быть запущен).

## Структура `src/`

- `main.tsx` — точка входа
- `App.tsx` — хост приложения: рендер активной страницы по `navigation.ts`, `AppShell`, модалка сохранения расчёта, уведомления через Ant Design `App`-контекст
- `api/calculatorApi.ts` — HTTP-клиент (axios): `calculate`, `calculateKnife`, constructs / price-lists / print-tables / operations (get/save/update/delete), сохранённые расчёты и ножи, импорт справочников
- `hooks/useCalculator.ts` — состояние калькулятора + вызовы API
- `types/index.ts` — TypeScript-типы (`Detail`, `Extra`, `PrintSettings`, `CalculationRequest`/`CalculationResponse`, `PriceRow`, `PrintTable`, `PriceListData`, `Construct`, `ConstructPart`, `Operation`, `SavedCalculation`, `SavedKnife`, …)
- `utils/calculationRequest.ts` — `createDetailUiKey()`, `toApiDetails()` (маппинг UI-деталей в запрос API); тест рядом — `calculationRequest.spec.ts`
- `navigation.ts` — `PageType`, `PAGE_PATHS`, `NAV_ITEMS`, `pageFromPath()` (URL ↔ страница, back/forward)
- `antdTheme.ts` — тема Ant Design v6 (`antdTheme`)
- `designTokens.ts` — дизайн-токены (`fontFamily`, `tokens`)

### Компоненты (`src/components/`)

- `components/Calculator/CalculatorPage.tsx` — экран «Расчет коробки»
- `components/Calculator/SaveCalculationModal.tsx` — модалка сохранения расчёта
- `components/Layout/AppShell.tsx` — Ant Design shell: боковая навигация, шапка, контент
- `components/References/ReferencesPage.tsx` — «Справочники» с вкладками:
  `ConstructionsTab.tsx`, `PriceListTab.tsx`, `PrintTablesTab.tsx`
- `components/Settings/SettingsPage.tsx` — «Настройки»
- `components/DevStub.tsx` — заглушка для ещё не реализованных страниц (клише, конгрев, шелкография)

### Feature-модули (`src/features/`)

- `features/knife/ui/KnifePage.tsx` — «Расчет ножа» (dropzone → `/api/knife/calculate`, тип `KnifeResult`)
- `features/layout/` — «Раскладка»:
  - `ui/LayoutPage.tsx` — параметры листа + деталь/список деталей, превью раскладки
  - `ui/LayoutSvg.tsx`, `ui/LayoutSvgSingle.tsx` — отрисовка результата (multi / single режим)
  - `engine/` — расчётный движок: `packParts.ts`, `gridLayout.ts`, `validate.ts`, `index.ts` (публичный фасад)
  - `hooks/useLayout.ts` — состояние страницы раскладки
  - `model/` — `types.ts`, `constants.ts`, `rng.ts`, `enc-probe.ts`
  - `tests/` — `packParts.spec.ts`, `fixtures.ts`

Статика: `assets/` (`hero.png`), глобальные стили — `index.css`.

## Линтинг

`eslint.config.js` — flat config для ESLint 8 + `typescript-eslint`
(`js.configs.recommended`, `tseslint.configs.recommended`, плагины `react-hooks`
и `react-refresh`). Правило `@typescript-eslint/no-explicit-any` пока в режиме
`warn` — это baseline миграции на Ant Design, поэтому `npm run lint` проходит
с предупреждениями, но без ошибок.

