# Testing Infrastructure Design

**Date**: 2026-03-26
**Status**: Draft

## Context

helldivers.bot has only basic Playwright smoke tests (5 page loads + 3 API checks). There are no unit tests, no Vitest setup, and no test utilities. The project has testable pure functions (utils, validators) and API routes that would benefit from unit coverage.

This design adds Vitest for unit testing and reorganizes the existing Playwright e2e tests to follow conventions established in the euraika/aegis, aegis-nextjs, and euraikaweb projects.

## Directory Structure

```
src/__tests__/
├── unit/                    # Vitest unit tests
│   ├── utils/               # Tests for src/utils/*
│   ├── validators/          # Tests for src/validators/*
│   └── components/          # Component tests (future)
├── e2e/                     # Playwright E2E tests
│   ├── smoke.spec.mjs       # Migrated from tests/smoke.spec.mjs
│   ├── fixtures/            # Custom Playwright fixtures
│   └── helpers/             # Shared E2E helpers
└── utils/                   # Shared test utilities
    └── index.mjs            # Mock factories, custom renders, helpers

playwright/                  # Screenshots & artifacts (.gitignored)
vitest.config.mjs            # Vitest configuration
vitest.setup.mjs             # Vitest setup (mocks for Next.js modules)
```

## Vitest Configuration

File: `vitest.config.mjs`

- **Environment**: node (default — use `// @vitest-environment jsdom` per-file for component tests)
- **Globals**: true (describe/test/expect available without import)
- **Include**: `src/__tests__/unit/**/*.{test,spec}.{js,jsx,mjs}`
- **Exclude**: `node_modules`, `src/generated/**`
- **Path aliases**: `@` → `./src` (matching jsconfig.json)
- **Coverage**:
    - Provider: v8
    - Reporters: text, html
    - Initial thresholds: 50% (lines, functions, branches, statements)
    - Excludes: `src/generated/**`, `**/*.{test,spec}.*`, `src/__tests__/**`
- **Setup file**: `vitest.setup.mjs`

### Setup File (`vitest.setup.mjs`)

Mocks for the Next.js environment:

- `next/navigation` (useRouter, usePathname, useSearchParams, redirect)
- `next/image` (renders as plain `<img>`)
- `next/link` (renders as plain `<a>`)
- `@/auth` (NextAuth v5 `auth()` — defaults to `null`/logged-out; tests override via `vi.mocked(auth).mockResolvedValue(mockSession)`)

### Prisma Mock Strategy

Tests must not require a database connection. The Prisma client (`@/generated/prisma`) is mocked globally in `vitest.setup.mjs` using `vi.mock`. A `createMockPrismaClient()` factory in `src/__tests__/utils/index.mjs` provides chainable stubs for `findMany`, `findUnique`, `create`, `update`, `delete` on each model.

### API Route Testing Pattern

App Router route handlers are tested by importing the handler directly and calling it with a standard `Request` object:

```js
import { GET } from '@/app/api/healthcheck/route';

test('returns 200 with alive: true', async () => {
    const req = new Request('http://localhost/api/healthcheck');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.alive).toBe(true);
});
```

For routes that use Prisma or auth, mock those modules first. The `createMockRequest(method, body, headers)` helper in test utils wraps `new Request()` for convenience.

## Playwright Configuration Updates

File: `playwright.config.mjs` (existing, modified)

- **testDir**: `./src/__tests__/e2e` (was `./tests`)
- **outputDir**: `./playwright/test-results`
- **Screenshot**: `only-on-failure`
- **Trace**: `on-first-retry`
- Keep chromium-only project and 30s timeout
- Keep baseURL `http://localhost:3000`

### Screenshot & Artifact Storage

All Playwright artifacts go to `playwright/` (gitignored):

- `playwright/test-results/` — test artifacts
- `playwright/screenshots/` — failure screenshots

## NPM Scripts

```json
{
    "test": "vitest run && playwright test",
    "test:unit": "vitest",
    "test:unit:run": "vitest run",
    "test:unit:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:smoke": "playwright test src/__tests__/e2e/smoke.spec.mjs"
}
```

## New Dependencies

```
vitest
@vitest/coverage-v8
@testing-library/jest-dom
```

`jsdom` and `@testing-library/react` are deferred until component testing begins. For now, all tests run in `node` environment targeting pure functions, validators, and API route handlers.

## .gitignore Additions

```gitignore
# Playwright artifacts
playwright/
.playwright-mcp/
```

Note: `/coverage`, `/test-results/`, `/playwright-report/` already gitignored.

## Test Naming Conventions

| Type         | Pattern      | Location                      |
| ------------ | ------------ | ----------------------------- |
| Unit test    | `*.test.mjs` | `src/__tests__/unit/`         |
| E2E test     | `*.spec.mjs` | `src/__tests__/e2e/`          |
| E2E fixture  | `*.mjs`      | `src/__tests__/e2e/fixtures/` |
| E2E helper   | `*.mjs`      | `src/__tests__/e2e/helpers/`  |
| Test utility | `*.mjs`      | `src/__tests__/utils/`        |

## Test Utilities (`src/__tests__/utils/index.mjs`)

Scaffold with helpers for the two main testing seams:

- `createMockRequest(url, method, body, headers)` — wraps `new Request()` for API route handler tests
- `createMockSession(overrides)` — mock NextAuth v5 session object with sensible defaults
- `createMockPrismaClient()` — returns a Prisma client stub with `vi.fn()` on all model methods

## Migration Plan

1. Move `tests/smoke.spec.mjs` → `src/__tests__/e2e/smoke.spec.mjs`
2. Delete empty `tests/` directory
3. Update `playwright.config.mjs` testDir
4. Add `vitest.config.mjs` and `vitest.setup.mjs`
5. Update `package.json` scripts and devDependencies
6. Update `.gitignore`
7. Add starter unit test for `src/utils/tryCatch.mjs` to validate setup works

## Verification

1. `npm run test:unit:run` — Vitest runs and passes
2. `npm run test:smoke` — Playwright smoke tests pass (after migration)
3. `npm run test:unit:coverage` — Coverage report generates
4. `npm run build` — Build still succeeds
