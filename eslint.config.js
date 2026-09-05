import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'stress-test.ts'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: [
      'src/components/ui/command.tsx',
      'src/components/ui/input.tsx',
      'src/components/ui/textarea.tsx',
    ],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  {
    files: ['src/lib/analyzer/code-intelligence.ts'],
    rules: {
      'no-useless-escape': 'off',
    },
  },
  {
    files: ['src/lib/analyzer/detectors.ts'],
    rules: {
      'no-empty': 'off',
    },
  },
  {
    files: [
      'src/lib/analyzer/zip.ts',
      'src/lib/compatibility/rules/extended-structure.ts',
    ],
    rules: {
      'no-control-regex': 'off',
    },
  },
  {
    files: ['src/components/reports/ScoreRing.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: [
      'src/components/ui/badge.tsx',
      'src/components/ui/button.tsx',
      'src/components/ui/form.tsx',
      'src/components/ui/navigation-menu.tsx',
      'src/components/ui/toggle.tsx',
    ],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['src/pages/ReportPage.tsx'],
    rules: {
      'react-hooks/exhaustive-deps': 'off',
    },
  },
);
