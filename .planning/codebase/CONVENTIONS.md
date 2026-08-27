# Coding Conventions

**Analysis Date:** 2026-08-28

## Naming Patterns

**Files:**
- `.mjs` for pure JS modules (utils, validators, db queries, server actions), `.jsx` for React components. `type: "module"` in `package.json` — everything is ESM.
- Components: PascalCase file names matching the exported component (`EventCard.jsx`, `StatGrid.jsx`). Either a flat file (`src/shared/components/Foo.jsx`) or a per-component folder (`src/shared/components/Foo/Foo.jsx`) — both shapes coexist under `src/shared/components/`.
- Utilities: camelCase file names matching the primary export (`formatNumber.mjs` exports `formatNumber`, `tryCatch.mjs` exports `tryCatch`).
- Validators: `isValidX.mjs` naming convention, one Zod schema/refinement per file (`src/validators/isValidNumber.mjs`, `src/validators/isValidSeason.mjs`).
- Generated/emitted files are explicitly ESLint-ignored and named for their origin, e.g. `src/features/dashboard/waveModel.mjs` (emitted by `scripts/analysis/08`).

**Functions:**
- camelCase throughout. Server actions and update pipeline entry points are verb-first: `updateStatus`, `updateSeason`, `queryUpsertEvent`.
- React hooks: `useX` prefix (`useTrack`, `useLiveData`, `useLiveDataContext`).

**Variables:**
- camelCase. Private class fields use `#` (see `MemoryStorage` in `vitest.setup.mjs`).
- Database/table identifiers keep the snake_case Prisma model names verbatim (`h1_season`, `h1_event_progress`) rather than being remapped to camelCase — this appears throughout query code and Prisma mock setup.

**Types (JSDoc):**
- No TypeScript files; types are expressed entirely via JSDoc annotations validated by `tsc --noEmit -p jsconfig.json` (`checkJs: true`). See `npm run typecheck`.
- Generic/templated JSDoc is used for utility wrappers, e.g. `tryCatch`'s `@template T` in `src/shared/utils/tryCatch.mjs`.
- Inline type casts use the `/** @type {Error} */ (error)` pattern (same file) rather than TS `as`.

## Code Style

**Formatting (Prettier, `.prettierrc.json`):**
- 4-space indentation (`tabWidth: 4`, `useTabs: false`)
- Single quotes (`singleQuote: true`)
- Trailing commas everywhere (`trailingComma: "all"`)
- `printWidth: 90`
- `experimentalTernaries: true`
- `prettier-plugin-tailwindcss` enabled, pointed at `./src/app/layout.css` (`tailwindStylesheet`) — class lists get sorted to match the project's `@theme` token order.
- Run `npm run format` to watch-format, or `npm run lint:fix` (below) which also runs Prettier via the ESLint integration. **Always run `npm run lint:fix` before committing** — not during active development (per `CLAUDE.md`).

