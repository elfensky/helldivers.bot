# Testing Patterns

**Analysis Date:** 2026-08-28

## Test Frameworks

**Unit / integration runner:**
- Vitest, config `vitest.config.mjs`. Environment: `node`, `globals: true` (no explicit `import { describe, test, expect } from 'vitest'` required, though many files still import explicitly), setup file `./vitest.setup.mjs` (see Mocking below).
- Includes: `src/__tests__/unit/**/*.{test,spec}.{js,jsx,mjs}`.
- Assertion library: Vitest's built-in `expect`, extended with `@testing-library/jest-dom/vitest` matchers (loaded in `vitest.setup.mjs`).
- Component testing: `@testing-library/react` + `@testing-library/user-event`.

**Smoke tests:**
- Config `vitest.smoke.config.mjs`. Plain Vitest + `fetch` against a running server — **no Playwright, no browser**.
- Includes: `src/__tests__/smoke/**/*.{test,spec}.{js,jsx,mjs}`. `testTimeout: 30_000`.
- Requires a live server on `:3000` (or `TEST_SERVER_URL`); **fails** if none is reachable. `SMOKE_ALLOW_SKIP=1` skips instead of failing.
- `npm run test:smoke` and `npm run test:e2e` are the same command (aliases) — do not treat "e2e" as implying Playwright/browser automation here.

