import js from '@eslint/js';
import react from 'eslint-plugin-react';
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
            react,
            'react-hooks': reactHooks,
            'react-compiler': reactCompiler,
            '@next/next': nextPlugin,
        },
        settings: {
            react: { version: 'detect' },
        },
        rules: {
            ...react.configs.flat.recommended.rules,
            ...react.configs.flat['jsx-runtime'].rules,
            ...reactHooks.configs.recommended.rules,
            ...nextPlugin.configs.recommended.rules,
            ...nextPlugin.configs['core-web-vitals'].rules,
            'react-compiler/react-compiler': 'error',
            'react/prop-types': 'off',
            'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
            'no-unused-vars': [
                'warn',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
        },
    },

    jsdoc.configs['flat/recommended-typescript-flavor'],
    {
        rules: {
            'jsdoc/require-jsdoc': 'off',
            'jsdoc/require-param': 'off',
            'jsdoc/require-param-type': 'off',
            'jsdoc/require-param-description': 'off',
            'jsdoc/require-returns': 'off',
            'jsdoc/require-returns-type': 'off',
            'jsdoc/require-returns-description': 'off',
            'jsdoc/no-undefined-types': 'off',
            'jsdoc/tag-lines': 'off',
            'jsdoc/reject-any-type': 'off',
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
