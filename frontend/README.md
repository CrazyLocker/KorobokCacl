# Frontend — Калькулятор себестоимости коробки

React 18 + TypeScript + Vite + Material-UI v6.

## Запуск

```bash
npm install
npm run dev      # dev-сервер на http://localhost:5173
npm run build    # production-сборка
npm run lint     # ESLint
```

> Vite proxy: `/api` → `http://localhost:8080` (backend должен быть запущен).

## Структура `src/`

- `main.tsx` — точка входа
- `App.tsx` — главный экран калькулятора
- `api/calculatorApi.ts` — HTTP-клиент (axios): calculate, constructs, print-tables, price-lists
- `hooks/useCalculator.ts` — состояние калькулятора + вызовы API
- `types/index.ts` — TypeScript-типы
- `components/Calculator/` — `ConstructionSelector`, `LayoutTable`, `ExtrasBlock`, `PriceTable`
- `components/Layout/` — `Header`, `Layout`
- `components/BoxCalculator/` — legacy-компоненты (не используются)

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```
