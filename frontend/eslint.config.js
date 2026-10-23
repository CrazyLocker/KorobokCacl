import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

// ESLint 8 flat config + typescript-eslint 8.
// eslint/config (defineConfig/globalIgnores) is only available in ESLint 9+,
// so the config is composed with tseslint.config instead.
export default tseslint.config(
  { ignores: ['dist'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...reactRefresh.configs.vite.rules,
      // TODO(antd-migration): убрать baseline-предупреждения при переписывании
      // соответствующих страниц. На Этапе 0 они не блокируют lint, чтобы
      // инфраструктурный PR не превращался в правку всех страниц.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
)