**Linting (ESLint v9 flat config, `eslint.config.mjs`):**
- `js.configs.recommended` + `@eslint-react/eslint-plugin` recommended preset (JSX correctness — replaces the unmaintained `eslint-plugin-react` for ESLint 10) + `eslint-plugin-react-hooks` recommended + `@next/eslint-plugin-next` recommended + `core-web-vitals` + `eslint-plugin-jsdoc` (`flat/recommended-typescript-flavor`) + `eslint-plugin-prettier/recommended` (Prettier violations surface as lint errors) + `eslint-plugin-compat` (browser compatibility checks) + `eslint-plugin-react-compiler` (`warn` level — React Compiler is enabled experimentally in `next.config.mjs`).
- Ignored paths: `src/generated/**`, two emitted analysis-script outputs (`src/features/dashboard/waveModel.mjs`, `attackModel.mjs`), `.next/**`, `public/sw.js`, `public/workers/**`, `.serwist/**`, `.worktrees/**` (excluded so a lint run in the main checkout doesn't also lint every checked-out worktree copy of `src/`).
- Several hook rules are deliberately disabled where React Compiler already handles the concern, with a code comment explaining why each is off: `react-hooks/set-state-in-effect`, `set-state-in-render`, `purity`, `refs`, `static-components`, and the `@eslint-react` equivalents `set-state-in-effect`, `purity`, `exhaustive-deps` (duplicate of `react-hooks/exhaustive-deps`, the one source of truth, annotated with documented per-site disables for `Hijackable` and `LiveToasts`).
- JSDoc rules: `require-jsdoc`, `require-param`/`require-param-type`, `require-returns`/`require-returns-type` are `off` (JSDoc is not mandatory everywhere) but `require-param-description` is `warn`, and correctness rules (`check-param-names`, `check-tag-names`, `check-types`, `valid-types`, `reject-any-type`) are `warn` — so JSDoc, when present, must be accurate.
- Run `npm run lint` (check) / `npm run lint:fix` (auto-fix both lint and Prettier violations).

**Type Checking:**
- `npm run typecheck` → `tsc -p jsconfig.json --noEmit`, validates JSDoc annotations across the project (`checkJs: true`). Tests are excluded from typecheck scope — validated by Vitest instead.

## Import Organization

**Path Aliases (`jsconfig.json`):**
- `@/*` → `./src/*` — used throughout application code (`import { tryCatch } from '@/shared/utils/tryCatch.mjs'`).
- `@test-utils/*` → `./src/__tests__/utils/*` — test-only alias, configured separately in each Vitest config's `resolve.alias`.

**No enforced import ordering** — no `eslint-plugin-import` / `simple-import-sort` in the flat config; imports are grouped by convention (framework/library imports first, then `@/` aliased local imports) but not mechanically enforced.

## Error Handling

**`tryCatch` wrapper — mandatory, not try/catch:**
`src/shared/utils/tryCatch.mjs` wraps a promise and returns a result tuple instead of throwing:

```js
const { data, error } = await tryCatch(someAsyncOperation());
if (error) {
    /* handle */
}
```

- Caught errors are auto-reported to GlitchTip (Sentry SDK) via `reportError(error, { source: 'tryCatch', level: 'warning' })` — a safety net at `warning` severity, distinct from explicit `reportError(...)` calls at user-visible failure points which default to `error` level. This severity split is intentional: it's the tiebreaker for how GlitchTip groups/prioritizes issues by stack trace.
- Thrown values are treated as `Error` in practice via an inline JSDoc cast: `/** @type {Error} */ (error)`.
- **Do NOT use try/catch blocks** in application code — `CLAUDE.md` states this as a hard rule; use `tryCatch` instead.

## API Routes

**Standardized response helpers** — `src/shared/utils/api/responses.mjs`:
- `errorResponse(code, start, error, opts)` — for 4xx/5xx. Throws `Error('Invalid error code')` if `code` is outside 400-599. Looks up a canned message from `ERROR_MESSAGES` (400/401/403/404/405/418/429/500/501/502/503), defaulting unknown codes to `'Unknown error'` + status 500. Body: `{ time, code, message, error }` (BigInt-safe JSON serialization via a replacer). Accepts `opts.headers` to merge extra headers (e.g. `Retry-After`/`RateLimit-*` on a 429).
- `successResponse(code, start, data, opts)` — for 2xx. Throws if `code` is outside 200-299. Canned messages for 200/201/202/204. Body: `{ time, code, message, data }`.
- **Timing:** measure execution time with `roundedPerformanceTime(start)` (or the underlying `performanceTime(start)`) from `src/shared/utils/time.mjs`, passed as the `start` arg to both response helpers — every API route reports its own latency in the response body.
- Both return a raw `next/server` `NextResponse` — not a plain object — so headers/status are real HTTP semantics, not just JSON fields.

## Validation

**All external data validated with Zod** before database operations, schemas live under `src/validators/`:
- One schema/refinement per file, named `isValidX.mjs` (`isValidNumber.mjs`, `isValidSeason.mjs`, `isValidStatus.mjs`, `isValidContentType.mjs`, `isValidFormData.mjs`).
- `isValidFormData.mjs` composes a `z.discriminatedUnion('action', [...])` across multiple per-action schemas (`get_campaign_status`, `get_snapshots`, `get_available_entitlements`, `get_leaderboards`, `get_usernames`), each independently `.refine()`d, e.g. rejecting extra keys with `.refine((obj) => Object.keys(obj).length === 1, ...)`.
- Composable validators are imported and reused across schemas (`isValidNumber` used inside `isValidFormData`'s season/count fields).

## Analytics Tracking (Umami)

Every interactive element (links, buttons, nav items) needs Umami tracking, using `category-action` event naming:

- **`data-umami-event="category-action"`** attribute for simple clicks — the tracker script auto-captures these, no JS needed. Example: `data-umami-event="nav-404-home"` in `src/app/not-found.jsx`, `data-umami-event="auth-signin-discord"` in `src/app/sign-in/page.jsx`. Can also be driven dynamically from data, e.g. `data-umami-event={item.track}` in `src/app/docs/components/DocsSidebar.jsx`.
- **`useTrack()` hook** (`src/shared/hooks/useTrack.mjs`) for dynamic interactions where the event name/data depends on state — returns a stable, ad-blocker-safe callback: `const track = useTrack(); track('faction-tab-switch', { faction: id })`. No-ops silently if `window.umami` isn't loaded.
- **`window.umami?.track()`** directly inside `useEffect` callbacks, where hooks (including `useTrack`) can't be called.
- **`sendUmamiEvent()`** (`src/shared/utils/umami.mjs`) for server-side API route tracking — call inside `after()` so it never blocks the response.
- Categories in use: `nav`, `auth`, `footer`, `docs`, `diagram`, `faction`, `archive`, `notification`, `push`, `sw`, `toast`, `dashboard`, `api`.
- Rule of thumb: adding a new interactive element → add `data-umami-event`; adding a new externally-consumed API route → add a server-side `sendUmamiEvent()` call.

## Comments

**JSDoc used liberally on exported functions** for parameters, return types, and behavior explanation — see `tryCatch`, `errorResponse`/`successResponse` above for the house style (full `@param`/`@returns`/`@throws` blocks with prose explaining *why*, not just *what*).

**Long-form rationale comments are a project norm**, not an exception — CI workflow files, ESLint config, and Vitest configs all carry multi-paragraph comments explaining non-obvious decisions (e.g. why a rule is disabled, why a Docker image pin exists, why an exclude list looks the way it does). New non-obvious code should follow this pattern: explain *why*, referencing an issue number or historical incident if one exists (e.g. `// build-args land in the provenance attestation ... See #284.`).

**No enforced comment style** beyond what `eslint-plugin-jsdoc`'s `warn`-level correctness rules catch (see Linting above).

## Module Design

**Exports:** No barrel files (`index.mjs` re-export hubs) observed as a systemic pattern — modules are imported directly by path via the `@/` alias. Per-component folders (`src/shared/components/Foo/Foo.jsx`) do not appear to use an `index.jsx` re-export convention (the mirror-tree test explicitly also accepts an `index.*` file inside a component folder as satisfying `<Base>`, but flat files are equally common).

**Server actions:** Most mutation/data-fetching utilities carry the `'use server'` directive (Next.js Server Actions) rather than being exposed as REST-only.

## Git Workflow

**Branching model:** Simplified Git Flow, no release branches. `main` (production, PR-only, protected), `develop` (integration/staging, direct-merge, unprotected), `feature/<desc>`, `bugfix/<desc>`, `hotfix/<semver>`, standalone `metrics` (CI-generated, never merges with the flow).

**Hard rules (`CLAUDE.md` § Git Workflow):**
1. **Never squash merge, never fast-forward merge, never rebase** — always `git merge --no-ff` so every merge creates a merge commit and branch history stays visible in `git log --graph`.
2. **Version bump + CHANGELOG move happen in the SAME commit as the merge to `develop`** — move entries from `## Unreleased` into a new `## X.Y.Z` section in `CHANGELOG.md` and bump `"version"` in `package.json`, as part of the merge step, never deferred or asked about. Semver: patch=bugfix, minor=feature, major=breaking. Skipping version numbers on `develop` between tagged releases is fine.
3. **Release process:** `develop` → `main` via PR → tag `vX.Y.Z` on the `main` merge commit (matching `CHANGELOG.md`'s latest version) → push tag → merge `main` back into `develop`. The production Docker build (`build-release.yml`) only triggers on version tags — forgetting the tag means no deployment.
4. **Hotfix process:** branch `hotfix/X.Y.Z` from `main` → fix → update `CHANGELOG.md` → PR to `main` → tag `vX.Y.Z` → merge back to `develop`.
5. **Tag format:** `v<major>.<minor>.<patch>` on `main` only, always `v`-prefixed.

**Feature work uses an isolated git worktree** off `develop` (`.worktrees/<branch-dir>`, e.g. `feature/ministry-interference` → `.worktrees/feature-ministry-interference`); small chores/bugfixes/dependency bumps skip the worktree and branch+merge directly in the main checkout. See `CLAUDE.md` § Worktree Workflow for the full 7-step sequence (copy env files, `npm install && npx prisma generate`, verify all four gates, merge with `--no-ff` including the version bump, push, clean up worktree + branch).

**Verification gate before any merge:** `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build` must all pass — same four checks CI runs via the composite `.github/actions/verify` action.

---

*Convention analysis: 2026-08-28*