**Visual regression:**
- Config `vitest.visual.config.mjs` — Vitest **browser mode** via `@vitest/browser-playwright`, headless Chromium.
- Includes: `src/__tests__/visual/**/*.visual.{test,spec}.{js,jsx,mjs}`, setup file `src/__tests__/visual/setup.mjs`.
- Screenshot comparison: `toMatchScreenshot` with `comparatorName: 'pixelmatch'`, `allowedMismatchedPixelRatio: 0.01` (tolerates antialiasing noise, still catches a moved/recolored element).
- **Must run inside the official Playwright Docker image** (`mcr.microsoft.com/playwright:v1.62.1-noble`) — baseline PNGs are platform-specific (font rendering/antialiasing differ macOS vs Linux), so any other environment fails on noise, not regressions.
- Local runner: `./scripts/visual-tests.sh` (invoked via `npm run test:visual` / `npm run test:visual:update` with `--update`). Mounts the repo read-write, keeps `node_modules` in a **named Docker volume** (`hd1-visual-modules`) rather than a bind mount, because host macOS-built binaries (esbuild, rollup, lightningcss) can't execute on Linux. Re-runs `npm ci` inside the container whenever `package-lock.json` changes (tracked via a `.lockstamp` file) so screenshots are never taken against a stale dependency tree.
- Module aliasing specific to this config: `next/image` and `next/link` are swapped for stubs under `src/__tests__/visual/stubs/` (Vite isn't a Next server — `next/image` emits URLs nothing here serves, `next/link` needs router context), and `@sentry/nextjs` is stubbed (touches `process.env` at import time, which no browser has, reached via `ComponentErrorBoundary`).
- Test files observed: `src/__tests__/visual/DashboardClient.visual.test.jsx`, `EventCard.visual.test.jsx`, `StatGrid.visual.test.jsx`. Baselines committed under `src/__tests__/visual/__screenshots__/`.
- Not part of `npm run test:unit`. Full detail: `/docs/testing`, `src/__tests__/visual/README.md`.

**Run commands (`package.json`):**
```bash
npm run test              # vitest run (alias of test:unit)
npm run test:unit         # vitest run — unit suite, single pass
npm run test:coverage     # vitest run --coverage
npm run test:e2e          # vitest run --config vitest.smoke.config.mjs
npm run test:smoke        # same as test:e2e
npm run test:all          # unit + smoke sequentially
npm run test:visual       # ./scripts/visual-tests.sh (Docker)
npm run test:visual:update # ./scripts/visual-tests.sh --update (rewrite baselines)
```

## Test File Organization — Mirror Tree (mandatory)

**The unit test tree mirrors the source tree exactly.** Rule, enforced mechanically (filesystem-only, no import parsing) by `src/__tests__/unit/_meta/mirrorTree.test.mjs`:

> A test at `unit/<dir>/<Base>[.<qualifier>].test.<ext>` must have a source file at `<root>/<dir>/<Base>.*` or `<root>/<dir>/<Base>/{<Base>,index}.*`, for `<root>` in `{src, public}`.

- **Both source shapes are accepted** because `src/shared/components/` mixes them (flat files and per-component folders) — put the test wherever the source module actually lives.
- **Module name** = everything before the first dot in the test filename: `StatGrid.StatCard.test.jsx` claims module `StatGrid`; `route.test.mjs` claims `route`.
- **The optional `.<qualifier>` segment** covers cases the bare 1:1 rule can't:
  - **Multiple tests per module** — `actions.apiKeys.test.mjs` + `actions.userData.test.mjs` both cover `features/account/actions.mjs`.
  - **Testing a named export of a differently-named host file** — `StatGrid.StatCard.test.jsx` tests `StatCard`, which is exported from `StatGrid.jsx`. **Name the qualifier after the host file, not the export.**
- **Three name-based escape hatches** (no allowlist to maintain):

| Pattern | Use for |
|---|---|
| `unit/_meta/**` | tests of the repo itself (`package.json`, `jsconfig`, `.example.env`) |
| `*.contract.test.*` | a contract spanning several modules (e.g. the v1 pagination contract) |
| `*.integration.test.*` | a test exercising several modules together |

- **Do not reach for an escape hatch to dodge a move.** A test that imports many modules but is *about* one still belongs next to that one.
- A new source file requires its test at the exact mirrored path or `npm run test:unit` fails on the `_meta/mirrorTree.test.mjs` assertion, which names each orphan test AND the source path it expected.

**Observed unit test tree** (`src/__tests__/unit/`): `_meta/`, `app/` (`api`, `docs`, `sign-in`), `config/`, `db/queries/`, `features/` (`account`, `admin`, `archives`, `dashboard`, `galaxy`, `ministry`, `notifications`, `stats`, `timeline`), `shared/` (`components`, `enums`, `hooks`, `preferences`, `utils`), `update/`, `validators/`, `workers/`.

## Mocking (`vitest.setup.mjs`)

Global mocks are installed once in `vitest.setup.mjs` (applies to every unit test file), organized in `#region` comment blocks:

- **Environment fixes:** a `MemoryStorage` class polyfills `localStorage`/`sessionStorage` in jsdom environments — Node 22+'s experimental Web Storage global shadows jsdom's own populate step, leaving `localStorage === undefined` in `@vitest-environment jsdom` files otherwise.
- **Auth mocks:** `@/auth` (server, `auth.api.getSession/revokeSession/revokeSessions`) and `@/auth-client` (client, `signIn`/`signOut`/`useSession`) both default to logged-out (`null`/`{ data: null, isPending: false }`). Override per test: `vi.mocked(auth.api.getSession).mockResolvedValue({ user: {...} })`.
- **Prisma client mock:** `@/db/db`'s `default` export is fully stubbed via a `createModelMock()` factory (`findMany`→`[]`, `findUnique`/`findFirst`→`null`, `create`/`update`/`upsert`/`delete`→`{}`, `count`→`0`, etc.) applied to every model used in the app (auth models, `settings`, `apiKey`, all `h1_*` tables, `worker_heartbeat`, `push_subscription`, `api_rate_limit`), plus `$transaction`, `$connect`, `$disconnect`, `$queryRaw(Unsafe)`, `$executeRaw(Unsafe)`. Override per test: `vi.mocked(db.h1_season.findMany).mockResolvedValue([...])`.
- **Observability mock:** `@/shared/utils/observability.mjs`'s sole export `reportError` is mocked globally — keeps Sentry out of every test and means tests never need to re-implement `tryCatch`'s side effect just to suppress it.
- **Live data mock:** `@/shared/providers/LiveDataContext.mjs` — `useLiveDataContext` defaults to `{ data: null, mapState: null, status: 'live', prevData: null, isLeader: false }`.
- **Third-party component mock:** `react-slot-counter` renders its `value` prop as plain text so `getByText`/`textContent` assertions work without the real animation.
- **Next.js mocks:** `next/cache` (`revalidatePath`, `revalidateTag`, `unstable_cache` as identity), `next/server` (real `NextResponse` preserved via `importOriginal`, only `after` stubbed), `next/navigation` (`useRouter` with all methods stubbed, `usePathname` → `'/'`, `useSearchParams` → empty), `next/headers` (`headers`/`cookies` stubbed), `next/image` (renders as bare `<img>`, strips Next-only props to avoid React DOM-attribute warnings), `next/link` (renders as `<a>`, strips Next-only props).
- **Lifecycle:** `beforeEach(() => vi.resetAllMocks())` — deliberately `resetAllMocks`, not `clearAllMocks`. `clearAllMocks` only wipes call history and leaves a `mockResolvedValue`/`mockImplementation` override installed by an earlier test in place for every subsequent test in the same file — silently breaking the "defaults to null/[]" contract documented above and making pass/fail order-dependent. `resetAllMocks` restores every `vi.fn(impl)` back to its original `impl` and every `vi.spyOn` back to the original method between tests.
- **Console is NOT globally silenced** — deliberate: silencing `console.error` would hide React `act()` warnings, missing-dependency warnings, and genuine error logs, which is exactly how "theater tests" creep in. A test that legitimately needs to suppress/assert console output should `vi.spyOn(console, 'error').mockImplementation(...)` scoped to itself.

**Per-test module-graph reset pattern** (for modules that read env/config at import time, e.g. `src/auth.js`'s `auth.api ? ... : null` ternary): `vi.resetModules()` + `vi.doUnmock('@/auth')` + `vi.stubEnv(...)`, then dynamic `await import('@/auth')`, cleaned up in `afterEach` with matching `vi.doUnmock`/`vi.unstubAllEnvs`/`vi.resetModules()` calls. See `src/__tests__/unit/auth.test.mjs`. `db.test.mjs` uses the identical pattern to reach the real (unmocked) `@/db/db` module.

## Coverage

**Provider:** `v8`, reporters `text` + `html` (`vitest.config.mjs` → `coverage` block). Run via `npm run test:coverage`.

**Scope is deliberately broad — everything under `src/**/*.{js,jsx,mjs}` counts**, tested or not, with exactly two exclusions:
- `src/generated/**` (Prisma's generated client — machine-written, not project code)
- Test files themselves (`src/**/*.{test,spec}.{js,jsx,mjs}`, `src/__tests__/**`)

**Do not re-add a broader exclude list.** A prior exclude list (documented inline in the config with its removal rationale) named four files that no longer existed (dead config), hid code that unit tests DO cover once re-included (`src/db/db.js` 10/10 statements, `src/app/docs/**` 49/114, `src/auth.js` 1/1), and excluded server-rendered code on the theory it was "tested via e2e/smoke" — which is unsatisfiable, since `vitest.smoke.config.mjs` has no coverage block and drives a separate server process over HTTP, so no smoke test can ever produce a coverage record for anything. An untested file should read as **0%, not disappear** from the report.

**No coverage threshold is enforced** in config (no `thresholds` block present) — coverage is visibility, not a CI gate.

## Test Structure & Patterns

**Suite organization** — `describe`/`test` nesting, explicit imports from `vitest` (not just relying on `globals: true`):

```js
import { afterEach, describe, expect, test, vi } from 'vitest';

describe('auth module wiring', () => {
    test('exports null and never constructs BetterAuth when BETTER_AUTH_SECRET is absent', async () => {
        const { mod, betterAuth, prismaAdapter } = await loadAuth({ secret: undefined });
        expect(mod.auth).toBeNull();
        expect(betterAuth).not.toHaveBeenCalled();
    });
});
```

**Async testing:** `async`/`await` test bodies, `mockResolvedValue`/`mockImplementation` on Prisma model mocks and other async dependencies (see Mocking above).

**Fixtures/helpers:** Local async factory functions co-located in the test file rather than a separate fixtures directory (e.g. `loadAuth({ secret })` / `loadAuthConfig()` in `src/__tests__/unit/auth.test.mjs`) — set up mocks, stub env vars, dynamically import the module under test, and return both the module and the spies needed for assertions.

**Season fixtures for smoke/integration seeding:** committed under `prisma/seed/seasons/` (~156 season fixtures) and loaded by `prisma/seed.mjs` — fully offline, no network call, used by the CI smoke gate (see below).

## Test Types

**Unit tests** (`src/__tests__/unit/`, mirrored tree): scope is one module per test file (with the documented multi-file/qualifier exceptions), Prisma/Next.js/auth/observability fully mocked via `vitest.setup.mjs`, `environment: 'node'`.

**Contract / integration tests:** `*.contract.test.*` for a contract spanning several modules (e.g. v1 pagination); `*.integration.test.*` for exercising several modules together. Both live inside the same mirrored `unit/` tree as escape hatches, not a separate directory.

**Smoke tests** (`src/__tests__/smoke/`): plain `fetch` against a real running Next.js server (`:3000` or `TEST_SERVER_URL`), no mocks, exercising real HTTP behavior end-to-end.

**Visual regression tests** (`src/__tests__/visual/`): real headless Chromium via Vitest browser mode, pixel-diffed against committed baseline PNGs, isolated to the Playwright Docker image.

**No separate unit-level E2E/Playwright browser automation** — `npm run test:e2e` is the smoke suite alias, not a browser-driven suite; the only real browser automation is the visual regression suite.

## CI Gates (`.github/workflows/`)

**Shared verify sequence** — `.github/actions/verify/action.yml` (a **composite action**, deliberately not a `workflow_call` reusable workflow, because a reusable workflow would rename the check to `<caller> / Test & Build` and break `main`'s exact-string-matched required status check):
1. `actions/setup-node@v7.0.0` pinned to `.node-version`, npm cache enabled
2. `npm ci`
3. `npx prisma generate` (client is gitignored, imported by `src/db/db.js`, must exist before typecheck/tests/build) — `POSTGRES_URL` stubbed
4. `npm run lint`
5. `npm run typecheck`
6. `npm run test:unit`
7. `npm run build` — with `POSTGRES_URL`, `UPDATE_KEY`, `UPDATE_INTERVAL` stubbed to unreachable/dummy values (the three vars `parseServerConfig()` eagerly validates at import time); auth env intentionally left unset to avoid the all-or-none OAuth provider check.

**`check-ci.yml` ("Check: CI")** — runs on PR/push to `main`/`develop`:
- **`visual` job** — runs independently and in parallel (a UI-moved failure is not "the app is broken"), inside `container: mcr.microsoft.com/playwright:v1.62.1-noble` (same image `scripts/visual-tests.sh` uses locally, byte-identical rendering), `npm ci` then `npx vitest run --config vitest.visual.config.mjs` directly (not via `npm run test:visual`, which would re-launch the same Docker image from inside itself). On failure, uploads `.vitest-attachments/` (actual + diff PNGs) as an artifact — `include-hidden-files: true` is required since GitHub's upload-artifact skips dot-directories by default.
- **`test` job ("Test & Build")** — the `main` branch protection's exact-string required check; renaming this job blocks every PR to `main`. Spins up a `postgres:17-alpine` service on port 5433 (not 5432, so the Build step's stub connection string stays deliberately unreachable even though a live database exists in the job). Runs the shared `verify` composite, then a **smoke gate**:
  1. Blackholes `api.helldiversgame.com` via `/etc/hosts` so the cron worker's on-boot poll fails fast and never mutates the seeded database mid-test.
  2. `npx prisma migrate deploy` against the real (5433) database.
  3. Seeds via `prisma/seed.mjs` from the committed season fixtures (fully offline). `SEED_TEST_API_KEY_HASH` (digest only) creates a throwaway v1 API key row for smoke assertions against `/api/v1/h1/*` — the plaintext key is passed separately, only to the smoke-test step itself, so the seed step never has it. This CI-only credential must never be reused in a developer, staging, or production database.
  4. Boots the `next build` output and runs the smoke suite against it — proves the app *boots*, not just compiles. This is distinct from and does not replace `check-docker-smoke.yml`, which tests the actual Docker image.

**`build-release.yml`** — tag-triggered production build, reuses the same `verify` composite action for its own "Test & Build" job before building/pushing app + migrate images and cutting a GitHub Release.

**`build-staging.yml`** — triggered by `workflow_run` off `check-ci.yml` succeeding on `develop` (auto-deploys to staging without a separate quality gate — CI having gone green IS the gate). Conditionally rebuilds the migrate image only when relevant paths changed or the image is missing.

**Other workflows** (not test-related but adjacent): `check-codeql.yml` (CodeQL security scanning), `check-dependencies.yml`, `check-docker-smoke.yml` (smoke-tests the built Docker image itself, separate concern from the in-job smoke gate above), `check-version.yml`, `scheduled-pagespeed.yml`, `scheduled-seed-refresh.yml`.

---

*Testing analysis: 2026-08-28*
