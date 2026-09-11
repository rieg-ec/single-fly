import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';

export default defineConfig([
  globalIgnores(['dist-pages/**', '.pnpm-store/**', 'coverage/**', 'public/brain/worker.mjs', 'public/brain/hash/**']),
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,jsx,mjs,ts,tsx,mts}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { react, 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/no-unknown-property': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/jsx-no-target-blank': 'off',
      'jsx-a11y/alt-text': 'warn',
      'jsx-a11y/aria-props': 'warn',
      'jsx-a11y/aria-proptypes': 'warn',
      'jsx-a11y/aria-unsupported-elements': 'warn',
      'jsx-a11y/role-has-required-aria-props': 'warn',
      'jsx-a11y/role-supports-aria-props': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
    },
  },
  {
    files: ['components/ui/**/*.{ts,tsx}', 'hooks/use-mobile.ts'],
    rules: {
      // Preserve the vendored shadcn source without applying these stricter rules.
      '@typescript-eslint/no-unused-vars': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);
