import js from '@eslint/js';
import eslintReact from '@eslint-react/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import reactCompiler from 'eslint-plugin-react-compiler';
import nextPlugin from '@next/eslint-plugin-next';
import jsdoc from 'eslint-plugin-jsdoc';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';

export default [
    {
        ignores: [
            'src/generated/**',
            '.next/**',
            'public/sw.js',
            'public/workers/**',
            'node_modules/**',
            'coverage/**',
            'dist/**',
            '.serwist/**',
        ],
    },

    js.configs.recommended,

    // @eslint-react replaces the unmaintained-for-eslint-10 eslint-plugin-react.
    // Its recommended preset covers the JSX correctness rules (keys, no unknown
    // property, etc.); it applies only to jsx/tsx files by default.
    eslintReact.configs.recommended,

    {
        files: ['**/*.{js,mjs,jsx}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parserOptions: {
                ecmaFeatures: { jsx: true },
            },
            globals: {
                ...globals.browser,
                ...globals.node,
            },
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-compiler': reactCompiler,
            '@next/next': nextPlugin,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            ...nextPlugin.configs.recommended.rules,
            ...nextPlugin.configs['core-web-vitals'].rules,
            'react-compiler/react-compiler': 'warn',
            'react-hooks/set-state-in-effect': 'off',
            'react-hooks/set-state-in-render': 'off',
            'react-hooks/purity': 'off',
            'react-hooks/refs': 'off',
            'react-hooks/static-components': 'off',
            // @eslint-react re-implements several of the react-hooks opinions
            // above; keep parity with the choices already made for this codebase
            // (React Compiler handles set-state-in-effect churn; the Footer/SSR
            // date is intentional).
            '@eslint-react/set-state-in-effect': 'off',
            '@eslint-react/purity': 'off',
            'no-console': ['warn', { allow: ['warn', 'error', 'info', 'debug'] }],
            'no-unused-vars': [
                'warn',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
        },
    },

    {
        files: [
            'scripts/**',
            'prisma/seed/**',
            'src/__tests__/**',
            'vitest.setup.mjs',
            '*.config.{js,mjs}',
        ],
        rules: {
            'no-console': 'off',
        },
    },

    jsdoc.configs['flat/recommended-typescript-flavor'],
    {
        rules: {
            'jsdoc/require-jsdoc': 'off',
            'jsdoc/require-param': 'off',
            'jsdoc/require-param-type': 'off',
            'jsdoc/require-param-description': 'warn',
            'jsdoc/require-returns': 'off',
            'jsdoc/require-returns-type': 'off',
            'jsdoc/require-returns-description': 'off',
            'jsdoc/no-undefined-types': 'off',
            'jsdoc/tag-lines': 'off',
            'jsdoc/reject-any-type': 'warn',
            'jsdoc/reject-function-type': 'off',
            'jsdoc/no-defaults': 'off',
            'jsdoc/check-param-names': 'warn',
            'jsdoc/check-tag-names': 'warn',
            'jsdoc/check-types': 'warn',
            'jsdoc/valid-types': 'warn',
        },
    },

    {
        files: [
            '**/*.test.{js,mjs,jsx}',
            '**/__tests__/**',
            'vitest*.config.*',
            'vitest.setup.mjs',
        ],
        languageOptions: {
            globals: {
                ...globals.node,
                vi: 'readonly',
                describe: 'readonly',
                it: 'readonly',
                test: 'readonly',
                expect: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                beforeAll: 'readonly',
                afterAll: 'readonly',
            },
        },
    },

    {
        files: ['src/sw.js'],
        languageOptions: {
            globals: globals.serviceworker,
        },
    },

    prettierRecommended,
];
