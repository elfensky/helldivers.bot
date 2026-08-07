import js from '@eslint/js';
import eslintReact from '@eslint-react/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import reactCompiler from 'eslint-plugin-react-compiler';
import nextPlugin from '@next/eslint-plugin-next';
import jsdoc from 'eslint-plugin-jsdoc';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import compat from 'eslint-plugin-compat';
import globals from 'globals';

export default [
    {
        ignores: [
            'src/generated/**',
            'src/features/dashboard/waveModel.mjs', // emitted by scripts/analysis/08
            'src/features/dashboard/attackModel.mjs', // emitted by scripts/analysis/11
            '.next/**',
            'public/sw.js',
            'public/workers/**',
            'node_modules/**',
            'coverage/**',
            'dist/**',
            '.serwist/**',
            // Each worktree holds a full copy of src/, so without this a lint
            // run in the main checkout also lints every branch checked out
            // under .worktrees/ — results would depend on which worktrees
            // happen to exist.
            '.worktrees/**',
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
            // Duplicate of react-hooks/exhaustive-deps, which is the rule this
            // codebase already annotates against (Hijackable, LiveToasts have
            // documented run-once disables). Keep one source of truth.
            '@eslint-react/exhaustive-deps': 'off',
            // Doesn't recognize the ref-stored-interval + cleanup pattern used
            // here (GlitchText clearTimers, slot-counter) — every flagged
            // interval IS cleared in its effect cleanup, so this only fires
            // false positives.
            '@eslint-react/web-api-no-leaked-interval': 'off',
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

    // Browser-API support checked against the `browserslist` key in
    // package.json. Scoped to code that actually ships to a browser — server
    // routes, queries and the update pipeline run on Node 24 and would report
    // false positives.
    //
    // KNOWN BLIND SPOT: this plugin covers Web/DOM APIs well but misses some
    // ES built-ins. Verified by probe: it flags Array.toSorted() and
    // URLPattern, but NOT Map.groupBy — the one API that actually broke a
    // browser here (#495). A green run is not proof; new ES built-ins still
    // need a look.
    {
        files: ['src/features/**', 'src/shared/**', 'src/sw.js'],
        ...compat.configs['flat/recommended'],
    },

    // The blind spot above, closed by hand for the built-ins that actually
    // bit. compat can't see these, so nothing else would catch a reintroduction
    // until it reached a Firefox 115 user (#495).
    {
        files: ['src/features/**', 'src/shared/**', 'src/app/**', 'src/sw.js'],
        ignores: ['src/shared/utils/groupBy.mjs'],
        rules: {
            'no-restricted-syntax': [
                'error',
                {
                    selector:
                        "MemberExpression[object.name=/^(Map|Object)$/][property.name='groupBy']",
                    message:
                        'Map/Object.groupBy ships in Chrome 117 / Firefox 119, past this project’s support floor. Use groupBy() from @/shared/utils/groupBy.mjs.',
                },
            ],
        },
    },

    prettierRecommended,
];
