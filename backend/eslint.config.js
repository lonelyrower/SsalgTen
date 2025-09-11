import js from '@eslint/js';
import tsEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      },
      // Enable Node.js globals to avoid no-undef on process, require, setTimeout, etc.
      globals: {
        ...globals.node,
        URL: 'readonly',
      }
    },
    plugins: {
      '@typescript-eslint': tsEslint,
      prettier: prettier
    },
    rules: {
      ...tsEslint.configs.recommended.rules,
      ...prettierConfig.rules,
      'prettier/prettier': 'error',
      // Rely on TypeScript for undefined checks
      'no-undef': 'off',
      // Allow occasional require() usage in Node contexts
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      'no-console': 'off'
    }
  }
];
