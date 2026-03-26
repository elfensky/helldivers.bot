# Testing

Technical reference for the helldivers.bot testing infrastructure. Audience: project owner and AI assistants.

---

## Section 1: Overview

The project uses two testing frameworks:

- **Vitest** — unit tests for utilities, validators, and API route handlers
- **Playwright** — end-to-end smoke tests against a running dev server

Tests live in `src/__tests__/` following conventions from the euraika/aegis projects.

---

## Section 2: Directory Structure

```
src/__tests__/
├── unit/                    # Vitest unit tests
│   ├── utils/               # Tests for src/utils/*
│   ├── validators/          # Tests for src/validators/*
│   └── components/          # Component tests (future, requires jsdom)
├── e2e/                     # Playwright E2E tests
│   ├── smoke.spec.mjs       # Page loads + API endpoint checks
│   ├── fixtures/             # Custom Playwright fixtures
│   └── helpers/              # Shared E2E helpers
└── utils/                   # Shared test utilities
    └── index.mjs            # Mock factories and helpers
```

Root-level config files:

| File                | Purpose                                   |
| ------------------- | ----------------------------------------- |
| `vitest.config.mjs` | Vitest configuration (env, aliases, coverage) |
| `vitest.setup.mjs`  | Global mocks (auth, Prisma, Next.js modules)  |
| `playwright.config.mjs` | Playwright configuration (testDir, artifacts) |

---

## Section 3: NPM Scripts

| Script               | Description                                      |
| -------------------- | ------------------------------------------------ |
| `npm test`           | Run all unit tests then all E2E tests            |
| `npm run test:unit`  | Vitest in watch mode (for local TDD)             |
| `npm run test:unit:run` | Vitest single run (for CI)                    |
| `npm run test:unit:coverage` | Vitest with v8 coverage report           |
| `npm run test:e2e`   | Playwright full suite                            |
| `npm run test:e2e:ui` | Playwright with interactive UI                  |
| `npm run test:smoke` | Playwright smoke tests only                      |

**Note:** `test:unit` runs in interactive watch mode by default — use `test:unit:run` for CI or single execution.

**Note:** E2E tests require a running dev server at `http://localhost:3000`. Never start the dev server from Claude — ask the user.

---

## Section 4: Vitest Configuration

**Environment:** `node` (default). Component tests opt in to `jsdom` via per-file comment:

```js
// @vitest-environment jsdom
```

**Globals:** `true` — `describe`, `test`, `expect`, `vi` are available without import.

**Path aliases:**

- `@` → `./src` (matches `jsconfig.json`)
- `@test-utils` → `./src/__tests__/utils`

**Coverage:**

- Provider: v8
- Reporters: text, html
- Excludes: `src/generated/**`, test files, `src/__tests__/**`, malformed enum files

No global thresholds are set yet — add them once meaningful coverage exists.

---

## Section 5: Global Mocks (vitest.setup.mjs)

The setup file runs before each test file and provides mocks for:

### NextAuth v5

```js
// Default: logged out (null session)
// Override in tests:
import { auth } from '@/auth';
vi.mocked(auth).mockResolvedValue(createMockSession());
```

### Prisma Client

All models from the schema are mocked with stub CRUD methods (`findMany`, `findUnique`, `create`, `update`, `delete`, etc.). The mock targets `@/db/db` (the singleton export).

```js
import db from '@/db/db';
vi.mocked(db.h1_season.findMany).mockResolvedValue([{ id: 1, season: 1 }]);
```

### Next.js Modules

- `next/navigation` — `useRouter`, `usePathname`, `useSearchParams`, `redirect`, `notFound`
- `next/headers` — `headers`, `cookies`
- `next/image` — passthrough (no optimization)
- `next/link` — passthrough

All mocks are cleared via `vi.clearAllMocks()` in `beforeEach`.

---

## Section 6: Test Utilities

Location: `src/__tests__/utils/index.mjs` (importable as `@test-utils`)

### createMockRequest(url, method, body, headers)

Wraps `new Request()` for API route handler tests. Sets `content-type: application/json` by default.

### createMockSession(overrides)

Returns a NextAuth v5 session object with sensible defaults (test user, 24h expiry). Merge overrides for custom scenarios.

### createMockModel()

Returns a Prisma model stub with all standard CRUD methods as `vi.fn()`. Useful for ad-hoc mocks beyond what `vitest.setup.mjs` provides.

---

## Section 7: Test Naming Conventions

| Type        | Pattern       | Location                      |
| ----------- | ------------- | ----------------------------- |
| Unit test   | `*.test.mjs`  | `src/__tests__/unit/`         |
| E2E test    | `*.spec.mjs`  | `src/__tests__/e2e/`          |
| E2E fixture | `*.mjs`       | `src/__tests__/e2e/fixtures/` |
| E2E helper  | `*.mjs`       | `src/__tests__/e2e/helpers/`  |
| Test utility | `*.mjs`      | `src/__tests__/utils/`        |

---

## Section 8: API Route Testing Pattern

App Router route handlers are tested by importing the handler directly:

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

For routes that depend on Prisma or auth, mock those modules first — the global mocks in `vitest.setup.mjs` handle the defaults.

---

## Section 9: Playwright Configuration

- **Test directory:** `./src/__tests__/e2e`
- **Artifacts:** `./playwright/test-results/` (gitignored via `/playwright/`)
- **Screenshots:** only on failure
- **Traces:** on first retry
- **Browser:** Chromium only
- **Base URL:** `http://localhost:3000`

---

## Section 10: Gitignore

Test artifacts are excluded from version control:

```
/coverage            # Vitest coverage reports
/test-results/       # Legacy Playwright output
/playwright-report/  # Playwright HTML report
/playwright/         # Playwright screenshots & artifacts
.playwright-mcp/     # Playwright MCP state
```
