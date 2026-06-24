import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
    globalIgnores(['dist', 'src/routeTree.gen.ts']),
    {
        files: ['**/*.{ts,tsx}'],
        extends: [
            js.configs.recommended,
            tseslint.configs.recommended,
            reactHooks.configs.flat.recommended,
            reactRefresh.configs.vite,
            prettier,
        ],
        languageOptions: {
            globals: globals.browser,
        },
    },
    {
        // shadcn-generated UI components conventionally export non-component
        // helpers (cva variants, etc.) alongside the component itself.
        files: ['src/components/ui/**'],
        rules: {
            'react-refresh/only-export-components': 'off',
        },
    },
    {
        // TanStack Router route files export `Route` (a non-component) and may
        // define their route component inline (e.g. `__root.tsx`).
        files: ['src/routes/**'],
        rules: {
            'react-refresh/only-export-components': 'off',
        },
    },
])
