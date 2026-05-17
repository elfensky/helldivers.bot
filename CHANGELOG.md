# Changelog

## Unreleased

### Chores

- **Type-safety JSDoc tightening.** Replaced `string` widenings with literal-union typedefs across the live-data and event surfaces. `useLiveData` and `useLiveDataContext` now expose a `LiveStatus = 'polling'|'live'|'offline'` typedef instead of a bare string, and the `data`/`mapState`/`prevData` return fields are explicitly `object | null`. `detectChanges` returns `kind: 'event_started'|'event_won'|'event_lost'` instead of `kind: string`, and `prevEvents` is documented as nullable. `upsertEventProgress` and `upsertEvent` now type their `type` parameter as `'attack' | 'defend'`. `EventToast`'s `event` typedef was corrected from `id: string|number` to `event_id: number` to match what `showEventToast` and `toastLabel` actually read.

- **Validator protocol unified to raw-schema exports.** `src/validators/isValidStatus.mjs` and `src/validators/isValidSeason.mjs` previously exported `(data) => rootSchema.safeParse(data)` wrapper functions while the other three validators (`isValidContentType.mjs`, `isValidFormData.mjs`, `isValidNumber.mjs`) exported raw Zod schemas. Both wrappers replaced with raw-schema exports so all five validators share one invocation convention: `schema.safeParse(data)`. Callers in `src/update/status.mjs` and `src/update/season.mjs` plus the corresponding unit tests and mocks updated to call `.safeParse()` explicitly.

- **Legacy-wording cleanup.** Replaced "legacy" wording that actually described the public HD1 wire format / public getCampaign shape. `src/db/queries/getCampaign.mjs` JSDoc now says "public getCampaign shape" instead of "legacy getCampaign output"; `src/app/api/h1/rebroadcast/route.js` calls the format "HD1 wire format" not "legacy wire format"; `src/features/admin/actions.mjs` reworded the random-id fallback comment to describe the actual default behavior. Matching test comments in `src/__tests__/unit/queries/getCampaign.test.mjs` updated to "public-shape". Genuine deprecated-format usages (Prisma client migration, Playwright output dir, dismissedEvents storage migrators) left untouched.

### Bug fixes

- **`LiveToasts` catch-up branch was unreachable.** `getDismissedEvents()` returns `Record<string, {status, ts}>` but the catch-up loop was comparing that whole object to `event.status` (and to `EVENT_STATUS.ACTIVE`), so both branches always evaluated `false` — fully-suppressed events and the "dismissed at active → now transitioned" path never fired. The unit test masked it by mocking the legacy string shape (`{1: 'active'}`) that production never produces. Fixed by reading `dismissed[id]?.status` once per iteration and comparing the string against the string. Test mocks updated to `{status, ts}` so future regressions surface.

## 0.46.3

### Chores

- **Soft CDN cache header on HTML page routes** — `next.config.mjs` now emits `Cache-Control: public, s-maxage=30, stale-while-revalidate=60` for all non-API, non-asset paths so a shared cache (e.g. Cloudflare) can collapse concurrent visitors into one origin render per 30s window, and serve the stale copy for another 60s while it refetches. `s-maxage` targets shared caches only, so browsers still revalidate normally and `useLiveData` keeps polling `/api/h1/live` for fresh game state. The source pattern uses a negative lookahead to exclude `/api/*` (preserves `no-store` on live data), `/_next/*` (content-hashed), the asset directories that already have `immutable` long-TTL headers, `/sw.js`, `/workers/*`, and `/profile/*` (per-user content that must not be shared). Note: Cloudflare ignores `s-maxage` on HTML by default — a Cache Rule with "Respect existing headers" is required for this to take effect at the edge.

## 0.46.2

### Chores

- **GitHub Actions pin format switched from SHA → semver tag** across all six workflows (`ci.yml`, `codeql.yml`, `dependency-review.yml`, `metrics.yml`, `release.docker.yml`, `staging.docker.yml`). Bumped each action to its latest released tag at the same time: `actions/checkout@v6.0.2`, `actions/setup-node@v6.4.0`, `github/codeql-action/*@v4.35.5`, `docker/setup-buildx-action@v4.0.0`, `docker/login-action@v4.1.0`, `docker/build-push-action@v7.1.0`, `dorny/paths-filter@v4.0.1`, `lowlighter/metrics@v3.34`. `actions/dependency-review-action@v5.0.0` and `snok/container-retention-policy@v3.0.1` were already current — only the pin format changed. Dependabot's `github-actions` ecosystem will now bump these in-place without needing SHA resolution.

## 0.46.1

### Chores

- **desloppify cleanup pass** — knocked out 9 trivial review issues across the codebase:
    - `getCampaign.mjs` JSDoc now documents `season_duration` in the return shape.
    - `eventFilters.mjs` JSDoc trimmed: removed English description lines that just restated the function names, kept `@param`/`@returns` for type info.
    - `glitchtip/route.js`: `SENTRY_DSN` is read inside the `POST` handler (was module-scope const), `parseDsn()` no longer wrapped in `Promise.resolve().then()` (uses local try/catch since the project `tryCatch` is async-only), `OPTIONS` handler added to match the `methodNotAllowed` convention used by all sibling routes.
    - `season.mjs`: raw `ZodError` throw wrapped in `Error` with `cause` to match `status.mjs` pattern; `getSeasonFromSnapshot()` no longer wrapped in `Promise.resolve()` (uses local try/catch since the function is synchronous-throwing); `updateSeason` return shape now includes `time` to match `updateStatus`.
    - Validators (`isValidStatus.mjs`, `isValidSeason.mjs`): `z.enum` derived from `CAMPAIGN_STATUS` and `EVENT_STATUS` constants instead of inline string arrays.
    - `admin.mjs` Zod schema: `newRole` now uses `z.enum(Object.values(ROLE))`.
    - `auth.js`: BetterAuth `role` field `defaultValue` now uses `ROLE.USER`.
    - `getEventRegionLabel.mjs`, `computeMapState.mjs`, `FactionHealthChart.jsx`: raw `'defend'` / `''` / `'hidden'` / `'defeated'` strings replaced with `EVENT_TYPE.DEFEND` / `MAP_STATUS.IDLE` / `CAMPAIGN_STATUS.*` constants.

- **Deleted single-consumer `formdata.mjs` wrapper** — `formDataToObject` was a one-liner used by exactly one caller. Inlined `Object.fromEntries(formData.entries())` at the call site (`rebroadcast/route.js`) and removed the module + test + docs entries.

- **Moved vestigial `features/docs/` module** — `overviewConfig.mjs` and `overviewDefinition.mjs` relocated to `src/app/docs/` next to their only consumer (`page.mdx`); imports rewritten to relative paths; empty `features/docs/` directory removed.

- **Added `computeMapStateAtEvent` test coverage** — 7 cases covering hidden-state fallback for empty/null inputs, nearest-snapshot selection by time delta, snapshot fallback when none precedes the event, gap-event replay between snapshot and selected time, active-event overlay, and the `campaign.points_max` fallback path.

## 0.46.0

### Features

- **Stale version auto-reload** — three-layer detection prevents `ChunkLoadError` crashes after deployments: (1) Next.js `deploymentId` triggers hard navigation on version skew, (2) `appVersion` field in `/api/h1/live` enables poll-based detection within ~10s, (3) global `unhandledrejection` handler catches chunk/module load failures across all browsers including Safari. Shared `guardedReload()` utility uses localStorage circuit breaker (30s TTL, max 3 attempts) to prevent infinite reload loops.

### Fixes

- **`ApiForm.jsx` Rules of Hooks violation** — `useActionState`/`useState` were called after an early `return` on `!userId` in `GenerateApiKeyForm` and `DeleteApiKeyForm`. Moved hooks above the guard so React's hook call order stays consistent across renders.
- **`UserSection.jsx` exhaustive-deps** — `useEffect` accessed `session.user.image`/`.email` directly while depending on optional-chained property paths; extracted `const user = session?.user` and depend on the whole user object.
- **`DebugTools.jsx` exhaustive-deps** — `handleTestPush` `useCallback` referenced `buildOrUpdatePushEvent` but had `[]` deps; added the dependency (the callee itself has stable `[]` deps so no re-render cascade).

### Chores

- **ESLint v9 flat config + tsc checkJs** — `npm run lint` now gates Prettier formatting, JSDoc validity, React Hooks rules, React Compiler hints, and Next.js core-web-vitals rules through a single command. `npm run typecheck` runs `tsc --noEmit` against an expanded `jsconfig.json` with `checkJs: true`, validating JSDoc annotations across the project without converting any files to TypeScript. CI runs both before tests/build. CLAUDE.md verification rule updated to require all four (`lint`, `typecheck`, `test:unit`, `build`).
- **`<img>` → `next/image`** in 6 spots (faction icons in `DefeatedCard`, `EventCard`, `EventToast`, `EventLogCard`, `FactionTabs`; backstab icon in `StatGrid`). All had explicit width/height; converted to satisfy `@next/next/no-img-element`.
- **`console.log` → `console.info`** in worker lifecycle (`initializeWorker.mjs`), season-transition closing pass (`/api/h1/update`), and push-notification cleanup messages.
- **Dead `start = performance.now()` declarations** removed from `getCampaign.mjs` and `initializeWorker.mjs` (leftover timing scaffold with no `performanceTime(start)` callers).
- **Unused destructures** in `admin.mjs` simplified — `{ user, error: authError } = await requireAdmin()` shortened to `{ error: authError }` in paths where `user` was never read.

## 0.45.2

### Chores

- **Test script reorganization** — `test:e2e` renamed to `test:smoke` for accuracy; `test` now runs unit tests only; added `test:all` for running both unit and smoke tests.
- **Agent skills reference docs** — added `.agents/skills/` reference documentation for React, Next.js, Prisma, Vitest, Zod, Tailwind, and more.
- **Desloppify skill** — added `.opencode/skills/desloppify/SKILL.md` codebase health scanner definition.
- **`formatTimeAgo` simplification** — removed try/catch fallback wrapper; `timeago.js` `format()` is called directly.

### Tests

- **ArchiveComponentsIntegration tests** — added integration tests for archive page components.
- **Async test stabilization** — inlined archive seed data, fixed `act()` usage and suppressed spurious log noise.
- **LastUpdated test timing fix** — adjusted test timing to account for `timeago.js` formatting behavior.

## 0.45.1

### Features

- **Healthcheck probes database** — `/api/healthcheck` now runs `SELECT 1` via Prisma and returns 503 when the database is unreachable, instead of a hardcoded `{ alive: true }`.

### Fixes

- **Dependency security** — bumped hono override to >=4.12.18 (5 CVEs).
- **Docker migrate image** — added missing `zod` + `isValidSeason.mjs` deps for seed script validation; switched CMD to JSON exec form for proper signal handling.
- **`useLiveData` dead code removal** — removed `navigator.onLine` check in `connect()` that was immediately overwritten by `poll()`.
- **`useTrack` partial-umami guard** — guard now checks `typeof window.umami?.track === 'function'` so ad-blocker stubs (`window.umami = {}`) no-op instead of throwing.
- **`vitest.setup.mjs` `after()` mock** — stopped auto-invoking callbacks synchronously. Now records calls without executing, exposing response-timing bugs that were previously hidden.
- **Dismissed-toast-events garbage collection** — entries now carry timestamps and are capped at 200. Oldest entries are pruned on write. Migrates legacy formats (arrays, plain strings) on read.

### Chores

- **Hardened app runtime** — production runner stage switched from `node:24-alpine` to `cgr.dev/chainguard/node:latest` (Chainguard Wolfi-based, near-zero CVEs). Build stages remain Alpine. Removed tini (Next.js standalone handles SIGTERM natively). Healthcheck switched from wget to Node.js `fetch()` for shell-less compatibility.
- **CI deduplication** — added concurrency groups to prevent redundant CI and CodeQL workflow runs; renamed Build Staging workflow to Build Develop.

## 0.45.0

### Features

- **Global MISSIONS_WON card** — the global stats view now shows a `MISSIONS_WON` card (sum of `successful_missions` across factions), matching the per-faction view. Both global and per-faction cards display a "N TOTAL" subtitle showing total missions attempted.
- **Event total subtitle** — the `EVENTS` W : L scoreline card now shows a "N TOTAL" subtitle with the combined win + loss count, in both global and per-faction views.
- **Animated stat counter** — live stat values on the homepage use a slot-counter animation (`AnimatedStat` component via `react-slot-counter`) that rolls digits when values change. Sandbox page at `/sandbox/slot-counter` for development.

### Fixes

- **formatNumber M threshold raised to 10M** — compact "M" suffix now kicks in at 10,000,000 instead of 1,000,000. Values between 1M and 9.99M display with full locale grouping (e.g. `5,000,000`) so users see precise numbers in the range most relevant to Helldivers stats.

### Chores

- **Supply chain quarantine** — new `npm run update:safe` script uses `npx npm-check-updates --cooldown 7d` to only bump to package versions published at least 7 days ago, giving the community time to detect compromised releases.
- **Dependency bumps** — all npm dependencies updated to latest versions.

## 0.44.1

### CI & dev tooling

- **CodeQL now runs on pull requests** — `Analyze (javascript-typescript)` is a required status check on `main`'s branch protection, but the workflow only triggered on `push` to `main`/`develop`. PRs that needed it to merge were permanently `BLOCKED`. Added `pull_request: { branches: [main, develop] }` to `.github/workflows/codeql.yml` so the required check actually fires on PR heads.
- **GitGuardian secret scanning excludes test fixtures** — synthetic VAPID-shaped keys, push subscription endpoints, and JWT-shaped tokens in `src/__tests__/**`, `**/*.test.{js,jsx,mjs,ts,tsx}`, `**/*.spec.{js,jsx,mjs,ts,tsx}`, `**/__fixtures__/**`, and `**/__mocks__/**` are now excluded from secret scanning via `.gitguardian.yaml`. These fixtures are designed to look real so the code-under-test exercises the same validation paths it would in production, but they're random/hand-crafted and not valid anywhere.
- **VAPID test fixtures use obvious placeholder strings** — `notifications-subscribe.test.mjs` previously used an 87-char base64url-shaped `p256dh` that was indistinguishable in shape from a real VAPID public key (GitGuardian flagged it). Replaced both keys with `TEST_*_PLACEHOLDER` strings that still satisfy the Zod regex + length constraints. Suite still 1244/1244.

## 0.44.0

### Features

- **Cookie-backed user preferences** — faction selector, regions view toggle, and event log sort now persist via cookies instead of localStorage. Server components read them via `next/headers.cookies()` and pre-render the correct initial state, eliminating the brief post-hydration flash where the UI switched from default to stored value. New `src/shared/preferences/*.mjs` modules hold each preference's key + default + validator; `usePersistedState(key, initial)` is now a thin wrapper over `useState` + cookie write; the old mount-effect reads are gone. Cookies use `path=/`, `max-age=1yr`, `SameSite=Lax`, `Secure` on HTTPS; classified as "strictly functional" so they sit under the GDPR consent exemption.
- **Preference analytics** — fires a `preference-snapshot` Umami event once per session reporting the user's current faction / regions_view / sort_order. Complements the existing per-toggle click events: clicks capture churn ("how often do users flip?"); the snapshot captures distribution ("what % prefer X?", including default-stickers who never interact). Session-scoped via `sessionStorage` so SPA navigation doesn't double-count.
- **24h player-count delta** — the `HELLDIVERS_ONLINE` / `ONLINE` stat card now shows a signed delta below the number comparing current concurrent players to the 24h rolling average baseline. `getPlayersAvg24h(season)` query returns `{ global, bugs, cyborgs, illuminate }`: per-faction averages come from `AVG(players) GROUP BY enemy` over buckets in the last 24h window, and `global` is the average of per-bucket SUMs (disjoint per-front counts) — more robust to sparse buckets than a single-point "24h ago" snapshot would be. Arrow (▲/▼) carries the success/danger colour, number + `LAST 24H` caption render in uppercase ghost text to match the card label. Hidden on new seasons (no baseline) or when delta is zero.

### Test suite quality (Phase 12)

Suite went from **882 → 1244 tests** (+362 high-signal). Coverage moved from **63.5% → 81.8% statements** / 58.3% → 73.7% branches. Five multi-LLM code review rounds (Codex + OpenCode) applied across the work; every must-fix finding addressed.

- **Theater removal** — rewrote 5 highest-theater test files (`healthcheck`, `useTrack`, `ArchiveMap`, `Header`, `Navigation`) to verify real behaviour instead of stub-rendering. Stopped globally mocking `console.error/warn/log/info` in `vitest.setup.mjs` so React `act()` warnings and source error logs are audible.
- **API route coverage** — 0% → comprehensive for `/api/notifications/subscribe` (Zod validation + Prisma upsert/delete contract + 410-graceful + 500-with-DB-call-asserted), `/api/glitchtip` (DSN parsing, ingest URL forwarding, 502 upstream failure), `/api/auth/[...all]` (auth-disabled 503 vs configured delegate to BetterAuth). Added `expectSuccessEnvelope` / `expectErrorEnvelope` helpers in `@test-utils` and retrofitted `live` + `update` route tests to use them.
- **Hook coverage** — `useLiveData` (was 0% / 284 L): 23 tests covering polling cadence, status state machine, visibility-change handler, singleton-with-multiple-consumers, localStorage cache hydration + write, and BroadcastChannel leader election. `usePersistedState` (foundation hook): 16 tests covering value hydration, validator gating, key changes, and storage failure modes. `useTrack`, `useHeaderGlassFilter`, `useScrollEvent`, `useCyberstanEffects`, `useGlitchCycle` — all now have meaningful coverage with cleanup discipline.
- **Component coverage** — `UserSection`, galaxy `Map`, `eventToast`, `NotificationToggle`, `LiveToasts`, `FactionHealthChart`, `HomeClient`, `ArchivesClient`. Used a capture-style child-mock pattern (`testid` with JSON-encoded prop data) to verify orchestrator wiring without rendering real children.
- **Worker coverage** — `public/workers/cron.js` split into a thin entry shell + `cronLogic.js`. The shell is tested via `Module._load` monkey-patching; the logic via direct unit tests covering setTimeout-not-setInterval non-overlap, X-Worker-Startup first-poll header, error recovery without crashing the loop, and config wiring.

### Fixes

- **Per-faction stats missed ENEMIES_KILLED** — the per-faction view on the homepage never rendered `stats.kills` even though the data was present on each `h1_statistic` row. The global view already summed it. Added as position 2 in the per-faction grid (matching global's ordering).
- **`/api/h1/update` worker thread was broken in production** — `public/workers/cron.js` uses CommonJS `require('worker_threads')`, but the project's root `"type": "module"` made Node load it as ESM, crashing on every spawn. Fixed by adding `public/workers/package.json` with `{"type": "commonjs"}` to scope just the worker directory to CJS. Worker now stays online; worker-heartbeat data should resume in production.
- **`sendWithConcurrencyLimit` reported failed sends as "sent"** — the function returned `sent: subscriptions.length - staleEndpoints.length`, which counted 5xx and network errors as if they had succeeded. Now counts only `Promise.allSettled` results with status `'fulfilled'`. The admin `sendTestNotification` UI is the only consumer; its `{ sent, stale }` display is now truthful.
- **`formatCompactDuration` produced "1h, 30m" instead of "1h30m"** — set `delimiter: ''` alongside the existing `spacer: ''` to match the function's compact-output intent. Consumers (`FactionStats` avg duration, `RefreshSeasonButton` countdown, `EventLogCard` duration) all benefit from the tighter formatting.

### Refactors

- **Homepage layout consolidation** — merged the previously-separate `.home-hero-sidebar` and `.home-scrolly-log` into a single `.home-sidebar` flex column so the dashboard blocks (hero intro, season heading, region cards, stats) flow naturally into the event log below. Desktop grid drops from a 2-row-spanning-map to a straightforward 2-column layout: sidebar on the left, sticky galaxy map on the right. `DashboardClient` returns a Fragment instead of wrapping in `.dashboard-sidebar` so its sections sit directly as flex items of the sidebar, and the sidebar's `gap` provides uniform spacing across all boundaries. `ArchivesClient` and `src/app/archives/page.jsx` got the mirror cleanup (Fragment + Tailwind flex classes on the page wrapper).
- **Homepage region heading** — the `<h2>Regions</h2>` becomes `<h2>Season N</h2>` (reads the active season from live data).

### Documentation

- `/docs/frontend-layout` updated to describe the simplified 2-column grid (no more `grid-template-areas` with `hero-sidebar` / `scrolly-log`).

### Follow-ups filed during the campaign

- `#319` `/api/healthcheck` should probe DB on health check (currently returns a hardcoded `{ alive: true }`)
- `#320` `useLiveData` `navigator.onLine` check is dead code (overwritten by `poll()`)
- `#321` `useTrack` partial-umami guard (throws when `window.umami` exists but `track` is missing)
- `#322` `vitest.setup.mjs` `after()` mock auto-invokes synchronously (hides response-timing bugs)
- `#323` `public/workers/*` needed local `package.json` with `type: commonjs` (fixed in this release)

## 0.43.1

### Chores

- **Dependency bumps (npm minor/patch group)** — `next` & `@next/mdx` 16.2.4 → 16.2.6 (multiple HIGH-severity security advisories: SSRF via WebSocket upgrades, middleware/proxy bypasses, RSC DoS, RSC cache poisoning), `@prisma/client` & `@prisma/adapter-pg` & `prisma` 7.7.0 → 7.8.0, `@sentry/nextjs` 10.49.0 → 10.52.0, `@serwist/next` 9.5.7 → 9.5.11, `better-auth` 1.6.5 → 1.6.10, `axios` 1.15.0 → 1.16.0 (resolves `follow-redirects` 1.15.11 → 1.16.0 transitively), `react` & `react-dom` 19.2.5 → 19.2.6, `@tailwindcss/postcss` 4.2.2 → 4.3.0, `@vitest/coverage-v8` 4.1.4 → 4.1.5, `jsdom` 29.0.2 → 29.1.1, `prettier-plugin-tailwindcss` 0.7.2 → 0.8.0.
- **GitHub Actions bumps (actions group)** — `actions/setup-node` 6.3.0 → 6.4.0, `github/codeql-action` 3.30.6 → 3.30.8, `actions/dependency-review-action` 4.8.0 → 4.8.2, `docker/build-push-action` 6.21.1 → 6.22.0.

## 0.43.0

### Features

- **Regions campaign bar** — new `Sector / Campaign` toggle above the Regions cards on the homepage. Campaign view renders an 11-segment continuous progress bar per faction (sectors 1–10 driven by campaign points, segment 11 by the homeworld attack event). User preference persists in `localStorage`. In campaign view the dedicated homeworld-assault card is absorbed into segment 11 of the main card.
- **Live "Updated Xs ago" counter** — extracted `LastUpdated` into a shared component (`src/shared/components/LastUpdated.jsx`) and moved it from a static footer under the StatGrid to the hero sidebar, on the same row as the notifications toggle. Ticks every second (was 5s and effectively frozen under `reactCompiler: true`) and resets when the next poll arrives. Pass `now` as state so the compiler can't elide re-renders on the hidden `Date.now()` dependency.
- **Faction preference persistence** — homepage and archives both persist the selected faction (Global / Bugs / Cyborgs / Illuminate) to localStorage under `hd1-faction` and share the value across pages. Backed by a new generic `usePersistedState(key, default, isValid)` hook with domain wrappers (`useFactionPreference`, `useEventLogSort`).

### Fixes

- **Archives page flash** — `GlitchText` no longer uses `next/dynamic` with `ssr: false`. The h1 title and body text now ship in the initial HTML on defeat-season views instead of popping in after hydration. The glitch animation still plays as progressive enhancement post-hydration.
- **Footer alignment** — the "Not affiliated…" disclaimer is now top-aligned with the "Humblebee UAV Drone Mk. IV" line on the bottom separator row (was centered between the two lines of the Humblebee stack).

### Refactors

- **Shared `<Button>` primitive** — consolidated all bordered-button patterns across the app (stats faction toggles, regions view toggle, event log sort, archives effects toggle, admin buttons, error pages, account actions, API form buttons) into one `src/shared/components/Button/Button.jsx` with variants (`primary` / `danger` / `success` / `ghost` + three `faction-*`) and sizes (`icon` / `sm` / `md` / `lg`). Replaces ~15 inline Tailwind button signatures with a single primitive. Touch targets improve on mobile: icon mode is 40×40 below the `md:` breakpoint and 30×30 above. Dropped the now-obsolete `FactionTabs.css` file.
- **Homepage stats faction selector** — replaced the horizontal `FactionTabs` tab-bar with 4 faction-colored icon buttons rendered inline with the h2, matching the existing `RegionsViewToggle` convention. Static h2 reads "Stats" (was "Stats — {FactionName}").
- **Archives stats header** — moved `FactionTabs` inline with the "Statistics" h2 (previously a full-width row below), and reordered the right-side control cluster to place `SeasonSelector` before `EffectsToggle`.
- **`usePersistedState` hook** — extracted the scattered localStorage-backed preference logic (regions view, event log sort, faction) behind a single generic hook. Domain-named wrappers where de-duplication pays off; inline calls otherwise.

### Audit / correctness

- **StatGrid**: `ACCIDENTALS` replaced with `ACCIDENTAL_RATE` (accidentals/deaths as %) on global and per-faction views, with the absolute counts as hover title. Per-faction `MISSIONS` relabelled to `MISSIONS_WON` since the field is `successful_missions`. Added a clarifying comment noting why per-faction `players` sum is correct (disjoint populations) and that `total_unique_players` must never be summed (globally replicated field).
- **`evaluateProgress`** JSDoc now documents the linear-rate model and its known bias in early/late-season reads.
- **`countOutcomes`** locked in with a unit test asserting strict `status ∈ {'success','fail'}` matching (no case-folding, no loose match on `'won'`/`'lost'`).

## 0.42.0

### Features

- **Google OAuth** — added Google as a third sign-in provider alongside Discord and GitHub via BetterAuth. Includes official Google branding button on the sign-in page and profile account linking (supports different emails).

### Fixes

- **Worker bucket collision** — `updateSeason` no longer overwrites live `h1_status` buckets when reseeding historical data. Prevents stale snapshot data from clobbering active campaign progress.

### Chores

- Added `@references/` to `.gitignore` to prevent accidental commit of local SQL dumps containing secrets.
- Removed implemented `h1-tables-cleanup` design spec.

## 0.41.1

### Fixes

- **Galaxy map** — fixed false active-event indicator when the event timeline was off-screen. `useScrollEvent` now checks actual viewport visibility instead of pixel distance, preventing completed events from being shown as active on the map.
- **Service worker caching** — added `Cache-Control: no-cache` header on `/sw.js` so browsers always check for updates on navigation, preventing stale app code after deploys.

## 0.41.0

### Database

- **Schema consolidation** — 10 h1\_\*/rebroadcast tables → 5 normalized tables (`h1_season`, `h1_status`, `h1_statistic`, `h1_event`, `h1_event_progress`). Dropped `h1_live`, `h1_live_snapshot`, `h1_snapshot`, `h1_introduction_order`, `h1_points_max`, `h1_event_snapshot`, `rebroadcast_status`, `rebroadcast_snapshot`, `App`, `Review`.
- **Bucket-upsert pattern** — all timeseries tables use tumbling-window UPSERTs keyed on `(entity, bucket)` where `bucket = floor(poll_time / BUCKET_SIZE) * BUCKET_SIZE`. Sub-15s homepage freshness with ~120 MB bounded storage. `BUCKET_SIZE` is env-configurable (default 900 = 15 min).
- **`h1_season` inlining** — `introduction_order Int[]`, `points_max Int[]`, and `season_duration Int` are now direct columns on `h1_season` (previously in separate 1:1 tables).
- **`h1_snapshot.data` normalized** — stringified JSON-in-JSON column replaced by typed columns on `h1_status`. Consumers no longer need defensive `typeof === 'string' ? JSON.parse : data` parsing.
- **`h1_live.map` dropped** — precomputed galaxy map column was never read; `computeMapState` already rebuilds at request time.

### Worker

- **`snapshotTimers.mjs` deleted** — 91 lines of stateful in-memory throttle tracking replaced by 5-line deterministic `src/update/bucketing.mjs` helper. The DB uniqueness constraint IS the throttle.
- **`computeFactionMap` deleted** — precomputation removed; `computeMapState` rebuilds at request time.
- **`data.live` → `data.status`** — cascade rename across all consumers to match the `h1_live` → `h1_status` table rename. `/api/h1/live` URL and `useLiveData` hook stay.

### API

- **Rebroadcast endpoint** — reconstructs HD1 wire format from normalized tables on demand (no raw cache dependency). 4 event-count stats fields (`defend_events`, `successful_defend_events`, `attack_events`, `successful_attack_events`) omitted from statistics[] (derivable from `h1_event`).
- **`h1_event.players_at_start` null-protection** — update path only sets the field when a non-null value is present, preventing `get_snapshots` reseeds from clobbering live-captured values.

### Tooling

- **`scripts/backfill-h1-tables.mjs`** — offline reseed tool for production migration. Reads from pg_dump restore, writes to new schema via Prisma. Per-season transactional, resumable, `--force` flag.

### Documentation

- Updated DataFlowDiagram component, CLAUDE.md architecture section, and `/docs` pages (database, data-flow, utilities) for the new 5-table schema.

## 0.40.7

### Documentation

- **`CLAUDE.md`** — replaced stale `fetchAndSeedSeason` reference on
  the "On-demand season fetching" bullet. That function was deleted in
  0.40.5 during the backfill consolidation; the bullet now correctly
  names `updateSeason` (`src/update/season.mjs`) and enumerates which
  tables it writes plus the `last_updated` stamping behavior.
- **`prisma/seed/readme.md`** — expanded from a 4-line placeholder to
  a full workflow guide. Covers the layout of the seed directory, when
  and how to refresh the JSON files via `fetch-seasons.mjs` (including
  the post-0.40.6 "never active season" guarantee), how `seed.mjs`
  loads them via `prisma db seed`, the `FORCE_SEED=true` override for
  re-seeding when the DB already has parity, and how the three
  backfill paths (seed, fetch-seasons, runtime `updateSeason`) relate
  without conflict.
- **`src/app/docs/infrastructure/page.mdx`** — added a paragraph to
  the `Dockerfile.migrate` section explaining where the
  `seasons/*.json` files come from (`fetch-seasons.mjs`), why the
  active season is never captured, and pointing readers to
  `prisma/seed/readme.md` for the full workflow. Also noted the
  `seed.mjs` short-circuit behavior (`dbCount === jsonFiles.length`)
  and the `FORCE_SEED=true` override.

## 0.40.6

### Changed

- **`prisma/seed/fetch-seasons.mjs` no longer fetches the currently-active
  season.** The script's `--to` default used to resolve to the
  auto-detected current season from `get_campaign_status`, which meant
  every run captured the active season's partial mid-war state to disk.
  That partial file would then reseed incomplete data on every fresh
  deploy until the next manual refresh — exactly the failure pattern
  that caused season 156 to have only 17 snapshots on disk when its
  final state was 37. Now:
    - `--to` defaults to `currentSeason - 1` (the last completed season).
    - An explicit `--to=<current-or-higher>` is clamped to
      `currentSeason - 1` with a warning, so users cannot accidentally
      capture the active war.
    - A new guard exits early with an informative message if
      `--from > --to` after clamping (e.g. `--from=157 --to=157` when
      season 157 is active).

### Data

- **Refreshed all 156 completed-season seed files in
  `prisma/seed/seasons/`.** Running the updated script against the live
  API brought disk data to parity for 9 seasons with real drift:
    - Seasons 148-152: each was missing exactly one snapshot + one event
      (the closing frame pattern the 0.40.5 worker fix now prevents going
      forward).
    - Season 153: missing 21 snapshots + 39 defend events + 3 attack
      events (unusual drift — suggests an earlier run captured 153
      mid-war; 0.40.5 + the script guard would have prevented this).
    - Season 156: missing 20 snapshots + 33 defend events + 1 attack
      event (the known Apr 4 mid-season fetch, now complete).
    - Seasons 1-147, 154, 155 had no data changes; only the top-level
      `time` field (fetch timestamp) was refreshed. The `time` field is
      kept intentionally — it serves as a provenance marker for when each
      seed file was last validated against the live API.

    Fresh deploys using `prisma db seed` now get complete historical data
    for all 156 completed seasons instead of the partial Apr 4 snapshot.

## 0.40.5

### Fixed

- **Worker now captures the closing snapshot of an outgoing season during
  transitions.** When the HD1 API transitions from one season to the next,
  it writes one final "closing" snapshot to the old season's history a few
  minutes after the transition point. Previously,
  `src/app/api/h1/update/route.js` called `updateSeason(currentSeason)`
  only — once `getSeasonFromStatus` flipped to the new season, the worker
  abandoned the old one and never fetched that closing frame. Verified on
  season 156: DB had 36 snapshots, live API had 37 (the missing one at unix
  time `1776189902`, 4 minutes after our DB's `last_updated`). Fix:
  module-level `lastSeasonObserved` state in the route handler; if the
  current poll's season is higher, run `updateSeason(previousSeason)` once
  before processing the current season. Non-fatal on error — the current
  season's update still proceeds. Three new unit tests in
  `update.test.mjs` cover transition detection, no-op when season stays
  the same, and closing-pass failure isolation.
- **Season 156 missing closing snapshot.** One-time recovery: click the
  admin "Refresh" button on `/archives?season=156` after deploy to
  backfill the missing frame. The transition fix above prevents this
  recurring on future transitions.

### Changed

- **Consolidated `updateSeason` and `fetchAndSeedSeason` into one helper.**
  `src/db/queries/fetchAndSeedSeason.mjs` was a near-duplicate of
  `src/update/season.mjs` (`updateSeason`) — both did "fetch
  `get_snapshots`, validate, upsert into normalized tables."
  `updateSeason` does strictly more (also writes to `rebroadcast_season`
  and stamps `h1_season.last_updated` via `queryUpsertSeason(season, true)`).
    - Deleted `src/db/queries/fetchAndSeedSeason.mjs` and
      `src/__tests__/unit/queries/fetchAndSeedSeason.test.mjs`.
    - Migrated `src/app/archives/page.jsx` to call `updateSeason(season)`.
    - Migrated `src/features/archives/reseedSeason.mjs` to call
      `updateSeason(season)` and removed the now-redundant manual
      `db.h1_season.update({ last_updated: new Date() })` block
      (`updateSeason` stamps it internally). Updated
      `reseedSeason.test.mjs` accordingly.
    - Net effect: one backfill helper instead of two, no behavioral
      regression. The `/archives` on-demand path now also writes to
      `rebroadcast_season` — a pure addition; nothing previously depended
      on the absence of that write.

### Documentation

- **`CLAUDE.md`** updated the data-source separation rule to refer to
  `updateSeason` (post-consolidation) and added a new bullet documenting
  the season transition closing pass pattern.
- **`src/app/docs/utilities/page.mdx`** — section 13 rewritten from
  "On-Demand Season Fetching — `fetchAndSeedSeason`" to
  "On-Demand Season Fetching — `updateSeason`" with the three caller
  paths enumerated (worker poll, `/archives` on-demand, admin refresh).
- **`src/app/docs/data-flow/page.mdx`** — frontend on-demand fetching
  section updated to reference `updateSeason`; new "Season transition
  closing pass" subsection added.

## 0.40.4

### Fixed

- **Worker no longer spams `Multiple seasons present in status data`
  on every poll.** `getSeasonFromStatus` was aggregating the season
  field from `defend_event` into the current-season resolver, but the
  HD1 API's `defend_event` slot is a "most recent event" slot that
  persists across season transitions until replaced by a new defend
  event — exactly the same reason `attack_events` was already
  excluded with a `//can be from old season` comment. After the
  156→157 transition, `defend_event.season: 156` stuck around while
  `campaign_status` and `statistics` were all on 157, and the
  resolver's dedup log warned on every 10s poll. The algorithm's
  output was still accidentally correct (because `campaign_status`
  came first in the aggregation and `Set` iteration preserved
  insertion order, so `uniqueSeasons[0]` = 157), but the signal was
  fragile and the noise floor was unacceptable. Fix: exclude
  `defend_event` from `getSeasonFromStatus` entirely. The existing
  cross-season safety guard in `queryUpsertEvent`
  (`if (event.season !== season) skip`) already prevents lagged
  events from leaking into the wrong season bucket, so no new guards
  are needed downstream.

### Changed

- **`isValidStatus` now requires at least one entry in both
  `campaign_status` and `statistics`.** Previously the Zod schema
  accepted empty arrays, which would have crashed
  `getSeasonFromStatus` with `No seasons found in status data`. The
  real HD1 API always returns 3 entries each, so this `.min(1)`
  tightening codifies an assumption the resolver already made;
  malformed responses now fail at the input validator boundary
  instead of deeper in the worker pipeline. Replaced the old
  "accepts empty arrays" test with three separate cases covering
  the new contract.

### Documentation

- **`CLAUDE.md` now documents the data-source separation rule and
  the lagged event slots.** Added two bullets under
  **Architecture — Stack**:
    - `get_campaign_status` → `h1_live` (homepage live section) +
      `h1_event` (new events); `get_snapshots` → `h1_snapshot` +
      `h1_event` (historical); the two pipelines must not interact in
      backfill paths, and `fetchAndSeedSeason` must never touch
      `h1_live`. `h1_live_snapshot` is currently write-only — no
      consumers except `snapshotTimers.mjs`' throttle bootstrap.
    - `defend_event` and `attack_events` in `get_campaign_status` are
      "most recent event" slots that persist across transitions;
      `getSeasonFromStatus` must not use their `.season` as a
      current-season signal, and `queryUpsertEvent` has the skip guard
      as a safety net.

## 0.40.3

### Fixed

- **`/archives?season=N` no longer crashes with `TypeError: Cannot mix
BigInt and other types` for seasons that have both events and
  `h1_live` rows** (i.e. any season the worker was polling during).
  `ArchiveStats.sumBigInt` seeded its accumulator with `0n` and added
  `(f[field] ?? 0n)`, but only 5 of the 16 numeric fields in `h1_live`
  are actually `BigInt` in the Prisma schema (`kills`, `deaths`,
  `shots`, `hits`, `accidentals`); the others (`missions`,
  `successful_missions`, `total_unique_players`, `players`, ...) are
  `Int` and come back from Prisma as plain JS `Number`. Mixing them
  with a BigInt accumulator threw. Fix: coerce to BigInt explicitly
  with `BigInt(f[field] ?? 0)`, which is idempotent on BigInt input
  and safely converts integer Numbers. Added a JSDoc warning on
  `sumBigInt` listing the BigInt-vs-Int column split and the
  per-season fields that must never be summed.
- **`TOTAL_DIVERS` on `/archives` no longer triple-counts.**
  `ArchiveStats.jsx:160` was calling `sumBigInt(live, 'total_unique_players')`,
  but that field is documented in `/docs/database` and `/docs/hd1-api`
  as "Unique players across the season" — a global per-season value
  that the API repeats verbatim across all three faction rows. Summing
  turned a real `983` into `2,949`. Fixed by reading from a single row
  (`live[0]?.total_unique_players`). This was a latent bug masked by
  the BigInt crash; fixing the crash alone would have shipped wrong
  numbers publicly, so both fixes land together. Caught during a
  4-way adversarial design review (Gemini flagged it first).
- **Test fixtures now mirror real Prisma return types.** The existing
  `mockLive` in `ArchiveStats.test.jsx` used BigInt literals for every
  field including `missions`, `successful_missions`,
  `total_unique_players`, and `players` — fields that Prisma actually
  returns as JS `Number`. The test never reproduced the production
  bug. Rewrote the fixture so Int columns use `Number` and only the
  five actual BigInt columns use BigInt literals. Added a correctness
  assertion verifying `total_unique_players` is read from a single
  row (`100,000`), not summed across all three (`300,000`), so the
  triple-count regression cannot sneak back in.
- **Defensive zero-check in `formatPercent`/`formatRatio`.** Changed
  `denominator === 0n` → `!denominator`, which works for both BigInt
  `0n` and plain `0`. Safe today because denominators come from
  `sumBigInt` and are always BigInt, but the strict-equality check was
  brittle against any future caller passing a plain Number.

## 0.40.2

### Documentation

- **Release process in `CLAUDE.md` now documents the merge-back step.**
  After tagging `vX.Y.Z` on `main`, `main` must be merged back into
  `develop` (`git checkout develop && git merge origin/main && git push`)
  so that the PR merge commit GitHub creates on `main` lands on
  `develop` too. Without this, every release PR eventually fails the
  "head branch not up to date with base" protection check, because
  `main` accumulates merge commits `develop` has never seen — even
  though no actual code diverges. Discovered while releasing v0.40.1:
  three prior release merge commits (#276, #263, #237) had to be
  back-merged in one lump before the release PR could be merged.
  Going forward, doing the merge-back after every release keeps the
  topology clean.

## 0.40.1

### Changed

- **Archives `Statistics` and `Faction Analysis` sections merged into
  one.** The `Global` tab in `FactionTabs` previously rendered nothing
  (since `FactionStats` only maps Bugs/Cyborgs/Illuminate to enemy
  indices); it now renders the whole-war `<ArchiveStats>` overview
  instead. Bugs/Cyborgs/Illuminate tabs continue to render
  `<FactionStats>` per-faction. `/archives` now defaults to the
  `Global` tab on first load so visitors land on the overview before
  drilling into factions. The standalone `Faction Analysis` H2 is
  gone; all stat cards live under the single `Statistics` heading now.
  Composition change only — `ArchiveStats`, `FactionStats`, and
  `FactionTabs` internals are unchanged.

## 0.40.0

### Fixed

- **Pinned map gets symmetric 1rem top padding** to match the existing
  bottom padding, so the galaxy SVG no longer sits flush against the
  header's bottom edge. Applied to both `.home-map--sticky` and
  `.archives-map-col--sticky`, with matching `padding-top: 0` resets
  in the lg+ grid-cell overrides.
- **Pinned map backdrop no longer flickers transparent on scroll-down
  or when the header hides.** `public/scripts/headerGPU.js` was
  publishing `--header-bg` and `--header-glass-filter` via the same
  `setHeaderBg` function that mutated the `<header>` element's own
  `backgroundColor`. The header's direction-aware logic (paint
  transparent on scroll-down, glass on scroll-up) was correct for the
  header element itself but wrong for the pinned map, which is
  on-screen continuously and should not flicker. Split into
  `setHeaderElementBg` (direction-aware, header DOM only) and a new
  `publishMapBackdrop(scrollTop)` (direction-agnostic, CSS vars only).
  Map backdrop now follows a pure function of `scrollTop`: 0 alpha in
  the top zone (≤80px), linearly interpolated 0→0.85 through 80–240 px,
  full `rgba(19,19,19,0.85)` + `blur(8.8px)` past 240 px, regardless
  of scroll direction or whether the header element is currently
  visible. Mobile (<md) is unaffected — it already uses a solid
  `--color-surface-1` background and does not consume `--header-bg`.
  Also updates `src/app/docs/frontend-layout/page.mdx` to document
  the new direction-agnostic contract.

### Added

- **Admin-only "Refresh" button next to the season selector on
  `/archives`** — force re-fetches the currently-viewed season from the
  official HD1 API via `fetchAndSeedSeason()` and revalidates the page.
  Motivation: found an ingestion gap on season 153 where a failed
  region-0 defend (event_id 4774, Bugs attacker) was present in the
  raw rebroadcast snapshot but missing from the normalized `h1_event`
  table — likely because it was still `active` at the last poll
  before the worker rolled over to season 154, tripping the
  `isValidSeason.mjs` "no active defends" refinement and dropping the
  whole batch. New server action `src/features/archives/reseedSeason.mjs`
  wraps `fetchAndSeedSeason` with a BetterAuth admin check, stamps
  `h1_season.last_updated = now`, and calls `revalidatePath('/archives')`.
  Client button `src/features/archives/RefreshSeasonButton.jsx` uses
  `useTransition` for a pending state and calls `router.refresh()` on
  success. Disabled for 24 hours after the most recent refresh
  (driven by `data.last_updated` read from `getCampaign()`) to prevent
  API hammering — during cooldown the button label changes to
  `Next refresh in Nh` (via `formatCompactDuration`) so the reason is
  visible without hovering. The cooldown check runs in a `useEffect`
  so SSR always emits the static `Refresh` label and hydration stays
  clean. Hidden entirely for non-admin users. No UI change for regular
  visitors.

### Changed

- **Archives Statistics section: `WIN_RATE` split into `DEFENSE_RATE` +
  `ATTACK_RATE`; `NARROWEST_WIN` / `NARROWEST_LOSS` cards removed.**
  The old global `WIN_RATE` lumped defends and attacks together, which
  was dominated by defend counts (~77 defends vs ~3 attacks per season)
  and didn't correlate with the actual war outcome. It's now two
  independent cards: `DEFENSE_RATE` (`successfulDefends / defends`) and
  `ATTACK_RATE` (`successfulAttacks / attacks`), each with
  `N / total` subtitles and the same `>50% → success, ≤50% → danger`
  accent flip. `NARROWEST_WIN` / `NARROWEST_LOSS` were per-event cards
  with inverted mental models ("WIN" = defensive hold, "LOSS" = failed
  offensive) and vanished on blowout seasons due to a `> 0.5` gate —
  removed entirely. `WORST_CASCADE` retained since it tells a clear
  narrative ("N regions lost in a row to faction X"). The now-dead
  `findClosestCalls` function in `src/shared/utils/game/seasonAnalytics.mjs`
  and its unit tests have been deleted.
- **Archives stats flattened under single `Statistics` heading** — removed
  the internal `War Summary`, `Notable Moments`, and `Combat Record`
  sub-headings from `ArchiveStats.jsx`. All stat cards (outcome, duration,
  win rate, close calls, cascade, combat record) now flow as a single grid
  under the existing `<h2>Statistics</h2>` in `ArchivesClient.jsx`. Dropped
  the now-unused `sectionHeading` constant and `hasNotableMoments` gate.
- **Archives `DURATION` now derived from `h1_snapshot` poll span** —
  `ArchiveStats.jsx` reads `data.snapshots` (already selected by
  `getCampaign()`, ordered by `time: 'asc'`) and uses `last.time −
first.time`. Event span remains as a fallback for archives with fewer
  than two snapshots. Rendered in whole days as the main value
  (e.g. `52 days`, `1 day`) with a humanized breakdown as the
  subtitle (`humanize-duration` with `{ largest: 2, round: true }` —
  e.g. `8 weeks, 3 days`). The day-only headline makes season-to-season
  comparison easy; the humanized subtitle surfaces the shape of the
  war without forcing a mental conversion from raw minutes. Reason:
  archive analytics must derive from snapshot data, not `h1_live`
  (homepage-only).
- **Archives `OUTCOME` card now shows the attributed faction as a
  subtitle** — `getWarOutcome.mjs` returns a new `faction` field
  (number 0–2 or null). Victory: enemy id of the latest successful
  attack event ("who did the Helldivers defeat last"). Defeat: enemy id
  of the latest failed region-0 defend event ("who were the Helldivers
  defeated by"). `null` when no such event exists — no fallback
  guessing from other signals. `ArchiveStats.jsx` renders the faction
  name from `src/shared/enums/factions.mjs` as the card subtitle, or
  hides it when faction cannot be attributed.

## 0.39.15

### Documentation

- **New `/docs/frontend-layout` page** covering the pinned-map state
  machine end-to-end: class layering (`--sticky` vs `--pinning`), the
  slide-in-from-behind-header animation, the scroll-hiding header
  integration via `--header-offset`, the tablet background mirror
  (`--header-bg`), the Lightning CSS backdrop-filter workaround and
  the `useHeaderGlassFilter` hook, desktop `lg+` grid cell layout,
  and a full reference of source files and changelog entries that
  led to the current implementation. Added to the `DocsSidebar` under
  the `Architecture` section.
- **Expanded top-of-file JSDoc** in the critical files that
  participate in the pinned-map pipeline: `HomeClient.jsx`,
  `ArchivesClient.jsx`, `HomeClient.css`, `ArchivesLayout.css`,
  `public/scripts/headerGPU.js`, `Header.jsx`, `Map.jsx`. Each file
  now carries a brief narrative of what it does, how it relates to
  the three CSS custom properties published by `headerGPU.js`, and
  why specific values (`z-40` / `z-50`, `top: 49/79px`,
  `preserveAspectRatio="xMaxYMid meet"`) were chosen.
- **`README.md` refresh** to reflect the current app state:
  corrected the outdated "Server-Sent Events (SSE)" reference to
  match the actual polling-based live data loop (`useLiveData` hook
    - `BroadcastChannel` leader election); added a "Stack at a glance"
      table covering framework, database, auth, PWA, observability,
      analytics, and testing; added a "Frontend at a glance" section
      summarizing the interactive galaxy map, scrollytelling event log,
      pinned-map state machine, and live polling loop; updated the API
      section with `/api/h1/live` and the internal routes
      (`/api/healthcheck`, `/api/notifications/subscribe`,
      `/api/auth/[...all]`, `/api/umami`, `/api/glitchtip`); and noted
      that all user features are gated behind `BETTER_AUTH_SECRET` so
      auth is optional.

## 0.39.14

### Bug Fixes

- **Max-height cap now only applies when the map is pinned**, not in its natural flow position. v0.39.12 applied `max-height: 55dvh` + aspect-width cap + `margin-inline: auto` centering to `.home-map #map > svg` / `.archives-map-col #map > svg` regardless of pin state. Moved the rule to `.home-map--sticky #map > svg` / `.archives-map-col--sticky #map > svg`. On homepage, an unpinned galaxy renders at its full natural size; after FAB click, the cap kicks in. (Archives defaults to `--sticky` on from mount — see below — so the cap is still active from first paint on that page; the user accepted the trade-off.)
- **Replaced the clip-path pin-in animation with a slide-in-from-behind-header keyframe.** v0.39.10's `clip-path: inset(0 0 100% 0) → inset(0 0 0 0)` unfurled the map top-down at its sticky position — subjectively felt more like "drawn in place" than "slid in." New keyframe uses `transform: translateY(calc(var(--header-offset, 0px) - 100% - 80px))` → `translateY(var(--header-offset, 0px))` so the map starts fully above the viewport (shifted by its own height + an 80px header-height buffer) and slides down to its resting position. During the slide, a transient `.home-map--pinning` / `.archives-map-col--pinning` class drops the map's `z-index` from `50` to `10`, which puts it below the header's `z-40` — the header literally occludes the map while it slides, so it emerges from behind the header rather than sliding on top. After 400ms JS removes the transient class, `z-index` snaps back to `50`, and the 1px border-overlap trick works again. Composes cleanly with the live `--header-offset` tracking via the same transform property.
- **Pinned-map styles are now split between two classes** so the slide animation only plays on explicit pin transitions. Previously `.home-map--sticky` carried both the pinned visuals (`position: sticky`, `top`, `z-index`, `background`, etc.) AND the `animation` property, which meant the animation re-triggered on every mount — fine for the homepage (default unpinned → FAB click adds class) but wrong for archives default-pinned (class applied from first paint would auto-play the animation). New split: `--sticky` owns the persistent pinned styles only; `--pinning` is a transient class added for exactly 400ms by `togglePin`'s `setTimeout` when the React state flips from unpinned → pinned, and it owns `z-index: 10 + animation`. On mount (including archives default true), `isAnimating` starts `false`, no `--pinning` class, no animation.
- **Pinned map background on tablet+ now mirrors the header's live state via CSS vars + a React hook.** Mobile (<md) keeps its solid `var(--color-surface-1)` + ghost border. At md+ (≥768px) where the header is transparent by default and gains `rgba(19, 19, 19, 0.85)` + `backdrop-filter: blur(8.8px)` when scroll-revealed mid-page, the map now reads `background: var(--header-bg, transparent)` directly from CSS via a custom property published on `<html>` by `headerGPU.js`'s new `setHeaderBg()` helper. The map's background tracks the header 1:1 at every scroll state with no separate JS coupling on the React side. The matching `backdrop-filter: blur(8.8px)` had to be applied via inline `style={{ backdropFilter, WebkitBackdropFilter }}` in `HomeClient.jsx` / `ArchivesClient.jsx` because Lightning CSS (Turbopack's CSS optimizer) strips `backdrop-filter` declarations that reference custom properties from the built stylesheet — same issue that bit v0.39.7. A new `useHeaderGlassFilter` hook (`src/shared/hooks/useHeaderGlassFilter.mjs`) reads the `--header-glass-filter` var and updates via `MutationObserver` on `<html>`'s style attribute, bailing on no-op re-renders so the 60-fps scroll updates to `--header-bg` don't cause React churn.
- **Archives is pinned by default.** `ArchivesClient.jsx:isMapSticky` initial state flipped from `false` to `true`. The map starts in its natural flow position below the stats section; native `position: sticky` engages silently as the user scrolls down to it (same semantics as clicking the homepage FAB when already past the threshold). The slide animation deliberately does NOT play on first load because `isAnimating` remains `false` through mount. The FAB stays present on both pages — it still toggles pinned state, and re-pinning via the FAB plays the slide animation on both. Only the initial state differs.

## 0.39.13

### Bug Fixes

- **Pinned galaxy map now follows the scroll-hiding header on tablet.** At `md+` (≥768px) the header uses `public/scripts/headerGPU.js` to shift its own `top` by scroll delta (0 at rest, `-80px` when fully hidden), creating a "parks just above the viewport" effect. The sticky pinned map stayed fixed at `top: 79px` regardless, so when the header scrolled away there was an 80px empty band above the map — the map looked disconnected from the header bar it visually belongs to. Now `headerGPU.js` also writes the current offset as a `--header-offset` CSS custom property on `<html>`, and `.home-map--sticky` / `.archives-map-col--sticky` apply `transform: translateY(var(--header-offset, 0px))` so the map's visual position tracks the header 1:1. Layout-wise the sticky box still pins at `top: 49/79px`, so pin/unpin geometry and the `clip-path` reveal animation are untouched — only the rendered pixels shift.
- Uses `transform` rather than mutating `top` so the browser's sticky-engagement math (which looks at the element's natural layout position, not its transform) continues to work, and shifts happen on the GPU without triggering layout recalcs during scroll.
- `headerGPU.js` drops the custom property in `resetHeader()` when the breakpoint drops below `md`, so the fallback `0px` kicks in and the map visually sits at its normal sticky position — no stale offset bleeding between breakpoints. Desktop `lg+` reset block also explicitly sets `transform: none` for stale-class safety when a viewport resize from tablet to desktop leaves the `--sticky` modifier on.

## 0.39.12

### Bug Fixes

- **Mobile galaxy map is now capped at `55dvh` and horizontally centered.** The galaxy's natural aspect ratio (`806.93 / 868.81` ≈ 0.928) means at a portrait-tablet viewport width like 768px the SVG would render ~827px tall, filling >80% of a 1024px iPad viewport and visually "covering" the page. Cap the SVG's `max-height` at `55dvh` so it takes about half the visible viewport and the rest of the dashboard (event log, etc.) stays in view.
- **Horizontal centering was tricky** because `Map.jsx`'s SVG uses `preserveAspectRatio="xMaxYMid meet"` — when the SVG box has leftover horizontal space, that alignment pushes content hard against the right edge, which on a capped-height tablet layout would leave a big empty dark band on the left instead of centered content. Rather than change the preserveAspectRatio (which affects the desktop right-column map too), cap `max-width: calc(55dvh * 806.93 / 868.81)` so the SVG box itself matches the content's aspect ratio exactly — no leftover horizontal space inside the SVG for `xMax` to push into — and then `margin-inline: auto` centers the whole shrunk box inside the full-bleed sticky panel.
- Applies to `.home-map #map > svg` and `.archives-map-col #map > svg` (scoped to the galaxy's Map.jsx wrapper so incidental icon SVGs elsewhere aren't caught). Explicit `max-height: none` / `max-width: none` / `margin-inline: 0` reset inside the `@media (min-width: 1024px)` block unwinds all three at desktop so the real grid cell is sized by its flex chain.

## 0.39.11

### Bug Fixes

- **Sticky mobile map is now visually seamless with the header.** Four small changes combined: (1) map `top` dropped from `50px` → `49px` (and `80px` → `79px` at sm+) so the map's top row lands on the exact pixel where the header's 1px bottom border is drawn; (2) header demoted from `z-50` → `z-40` and pinned map bumped from `z-10` → `z-50` so the map wins at that 1px overlap and its `surface-1` background overpaints the ghost hairline — no more visible seam between the two dark panels; (3) full-bleed `margin-inline: calc(50% - 50vw)` + `padding-inline: calc(50vw - 50%)` pull the pinned map's background out past the `.gutters` horizontal padding so the surface-1 panel spans edge-to-edge like the header does; (4) `padding-bottom: 1rem` added so the galaxy SVG no longer touches the map's own ghost-colored bottom border (matches the mobile gutter `px-4`).
- All four apply to `.home-map--sticky` (homepage) and `.archives-map-col--sticky` (archives) identically. The desktop `lg+` reset block explicitly unwinds all of them so a stale modifier class left over from a mobile→desktop viewport resize can't leak into the desktop grid column. Only the header's Tailwind class (`src/shared/components/Header/Header.jsx:15`) changes on the JSX side.
- Grepped for `z-40` / `z-50` collisions before demoting the header: none found. BottomNav at `z-50` is bottom-of-viewport and doesn't visually overlap with the top-pinned map; the `focus:z-50` skip-to-content link (`src/app/layout.jsx:187`) still sits above both the demoted header and the pinned map when focused; Navigation's own inner `z-50` lives inside the header's own stacking context (now rooted at 40 globally) and is visually unaffected.

## 0.39.10

### Bug Fixes

- **Sticky mobile map now shares the header's background for a continuous "plane" look.** v0.39.8 drew a `filter: drop-shadow()` halo around the pinned galaxy; v0.39.10 replaces that with a solid `background: var(--color-surface-1)` + `border-bottom: 1px solid var(--color-ghost)` applied only on mobile (reset to transparent at `lg+`). This matches the header's own mobile styling so the pinned map and fixed header read as one dark panel at the top of the viewport.
- **Pin-in animation switched to a `clip-path: inset(0 0 100% 0) → inset(0 0 0 0)` reveal** instead of a `translateY` slide. The translate variant would have revealed the map's bottom edge first — with `position: sticky; top: 50px`, a negative translate shifts the whole box up so its bottom sits at y=50, meaning the _bottom half_ arrives first, not the top. The clip-path variant reveals top-down from the header's bottom edge, which is the intended "slide out from behind the header" feel. Duration bumped from 280ms → 400ms for the larger reveal. `@media (prefers-reduced-motion: reduce)` still disables the animation entirely.
- Applies identically to `.home-map--sticky` and `.archives-map-col--sticky`.

## 0.39.9

### Bug Fixes

- **Scroll-sync "selected event" anchor now sits at 75% of viewport height on mobile (<1024px), up from 38%.** On mobile, when the user pins the galaxy map to the top via the FAB, the pinned map occupies roughly the upper half of the viewport — with the previous 38% anchor, the scroll-sync hook selected whichever event card was closest to 38% down the visible area, which landed _behind_ the pinned map's drop-shadow halo. The selected card was effectively invisible. Bumping the mobile anchor to 75% keeps the highlighted card in the lower quarter of the viewport, always visible below the pinned map area. Desktop anchor stays at 38% because the map is in the right column there, not overlapping the event log. Drift range on mobile (`0.15`) is also tighter than desktop (`0.24`) so the anchor stays below 90% even at page bottom.
- Single change to `src/features/archives/useScrollEvent.mjs` — self-detects mobile viewport via `window.innerWidth < 1024` inside the scroll handler, no caller changes.

## 0.39.8

### Changes

- **Sticky mobile map now uses a CSS drop-shadow halo instead of a radial gradient fill.** v0.39.7 used `background: radial-gradient(...)` + `backdrop-filter: blur()` to create a frosted-glass effect, but the gradient filled the full rectangular map container and occluded content in corners. Replaced with a two-layer `filter: drop-shadow()` stack that casts a soft dark halo around the SVG galaxy's actual visible shape — the shadow follows the paths of the map and fades radially away from them. Content scrolling behind the map stays fully visible wherever the galaxy shape doesn't reach, so event log cards are clearly readable at the corners and sides; only the area immediately around the map's visible content is darkened. The double-layered shadow (24px blur + 8px blur, both near-black) gives the halo enough density to read against bright scrolling content without using any backdrop-filter or background fill. Applies to both `.home-map--sticky` and `.archives-map-col--sticky`, both now pure CSS (no inline-style workaround — `filter: drop-shadow` isn't stripped by Lightning CSS the way `backdrop-filter` was).

## 0.39.7

### Changes

- **Sticky mobile map now uses a frosted-glass effect instead of a solid black background.** Both `.home-map--sticky` (homepage) and `.archives-map-col--sticky` (archives) previously had `background: var(--color-surface-0)` which painted a hard rectangular occlusion over scrolling content. Replaced with `background: radial-gradient(ellipse at center, rgba(19,19,19,0.85) 20%, rgba(19,19,19,0.45) 65%, rgba(19,19,19,0) 100%)` — the center stays opaque enough for map legibility while the edges fade to fully transparent. A `backdrop-filter: blur(10px)` adds a soft blur to whatever content scrolls behind the map, completing the frosted-glass feel. Event log cards are now visible through the gradient edges rather than disappearing behind a dark rectangle.

### Workaround

- **`backdrop-filter` applied via inline style, not CSS.** Lightning CSS (the Turbopack-integrated optimizer) strips the un-prefixed `backdrop-filter` declaration from stylesheets and leaves only the `-webkit-backdrop-filter` prefix. Chrome does not apply the `-webkit-` prefix as a fallback for the standard property, so the blur ended up as a no-op when declared in `HomeClient.css`/`ArchivesLayout.css`. Declaring it via `style={{ backdropFilter, WebkitBackdropFilter }}` on the JSX elements bypasses Lightning CSS entirely.

## 0.39.6

### Changes

- **`/archives` mobile map toggle now matches the homepage's pin/unpin semantics** instead of show/hide. Default is **unpinned** — the archives galaxy map is at the top of the mobile flex column in normal flow and scrolls away as you read the event log, like a regular section. Tap the `.archives-map-toggle` FAB (📌 icon) to add the `.archives-map-col--sticky` modifier class, which applies `position: sticky; top: 50px` (80px at `sm+`), `z-index: 10`, `background: var(--color-surface-0)`, and a 280ms fade-in animation. The map pins at the top of the viewport and stays visible as you continue scrolling. Tap again (✕ icon) to unpin — map returns to normal flow.
- This is a behavior change from the previous version where `.archives-map-col` was always sticky on mobile and the FAB toggled visibility via conditional rendering. The map is now always rendered (scroll-sync selection still fires) but only becomes sticky on opt-in. Matches `v0.39.5`'s homepage implementation exactly.

## 0.39.5

### Features

- **Homepage mobile map pin/unpin toggle.** Added a floating-action button that toggles whether the galaxy map is sticky (pinned at the top of the viewport) or scrolls away with the page. Default is **unpinned** — the map renders in normal flow at the top of the mobile layout and scrolls away like it did before. Tap the FAB (📌 icon) to pin the map: `.home-map` gains the `.home-map--sticky` modifier class, which adds `position: sticky; top: 50px` (80px at `sm+`), `z-index: 10`, and `background: var(--color-surface-0)` — the map snaps to the top of the viewport below the header and stays visible as the user continues scrolling. Tap again (✕ icon) to unpin. A subtle 280ms fade-in + slide-down animation (`@keyframes home-map-pin-in`) softens the pinning transition when pinning an already-scrolled-past map, disabled under `prefers-reduced-motion: reduce`.
- The FAB is fixed at the bottom-right of the viewport above the BottomNav, mirroring the `.archives-map-toggle` pattern. Hidden at `lg+` (desktop) since the desktop grid layout applies its own permanent sticky behavior to the map column regardless of this state.

## 0.39.4

### Bug Fixes

- **Galaxy SVG no longer overflows its `#map` wrapper.** v0.39.3 fixed `.home-map` → `#galaxy` sizing via the flex chain, but the leak continued one level deeper: inside `src/features/galaxy/Map.jsx`, the `<div id="map" className="max-h-full w-full">` wrapper had no concrete height, and Tailwind's `max-h-full` resolves to `max-height: 100%` which needs an explicit parent height to apply. The SVG inside had `h-full w-full` with the same problem, so it fell back to its intrinsic size derived from its viewBox and the parent's width — ending up ~32px taller than its container at desktop widths, clipping the bottom of the map below the viewport fold. Fixed by extending the flex-layout chain through Map.jsx: `#map` is now `flex flex-col flex-1 min-h-0 w-full` (a flex child of `#galaxy`), and the `<svg>` is `flex-1 min-h-0 min-w-0 w-full` (a flex child of `#map`). Every layer down to the SVG now correctly resolves height from its flex parent. Fix applies to both `/` and `/archives` since `Map.jsx` is the shared rendering component.

### Testing

- DevTools verification on `/` at 1710×934: all four layers (`.home-map`, `#galaxy`, `#map`, `<svg>`) are now 822px tall with `bottom: 918px` (16px of breathing room before the viewport edge at 934). Before the fix the SVG was 854px and extended to 949.99 — 16px below the viewport.
- DevTools verification on `/archives` at the same viewport: all layers in sync at 822px when unscrolled, and sticky map pins correctly when scrolled (clamped to whatever the max-height resolves to at the current scroll position).

## 0.39.3

### Bug Fixes

- **Homepage galaxy map no longer overflows its container at the bottom.** v0.39.1's new `.home-map` grid cell had `max-height: calc(100dvh - 80px - 2rem)` but no `display: flex` — so Galaxy's inner `<section class="h-full w-full">` had no concrete parent height to resolve `h-full` against, and the SVG fell back to its intrinsic size and spilled past the cell boundary into the viewport below. Fixed by making `.home-map` a flex column and setting `flex: 1; min-height: 0; min-width: 0` on its first child, matching the pattern `.archives-map-col` already uses.

## 0.39.2

### Bug Fixes

- **Removed the redundant "selected event" info card overlay on `/archives`.** The small card that displayed region + faction + duration + WON/LOST status below the map when an event was scroll-selected is now unnecessary — the event log itself (now in the left column of the scrollytelling grid with `border-l-primary` highlighting the selected card) already shows all that information more clearly. Dropped the unused `factions` and `getEventRegionLabel` imports that only fed that overlay.

## 0.39.1

### Bug Fixes

- **Simplified the homepage scrollytelling map.** v0.39.0's fixed-position overlay + size-transition animation was overengineered — the event log column has the same width as the hero sidebar, so the map doesn't need to resize at all, it just needs to stay pinned at the same size across both sections. Replaced the overlay with a single grid-spanning sticky map: `HomeClient` owns one continuous two-row grid where the right column (the galaxy map) spans both the hero row and the scrollytelling row, with `position: sticky; top: 80px`. One `<Galaxy>` instance, one `mapState` prop that switches between live and `computeMapStateAtEvent(selectedEvent, data)` depending on whether `useScrollEvent` has latched onto a card.
- **`/archives` grid now matches the homepage dimensions.** Changed `ArchivesLayout.css` `.archives-scrollytelling` from `grid-template-columns: minmax(260px, 1fr) minmax(0, 50dvh)` to the same `minmax(260px, 1fr) minmax(0, calc((100dvh - 80px) * 806.93 / 868.81))` the homepage uses. Both pages now present the same visual map anchor; only the data (live now vs. historical season) differs. The archives grid also moved from the `md:` (768px) breakpoint to `lg:` (1024px) to match the homepage.

### Chores

- **Deleted** `HomeGalaxyOverlay.jsx`, `HomeGalaxyOverlay.css`, `HomeScrollytelling.jsx`, `HomeScrollytelling.css`, `useHomeMapPinned.mjs`, and `useHomeMapPinned.test.mjs` — the entire overlay + scroll-threshold animation infrastructure from v0.39.0.
- **Stripped `DashboardClient`** of its grid layout and inline galaxy map — it's now a pure sidebar-content component. The grid layout and the galaxy map both live in `HomeClient` now. `.dashboard-scroll-hint` also removed (the grid is continuous; no scroll hint needed).
- New `src/features/dashboard/HomeClient.css` owns the home grid: flex column at mobile, two-row grid with a spanning map column at `lg+`.
- Removed the obsolete `galaxy` and `scroll-hint-button` assertions from `DashboardClient.test.jsx`.

## 0.39.0

### Features

- **Homepage scrollytelling galaxy map.** Ported the archives "animate map + select event on scroll" pattern to `/`. Below the hero, the homepage now has a 2-column scrollytelling section: single-column event log on the left, pinned galaxy map on the right. As you scroll through the event log, the map time-travels to show what the galaxy looked like at the currently-focused event's moment (same `computeMapStateAtEvent` logic archives uses). The map itself transitions from its big hero size to a small pinned sidebar position via a state-driven CSS transition — the boolean flips when ≤25% of the hero is still visible, and a single 400ms `top/right/width/height` animation handles the shrink + reposition. Narrative: "live now" (hero) → "recent past" (scrollytelling).
- Homepage event log now uses `layout="stack"` — same vertical single-column layout archives uses, required for `useScrollEvent`'s DOM-order optimization.

### Chores

- Extracted `computeMapStateAtEvent` from `src/features/archives/ArchiveMap.jsx` into `src/shared/utils/game/computeMapStateAtEvent.mjs` so it can be reused by both `ArchiveMap` and the new homepage `HomeGalaxyOverlay`.
- Deleted `src/features/timeline/HomeEventLog.jsx` — its only job (feeding `LiveDataContext` into `EventLog`) is now inlined inside `HomeScrollytelling`.
- New `HomeClient.jsx` wrapper owns the hero `useRef` and lets `src/app/page.jsx` remain a server component with its metadata/JSON-LD exports intact.

### Mobile

- Mobile (<1024px) is unaffected: the inline galaxy map stays inside the hero, the event log stacks below it in normal flow, no sticky map or scroll-driven transitions. The `HomeGalaxyOverlay` is hidden via `display: none` below `lg:`.

## 0.38.2

### Improvements

- **Toasts now render at `top-center` on mobile, `bottom-right` on desktop.** Matches native iOS/Android push notification placement (where users instinctively look for "something just happened" feedback) and clears the bottom of the screen which is occupied by `BottomNav` on mobile. Desktop layout is unchanged. Implemented in `LiveToasts.jsx` by detecting viewport once on mount via `window.matchMedia('(max-width: 767px)')` and keying the `<Toaster>` so Sonner remounts with the correct `position` (it reads the prop only at first mount and ignores subsequent changes). Page-load detection only — resize-during-session is intentionally not supported. Closes #285.

## 0.38.1

### Bug Fixes

- **`/archives` — restored scroll-sync ("animate map + select event") and the vertical stack layout** that was lost in v0.38.0. The unified-event-log rename (`timeline-day-grid` → `event-log-day-grid`) left a stale CSS override in `ArchivesLayout.css` that used to force the archive event rail to a single vertical column; without that override, the new `EventLog.css` desktop grid (`repeat(2/3/4, 1fr)` at md/lg/xl) took over and wrapped cards into columns. The multi-column grid in turn broke `useScrollEvent`'s DOM-order early-break optimization (which only holds when cards are vertically stacked), so scrolling the event rail no longer synced the selected event to the map.
- **Fix:** `EventLog` gains an explicit `layout: 'grid' | 'stack'` prop. `ArchivesClient.jsx` passes `layout="stack"` to force a single-column flex layout at all widths via the new `.event-log-days--stack` class in `EventLog.css`. `useScrollEvent` is unchanged — once cards are stacked vertically again, the DOM-order assumption holds and scroll-sync works.
- Removed stale `.archives-event-col .timeline-*` overrides from `ArchivesLayout.css` (they targeted classes that no longer exist).

## 0.38.0

### Features

- **Unified event log across homepage and archives.** Removed the vertical timeline rail from the desktop homepage event log — the day-grouped card list is now the single source of truth for both `/` and `/archives`, fed different data by each page via a new shared `EventLog` component. Added a square sort-order toggle (newest ↔ oldest) next to the event log title, with preference persisted to `localStorage` and shared between both pages. Archives cards now show an absolute date/time (e.g. `Apr 4, 2026 · 14:23`) instead of a relative "ended X ago" string; homepage cards continue to tick live with "Started X ago" / "Ended X ago" plus points progress.

### Chores

- Consolidated `Event.jsx` + `ArchiveEvent.jsx` → single `EventLogCard` with a `timeFormat` prop that flips between ticking relative time (`'live'`) and static absolute timestamps (`'absolute'`).
- Consolidated `TimelineSection.jsx` + `ArchiveEventRail.jsx` → single `EventLog` component consumed by `HomeEventLog.jsx` (homepage wrapper) and directly by `ArchivesClient.jsx`.
- Extended `groupEventsByDay` with an optional `sortOrder: 'asc' | 'desc'` parameter; default remains `'desc'` for backwards compatibility.
- Deleted `TimelineSection.css`, `Event.jsx`, `ArchiveEvent.jsx`, `ArchiveEventRail.jsx`, and their stale test files (`TimelineSection.test.jsx`, `ArchiveEventRail.test.jsx`, `Event.test.jsx`).

## 0.37.11

### Security

- **Stopped leaking `SENTRY_AUTH_TOKEN` (and the other Sentry credentials) via the image's BuildKit provenance attestation.** `Dockerfile.app` previously declared `ARG SENTRY_AUTH_TOKEN` etc., and `staging.docker.yml` / `release.docker.yml` populated them via `build-args:` from `secrets.SENTRY_AUTH_TOKEN`. The substituted values landed in the SLSA provenance metadata that BuildKit pushes alongside each image — for the public `ghcr.io/elfensky/helldiversbot:staging` and `:latest` packages, that meant anyone with anonymous `docker pull` access could extract the token via `docker buildx imagetools inspect`. Replaced with BuildKit `--mount=type=secret,id=...,env=...` directives in the build RUN, plus matching `secrets:` inputs in both workflow files. Secrets mounted this way live only in the RUN's tmpfs, never touch any image layer, build cache, or attestation. The `SENTRY_AUTH_TOKEN` has been rotated. Closes #284.

### Chores

- Same change also resolves the recurring `SecretsUsedInArgOrEnv` BuildKit lint warning that has been present in every CI build since #283 added `# syntax=docker/dockerfile:1`.

## 0.37.10

### Bug Fixes

- **`Dockerfile.app` HEALTHCHECK was silently failing on every probe** because the directive shelled out to `curl`, which is not installed in `node:24-alpine` (only busybox `wget` exists). Containers were being reported as `unhealthy` forever — broken monitoring and a real issue if anything downstream consumes the health status. Replaced with `wget --quiet --spider --tries=1 http://127.0.0.1:3000/api/healthcheck`. Also bumped `--start-period` from 5s to 30s so a Next.js cold-start (5–15 seconds) doesn't trip the probe before the server is ready.

### Chores

- **`Dockerfile.app` slim-down**: stripped Sharp's glibc-arm64 and glibc-x64 binaries (`@img/sharp-libvips-linux-{arm64,x64}` and `@img/sharp-linux-{arm64,x64}`) immediately after `npm ci`. Alpine is musl, so the linuxmusl variants are the only ones loaded at runtime; the glibc variants are pulled in defensively as npm optional deps but never `dlopen()`'d on a musl host. Saves ~16.6 MB on the final image because Next.js's `@vercel/nft` standalone trace would otherwise include them. Image: 407 MB → ~390 MB.
- **Added BuildKit cache mounts** to both deps (`/root/.npm`) and builder (`/app/.next/cache`) RUN steps. The npm download cache and Next.js webpack/turbopack compilation cache now persist outside the image across builds — typically 60–80% faster rebuilds in CI once the cache is warm. Zero impact on the final image (cache lives in BuildKit storage, not in any image layer). Requires the `# syntax=docker/dockerfile:1` directive at the top of the file, which is now present.
- **Improved `.dockerignore`** with exclusions for IDE configs (`.vscode`, `.idea`), test files (`src/**/*.test.*`, `src/**/__tests__`), vitest configs, prettier configs, and explicit `coverage`/`docs`/`CHANGELOG.md` entries. Doesn't affect image size — improves build context transfer speed (~5–10%) and prevents the `COPY . .` builder cache layer from being invalidated when test files or docs change.

Closes #283.

## 0.37.9

### Chores

- **Synced `package-lock.json`** — committed the pending Next.js patch bump (`16.2.2 → 16.2.3`, plus matching `@next/env`, `@next/mdx`, and `@next/swc-*` platform variants) that had been sitting unstaged after an out-of-band `npm install`. Also corrected the lockfile's project `version` field, which had drifted from `0.33.0` because successive `package.json` version bumps weren't paired with `npm install` runs. Closes #282.

## 0.37.8

### Chores

- **`Dockerfile.migrate` is now self-documenting.** Added detailed inline comments explaining each section: why this image exists separately from `Dockerfile.app`, why the install pattern looks unusual (project package.json on disk = npm pulls 1.2 GB of Next.js deps; the `/tmp` reference + minimal `package.json` workaround keeps the install to ~300 MB), why each of the 4 packages is needed, why everything is one big chained `RUN` (single image layer), and why `chown -R` was deliberately omitted (~1.4 GB of layer-doubling waste). No behavior change — purely documentation. Closes #281.

## 0.37.7

### Chores

- **Removed commit SHA from the footer and build-time console.info.** Footer now shows only `v{version} – {environment}` instead of `v{version} – {sha} – {environment}`. Dropped the `COMMIT_SHA` computation and `NEXT_PUBLIC_COMMIT_SHA` env var from `next.config.mjs` entirely, along with the `console.info` line it used. Sentry's own release tracking is unaffected — it reads from distinct CI-provided env vars (`CI_COMMIT_SHA`, `VERCEL_GIT_COMMIT_SHA`, etc.).

## 0.37.6

### Bug Fixes

- **Admin push notification tester now supports stateful transitions** — same pattern as the toast tester in 0.37.5. Push `Started` creates a fresh notification with a new high-range random `event_id` (900M+ range, no collision with real ids). `Won`/`Lost` re-use the same `event_id`, which matches the existing pushNotifier tag convention (`tag: event-${event_id}` + `renotify: true`) so the browser replaces the previous notification in place. `sendTestNotification` server action accepts an optional `event_id` parameter; legacy calls without it still get a fresh random id.

## 0.37.5

### Bug Fixes

- **Dismissed toasts now stay fully suppressed across reloads until the event's status actually changes.** The old implementation used a soft-reappear pattern (8-second auto-dismiss for previously-dismissed toasts on page load), which meant users who closed a toast still saw it flash briefly every time they returned. The new implementation tracks dismissals as `{eventId: statusAtDismissal}` — on catch-up, an event whose dismissed-status still matches its current status is skipped entirely. When the event transitions (e.g., `active` → `success`/`fail`), the catch-up effect detects the status mismatch and fires the corresponding `event_won` / `event_lost` toast automatically, so users don't silently miss terminal outcomes.
- **Fixed `event.id` → `event.event_id` in `eventToast` and `LiveToasts`** — the toast dedupe key was producing `event-undefined` for every toast (since the real field is `event_id`, not `id`), which meant Sonner collapsed all toasts to a single reusable slot. The `dismissedEvents` Set was similarly writing the literal string `"undefined"` and never actually suppressing anything on reload. Dismissal tracking now works.
- **Toasts now have a close button (desktop).** Enabled Sonner's built-in `closeButton` prop on `<Toaster>` — small X control for explicit dismissal. Works across mobile too (touch-swipe gestures still work).
- **Admin debug toast tester updated** — `randomEvent` now generates high-range random numeric `event_id` values (900M+ range) to avoid collisions with real HD1 event ids (1-100k range), and includes `status` derived from the toast kind. Previously the test events had no `event_id` and no `status`, which meant Sonner deduped them all to one visible toast and new dismissal logic couldn't classify them.

### Migration

- `dismissedEvents` localStorage record changed from `Array<string>` to `Record<string, status>`. Legacy array entries are migrated in-place on first read — each id is assumed to have been dismissed while `active`, which is the only status a user could plausibly have dismissed prior to this change.

## 0.37.4

### Bug Fixes

- **Event log cards now show descriptive action verbs tied to the region** instead of generic `"Won defend Event"` / `"Failed attack Event"` status descriptors. New shared helper `getEventActionLabel` maps `(type, status)` → verb: `Attacking`/`Captured`/`Lost` for attack events, `Defending`/`Defended`/`Lost` for defend events. Applied to both live dashboard event log (`Event.jsx`) and archives event rail (`ArchiveEvent.jsx`). Dashboard card now reads e.g. `"DEFENDING SUPER EARTH"`; archive card reads e.g. `"CAPTURED"` with region on a separate line.

## 0.37.3

### Chores

- **`Dockerfile.migrate` slimmed from ~4.7 GB to ~670 MB (86% reduction).** Two changes: (1) read project versions from a temp-path copy of `package.json` and run `npm install` against a minimal one in `/app` so npm only installs the 4 declared packages instead of inheriting the full Next.js dependency tree (1.2 GB → 306 MB `node_modules`); (2) drop the standalone `RUN chown -R node:node /app` step that was creating a full duplicate of `/app` in a second image layer — the `node` user reads root-owned files fine since migrate + seed are read-only against `/app`. Also clean npm cache + `/tmp` in the same `RUN` layer.

## 0.37.2

### Bug Fixes

- **`DefeatedCard` label now uses underscores** — `ALL SECTORS CAPTURED` → `ALL_SECTORS_CAPTURED` to match the convention used by all other bar labels (`SECTOR_PROGRESS`, `CAPITAL_DEFENSE`, `HOMEWORLD_ASSAULT`, `SUPER_EARTH_DEFENSE`).

## 0.37.1

### Bug Fixes

- **Super Earth defend events now display correctly across map, cards, and notifications.** During an active SE defense (`defend_event.region === 0`), toasts/push/archives no longer show "Unknown Region under attack" — they now resolve to "Super Earth" via a new shared `getEventRegionLabel` helper (fixes 4 copy-pasted broken lookups against `map[event.enemy][event.region]` for SE events where Super Earth actually lives at `map[3][0]`).
- **Dashboard now shows a "Defending Super Earth" card in place of the attacker's frontier card** while an SE defense is active (closes #279). Mirrors the existing sector-defend takeover pattern.
- **Galaxy map hides the attacking faction's campaign progression during an SE defense.** `computeMapState` force-resets all sectors (1-11) of the attacker to `lost` state since in-game, no progression can occur for that faction while Super Earth is being defended. Super Earth itself continues to pulse red.

## 0.37.0

### Features

- **Archives stats audit** — removed 8 redundant/confusing stats (DEFENSE_WON, ATTACK_WON, TOTAL_OVERKILL, LONGEST/SHORTEST_EVENT, PEAK_SURGE, raw MISSIONS, MOST_CONTESTED), renamed 6 to player-friendly labels (WIN_RATE, DURATION, K/D, TOTAL_DIVERS, BATTLES, HOTSPOT), added section headings (War Summary, Notable Moments, Combat Record).
- **Closest calls & cascade detection** — new `seasonAnalytics.mjs` utility with `findClosestCalls()` (narrowest win/loss events) and `findWorstCascade()` (longest cascade of consecutive failed defenses). Displayed as Notable Moments stat cards.
- **Cyberstan interference easter egg** — on defeat seasons, the archives header shows resistance text ("Leaked Campaign Records") with a 5-phase glitch cycle: idle → takeover (word-by-word scramble to propaganda) → hold → fight (chaotic noise) → restore. Two independent per-character effect layers: copy swap (propaganda leak-through) and Cyberstan font scramble.
- **7 randomized resistance messages** — server-side random selection per request across 3 tonal directions (sardonic, hacker-broadcast, fourth-wall). No hydration mismatch.
- **GlitchText component** — persistent looping text scramble with synced phase clock (`useGlitchCycle`), word-by-word settling in batches of 1-3, `prefers-reduced-motion` support, client-only rendering via `next/dynamic`.
- **Effects toggle** — localStorage-persisted disable switch for interference effects.
- **StatCard subtitle** — optional subtitle prop with clickable card support for linking Notable Moments to the event timeline.
- **Scroll-driven event selection** — `useScrollEvent` hook with IntersectionObserver for archives timeline-to-map sync.
- **Legal page** — in-lore terms of service, privacy policy, and cookies sections.

### Improvements

- Error pages use brandkit button styling and Big Brother copy ("This incident has been logged" + "Resume approved Super Earth broadcast").
- Background watermark ("THE RECORD IS FALSE") on defeat seasons with fade-in transition.
- Cyberstan font (Collective Consciousness) registered as `--font-cyberstan` theme token with `0.6em` sizing and `1ch` width containment to prevent reflow.
- Archives header body text capped at `max-w-screen-md` for readability.

### Bug Fixes

- Fixed GlitchText SSR hydration mismatch by deferring random state to `useEffect` and using `next/dynamic` with `ssr: false`.
- Fixed mismatched text/altText lengths causing truncated propaganda text during glitch takeover.
- Fixed `useCyberstanEffects` hydration mismatch by moving `Math.random()` dice rolls from `useState` initializer to `useEffect`.

### Chores

- Deleted `OutcomeReveal.jsx` (236 lines) — replaced by unified GlitchText component.
- Removed dead `statFlickers` code from hook and CSS.
- Extracted resistance messages to `resistanceMessages.mjs` shared constants.

## 0.36.0

### Features

- **Phase A season analytics** — 10+ stat cards per season: outcome, duration, events won, defense/attack rates, overkill, longest/shortest events, most contested region, peak mobilization. Works for ALL seasons (derived from events + snapshots, not h1_live).
- **Per-faction analytics with FactionTabs** — Bugs/Cyborgs/Illuminate tab switcher on archives. Per-faction stats: defense rate, attack rate, event count, average duration, peak surge, most attacked region, overkill, conquest progress.
- **Unified ArchiveStats** — merged SeasonStats + CombatStats + EventStats into one component. Shows h1_live combat stats (kills, accuracy, FF) when available, event-derived stats always.
- **Shared EventCardLayout** — extracted card shell for dashboard/archive event card reuse.

### Improvements

- Archives sidebar restructured with H1 blurb ("Declassified Campaign Archives"), H2 section headings (Statistics, Faction Analysis, Event Log), season selector inline with Statistics heading.
- VICTORY/DEFEAT rendered as StatCard with colored text (green/red) instead of custom banner.
- Sticky map uses full viewport height, clips naturally from top at bottom of page.

### Bug Fixes

- Archive map: gap-event replay for accurate historical map reconstruction (fixes stale snapshot issues).
- Archive map: clamp sector points to defend frontier (fixes sectors beyond defend region showing as captured).
- Sticky map no longer overlaps footer.
- React hooks violation fixed in ArchiveEventRail.
- Composite event key (type+event_id) for correct event selection.

### Chores

- Codebase cleanup: deleted 7 dead files, extracted shared utilities (FACTION_COLORS, formatCompactDuration, eventKey), fixed convention violations (Umami env var, design tokens, try/catch).
- Moved SeasonSelector to archives feature directory.
- Dependencies updated (Prisma 7.7, better-auth 1.6, vitest 4.1.3, etc).

## 0.35.0

### Features

- **Archives page redesign** — two-column layout (narrative sidebar + sticky galaxy map) mirroring the dashboard pattern. New components: SeasonOverview (outcome banner), SeasonStats (aggregated stats grid), FactionSummary (per-faction win/loss), ArchiveEventRail (clickable event log controlling the map), ArchiveMap (map-state-at-event computation).
- **Shared EventCardLayout** — extracted card shell (accent bar + status styling) used by both dashboard LiveEvent and archive ArchiveEvent. Archive events show region name, final duration, and outcome.
- **Archive map gap-event replay** — reconstruct map state by replaying events that completed between the nearest snapshot and the selected event. Handles stale snapshots (8-24h gaps), failed defend cascades, and region 0 Super Earth defends.
- **Event selection URL sync** — selected event persisted as `?event=<type>-<event_id>` composite key for shareable deep-links. Back button navigates between selections.
- **Archive event hover states** — clickable event cards get cursor-pointer + brightness lift on hover.

### Bug Fixes

- **Archive map double-counting** — fixed completed events being passed to computeMapState, causing failed defend cascades to wipe sectors already reflected in snapshot points.
- **React hooks violation** — moved useRef/useEffect above early return in ArchiveEventRail.
- **Event ID field** — corrected event.id → event.event_id with composite key (type+event_id) since event_id is not unique across attack/defend.

## 0.34.0

### Features

- **SEO & JSON-LD structured data** — add shared `JsonLd` component with CSP nonce support. Add `WebApplication` + `BreadcrumbList` schemas to homepage, `WebPage` + `BreadcrumbList` to docs layout. Refactor archives page to use shared component. Fix Event schema validation: add `location` (VirtualLocation), `eventAttendanceMode`, `eventStatus`, and `performer` fields. Flesh out attack event schemas with full structured data. Add `operatingSystem` to archives WebApplication.

### Chores

- Update author URL from `lavrenov.io` to `lav.ren` across all schemas, footer, and README.

## 0.33.0

### Features

- **Region-centric toasts** — replace plain-text toast labels with JSX content showing faction icons, region names as titles, and event type as subtitle. Switch animation from `toast-glow` box-shadow pulse to `action-flash` opacity flash for transition toasts; catch-up toasts are now static. Push notification payloads updated to match.

## 0.32.0

### Features

- **Defeated faction cards** — show defeated factions in the Regions section with a muted gold "DEFEATED" label, faction name, full progress bar, and campaign duration instead of hiding them.

## 0.31.1

### Features

- **Pace status shorthand** — move pace indicator (ahead/behind/on track) to the event type label row (e.g. `CAPITAL_DEFENSE · 1.2K ahead`), right-aligned via `space-between`. Shorten format from verbose "Ahead by 1234 points" to compact "1.2K ahead". Add live countdown timer to EventCountdown.

## 0.31.0

### Features

- **Region card redesign** — merge action label and region name into a single title line (`Capturing Wise Region`, `Defending Sirius Region`). Flashing red action word during events replaces the `⚠` alert icon. Defend events now show event defense progress instead of frontier progress. Always-visible meta line with points, countdown, and pace for consistent card height. Bar labels use stat-style snake case (`SECTOR_PROGRESS`, `CAPITAL_DEFENSE`, `HOMEWORLD_ASSAULT`).
- **Card accent width token** — extract `--card-accent-width: 6px` to `layout.css` theme. All card types (EventCard, StatGrid, timeline Event) now share a single accent bar width.

## 0.30.0

### Features

- **Timeline duration blocks** — replace rail dots with proportional duration blocks that visualize event length. Cards show compact duration pills (`2d3h`, `14h22m`). Active events pulse with danger color scheme. Empty days fill gaps between event groups for proportional timeline spacing.

## 0.29.2

### Fixes

- **Docs overview Mermaid diagram** — replace raw `mermaid` code block on `/docs` with the shared `MermaidDiagram` component so it actually renders as an interactive diagram with consistent styling, detail panels, and accessibility
- **Notification flow `db` node** — add missing details entry for the Database node in the notification-flow diagram so it's clickable like all other nodes

## 0.29.1

### Fixes

- **Defer poll emissions to `requestIdleCallback`** — prevents `enqueueModel` crashes caused by `setState` firing during RSC Flight stream processing on navigation. Coalesces rapid-fire emissions to skip intermediate status flickers.

## 0.29.0 (retroactive)

### Features

- **Progressive env vars** — only `POSTGRES_URL`, `UPDATE_KEY`, and `UPDATE_INTERVAL` are required at startup; auth (BetterAuth + OAuth) and analytics (Umami, Sentry/GlitchTip) degrade gracefully when absent. Partial auth config (secret present but provider vars missing) still throws. `withSentryConfig` skipped without `SENTRY_AUTH_TOKEN`. Umami script conditional on `UMAMI_SITE_ID`.
- **Admin notification debug buttons** — "Test Push" sends a test push notification to all subscribers via `web-push`; "Test Toast" fires a faction-colored Sonner toast. Standalone Debug section in admin area.
- **Mermaid diagram system** — replace hand-crafted SVG diagram components (~1650 LOC) with reusable `MermaidDiagram` component powered by Mermaid syntax. Diagrams are now config-driven (definition string + config object). Same color conventions as docs. Preserves flow filtering, clickable detail panels, and keyboard accessibility.
- Migrate wiki documentation to in-app `/docs` pages
- Merge admin dashboard into profile page — delete standalone admin route and ProfileNav (#259)

### Fixes

- Hide UserSection nav when offline — auth requires network
- Simplify account deletion — remove email confirmation, use confirm dialog
- Fix Mermaid diagram filtering, arrow styling, and responsive layout

### Chores

- Comprehensive docs update — add Mermaid diagrams, fix wiki refs, correct outdated content

## 0.28.0 (retroactive)

### Features

- **Umami analytics expansion** — comprehensive Level 2 feature engagement tracking with ad-blocker bypass via same-origin proxy (`/api/umami`), `useTrack` hook for dynamic interactions, `umami.identify()` for authenticated users, and `category-action` event naming convention across ~40 tracked elements
- **Serwist service worker** — migrate from hand-written `public/sw.js` to Serwist (`@serwist/next`) for automatic precache manifest with content hashes. No more manual `CACHE_NAME` version bumps. `skipWaiting` for immediate updates. Configurator mode for Turbopack compatibility

### Refactors

- Delete ServiceWorkerRegister.jsx — Serwist handles registration automatically via `register: true`

## 0.27.0 (retroactive)

### Features

- **Global live data** — `LiveDataContext` wraps all pages so every route receives real-time campaign updates via polling
- **Replace SSE with polling** — remove entire SSE infrastructure (sseManager, pg LISTEN/NOTIFY, `/api/h1/stream`). New `GET /api/h1/live` endpoint polled every 10s via `setInterval` + `fetch`. Eliminates RSC Flight stream conflicts (`enqueueModel` crashes)
- **Tri-state status indicator** — StatusDot shows green (live), orange (polling), red (offline). Uses `navigator.onLine` to detect PWA offline state
- **Push notification improvements** — add `badge` (favicon PNG), per-event `tag` grouping, and `renotify` for status changes; fix icon fallback from SVG to raster; precache badge in service worker shell assets
- **GlitchTip error tracking** — migrate from BugSink to GlitchTip with client tunnel (`/api/glitchtip`) to bypass ad blockers, CSP violation reporting via `report-uri`, and `environment` tagging to split dev/prod issues
- **Error boundaries** — route-level (`error.jsx` at root + archives) and component-level (`ComponentErrorBoundary` wrapping Galaxy Map, Regions, Stats, Timeline) for graceful degradation
- **App version in footer** — shows package version, short commit SHA, and commit message in footer and dev console (auto-generated at build time by `next.config.mjs`)

### Fixes

- **Fix Sonner toast module duplication** — co-locate `<Toaster>` inside `LiveToasts` instead of root layout to share the same Sonner `ToastState` singleton across client components
- **Fix hydration mismatch in EventCard** — add `suppressHydrationWarning` to pace label (computed via `Date.now()`, differs between SSR and client)
- **Fix React Compiler swallowing catch-up effect** — add `'use no memo'` to `LiveToasts` to prevent the compiler from merging the two `useEffect` hooks
- **Fix hydration mismatch in StatusDot** — defer `navigator.onLine` check to `connect()` (client-side only) to prevent SSR/client status divergence

### Refactors

- **Sentry SDK with native navigation** — re-add Sentry SDK while keeping native `next/link` navigation (replaces Sentry's custom Link wrapper)
- **Design token cleanup** — add `--color-warning` (`#f97316`) and `--color-success` tokens; remove `--color-outline` and `--color-outline-variant` (replaced by `ghost` and `text-muted`); all raw Tailwind green/red/yellow colors replaced with theme tokens

### Chores

- Enable production source maps and upload to GlitchTip

## 0.26.0 (retroactive)

### Features

- **Profile page** — view connected providers, manage API keys, GDPR data export and account deletion (#248)
- **Admin dashboard** — system overview, debug tools, user management (with provider/key columns), and all-keys table. Role-gated on `/profile` — no separate admin route. Each section loads independently via Suspense (#248)
- **Worker heartbeat monitoring** — cron worker writes heartbeat on each poll; `worker_heartbeat` table, `computeWorkerHealth` utility, health dot in admin dashboard
- **Sign-in polish** — provider branding (Discord/GitHub logos and colors), navigation link to sign-in page
- **Catch-up toasts for active events** — show an "in progress" toast on page load when defend/attack events are already active (#LiveToasts)

### Fixes

- **Fix profile page polish** — border separators, wider inputs, side-by-side layout, correct `.gutters` usage
- **Fix RSC cache invalidation** — use `revalidatePath` without `'page'` scope to avoid RSC cache corruption
- **Fix Zod ID validation** — replace `z.uuid()` with `z.string().min(1)` for Prisma CUID2 IDs
- **Fix session revocation** — revoke session on ban and account deletion, redirect after delete
- **Validate `BETTER_AUTH_URL` at startup** — remove unused email env vars

### Refactors

- **Brandkit overhaul** — grouped palette (Website/Status/Factions), nested surface demo, right accent line on rule card, equal-height swatches
- **Design system: fluid type scale** — add fluid type scale tokens to `@theme` with `--fs-small` floor
- **Design system: button restyle** — remove `--color-on-primary` token, restyle buttons to outline-first
- **Design system: font token rename** — rename `--fs-*` to `--text-*` and align all font sizes to 5-step scale
- **Profile redesign** — merge ProfileInfo into Your Data section, redesign pages to match site-wide visual style
- **Dashboard redirect** — redirect old dashboard routes to profile

### Chores

- Update Umami analytics URL to `umami.drunik.be`
- Apply Prettier formatting to source and test files
- npm update (dependency refresh)

## 0.25.1 (retroactive)

### Features

- **Custom API docs** — replace SwaggerUI with lightweight server-rendered API documentation page
- **Zod validation for season seeding** — validate API responses with Zod schemas before database writes (#191)
- **SEO polish** — improved sitemap, JSON-LD `mainEntity`, and breadcrumbs (#123)
- Native app-like mobile header with solid background

### Fixes

- **Fix grid overflow** — replace bare `1fr` with `minmax(0, 1fr)` in grid layouts (#193)
- **Fix healthcheck timing** — add `roundedPerformanceTime` to healthcheck route (#197)
- Fix PWA manifest — move `site.webmanifest` to `public/`, update `short_name` to HD1 Bot

### Refactors

- **`tryCatch()` wrapper adoption** — convert raw try/catch blocks to `tryCatch()` in fetch utilities (#194)

### Chores

- Add logo originals and normalize formatting in compose and client
- Remove unused assets and fix footer links

## 0.25.0 (2026-04-04)

### Phase 10: Auth Migration

#### Features

- **Migrate from NextAuth v5 to BetterAuth** — replace pre-release `next-auth@5.0.0-beta.30` with stable `better-auth` (#198)
- **New `/sign-in` page** — dedicated sign-in page with Discord and GitHub OAuth buttons
- **Client-side auth** — new `src/auth-client.js` with `signIn`, `signOut`, `useSession` exports via `better-auth/react`

#### Breaking Changes

- Auth tables dropped and recreated — all existing users, sessions, and API keys are lost
- `AUTH_SECRET` env var renamed to `BETTER_AUTH_SECRET`
- `AUTH_TRUST_HOST` env var removed
- New `BETTER_AUTH_URL` env var required

#### Architecture

- Server auth config (`src/auth.js`) uses `betterAuth()` with Prisma adapter and social providers
- Session retrieval: `auth()` → `auth.api.getSession({ headers: await headers() })`
- Sign-in/sign-out converted from server actions to client component using `better-auth/react`
- Route handler moved from `[...nextauth]` to `[...all]` with `toNextJsHandler`
- Prisma schema: Account uses `accessTokenExpiresAt`/`refreshTokenExpiresAt`, Session uses `token`/`expiresAt`, new Verification model

#### Chores

- Update CI workflow env vars (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`)
- Update env validation in `initialize.env.mjs`
- Update all test mocks for BetterAuth session pattern

## 0.24.1 (2026-04-04)

### Fixes

- Decouple Postgres SSL from `NODE_ENV` — new `POSTGRES_SSL` env var controls SSL independently of build mode
- Add `platform: linux/amd64` to `docker-compose.yml` for ARM Mac compatibility
- Fix README Docker build tags (`:local` → `:staging`)
- Move `themeColor` from `metadata` to `viewport` export (Next.js 16 requirement)

### Chores

- Remove unused `SKIP_MIGRATIONS` env var (never read by application)
- Remove Prettier formatting check from CI
- Normalize `docker-compose.yml` indentation, update host port

## 0.24.0 (2026-04-04)

### Phase 8: Real-Time Updates

#### Features

- **SSE live data streaming** — dashboard updates automatically every 10-15 seconds without page reload (#41)
- **Sonner toast notifications** — persistent, faction-colored toasts with glow animation on campaign start/win/lose (#229)
- **Web Notifications** — native browser notifications when tab is backgrounded (BroadcastChannel leader election prevents duplicates)
- **Push notifications** — server-initiated notifications via Web Push API when browser is closed (#24)
- **PWA offline support** — service worker caches app shell, localStorage preserves last-known dashboard data for offline viewing
- **Connection status indicator** — live/reconnecting/offline pill replaces "Updated X ago" when connected

#### Architecture

- Server-Sent Events (SSE) transport via Next.js Route Handler (`/api/h1/stream`)
- Postgres LISTEN/NOTIFY for cross-process change broadcasting between worker and SSE manager
- SSE manager singleton with connection limits (5/IP, 500 total), heartbeat, exponential backoff reconnection, and graceful shutdown
- Client-side change detection (`detectChanges`) shared between toast and push notification paths
- Push subscription API with Zod validation and stale subscription cleanup (410/404)
- Server-side push notifier with concurrency-limited fan-out (max 50 concurrent)

#### UI Changes

- Remove `Alerts` banner component — persistent event status now shown in enhanced `EventCard` (progress bar, pace, countdown timer)
- Single "Enable notifications" button enables both web notifications and push subscription
- Shows "Notifications blocked" / "Notifications unavailable" when denied or unsupported
- Toasts use right-side accent line matching brandkit convention

#### Documentation

- Add `/docs/notifications` page with interactive flow diagram (clickable nodes, flow filtering)
- Add notification category styles to shared diagram CSS

#### Dependencies

- Add `sonner` (~5KB gzipped) for toast notifications
- Add `web-push` (~15KB, server only) for push notification delivery

#### Database

- Add `push_subscription` table (endpoint, keys, created_at)

#### Environment Variables (New)

- `VAPID_PUBLIC_KEY` — Web Push VAPID public key
- `VAPID_PRIVATE_KEY` — Web Push VAPID private key
- `VAPID_SUBJECT` — VAPID subject (mailto: email)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — client-side VAPID public key

## 0.23.0 (2026-04-04)

### Security

- Replace `unsafe-inline` CSP with nonce-based policy via custom server proxy (`proxy.js`) (#226)
- Remove `unsafe-eval` from CSP in production; keep for dev only (#226)

### Infrastructure

- Run migration container as non-root user (#227)
- Standardize Docker user to built-in `node` user (#228)
- Rename Docker workflow display names for clarity
- Consolidate duplicated code and extract shared utilities
- Standardize quoting in CI workflows and reformat openapi.json

### Frontend

- Consolidate /about, /faq, /architecture, /brandkit, /discord into unified /docs section
- Add MDX authoring support via @next/mdx with remark-gfm
- Add docs layout with sidebar navigation (desktop persistent, mobile dropdown)
- Migrate ProgressExplainer from architecture to FAQ page
- Move API documentation (OpenAPI/Swagger) to /docs/api
- Remove standalone /discord page (absorbed into /docs/about)
- Update HeaderNav, BottomNav, Footer, and sitemap to reference /docs routes

## 0.22.3 (2026-04-04)

### CI & Infrastructure

- Upgrade from Node 22 to Node 24 (ships npm 11 natively)
- Remove npm@11 pin from CI and Dockerfiles — no longer needed
- Pin GitHub Actions to commit SHAs and upgrade to latest versions
- Add CI, CodeQL, and dependency review workflows with branch protections
- Remove SonarCloud from CI — replaced by local vitest coverage
- Add Prisma generate step to CI before build
- Fix duplicate CodeQL trigger on pull_request
- Fix pagespeed workflow: push to orphan metrics branch, fix syntax errors
- Remove commented-out metrics steps referencing METRICS_TOKEN
- Add .prettierignore for auto-generated openapi.json

### Tests

- Raise unit test coverage from 66% to 85% (619 tests across 69 files)
- Add 9 new test files: Footer, Auth, Header, DocsClient, Navigation, Wings, formdata, initializeOpenapi, rebroadcast route
- Extend utils and umami tests with edge cases and error paths
- Fix vitest coverage exclusions (.js→.mjs glob mismatch)
- Suppress console noise in test output via global mocks
- Align smoke tests with new error schema, use TEST_SERVER_URL

### Code Quality

- Extract shared helpers to reduce duplication
- Remove debug console.log from initialize.worker.mjs
- Simplify Event card and improve timeline date handling
- Run Prettier

### Docs

- Explain why Production always builds migrate image (#217)
- Clarify Prettier pre-commit command and CI check; fix README indent

## 0.22.2 (2026-04-03)

- Include Docker pull commands in GitHub Release notes

## 0.22.1 (2026-04-03)

### Release Workflow Fix

- Switch Production Docker auth from expired PAT to `GITHUB_TOKEN`
- Remove release-please (conflicted with manual tagging)
- Add GitHub Release job with changelog extraction to Production workflow
- Fix changelog extraction: use state-machine awk, add empty-body validation

## 0.22.0 (2026-04-02)

### Phase 9: Dashboard & Timeline Polish

#### Features

- Proportional timeline rail: replace block segments with proportional dots, ghost day circles, and gap-aware separators
- Merge rail into single container with overlapping dots and tick marks
- Sticky galaxy map on desktop when sidebar overflows
- Sticky scroll hint with animated arrow on desktop hero layout
- Right-align timeline day header accent on mobile
- Show active faction label in Stats heading
- Rebrand footer to "Ministry of Truth" with full-width accent line
- Add ghost-border color to Tailwind theme
- Add ProgressExplainer component with heartbeat animation and recharts dependency
- Color-code evaluateProgress pace text by status (green/white/red)
- Event card hover highlights corresponding timeline rail dot (glow + scale)

#### Bug Fixes

- Top-align galaxy map by spanning it across alerts row
- Increase top-padding on timeline day headers for clearer separation
- Left-align timeline day header text on mobile
- Inline pace text with due-time on active event cards
- Rename `--color-ghost-border` to `--color-ghost` for Tailwind v4 compatibility
- Stretch EventCard to fill grid row height
- Remove left accent and right ghost-border from event cards
- Scope background overlay to main element only
- Migrate Event component to Tailwind with status-based accent colors
- Move pace indicator inline with event label in EventCard
- Map attack animation turns black — add glow and alert indicators
- Fix timeline rail dot ordering — invert vertical axis so top = most recent

#### Refactors

- Remove redundant galaxy map hover tooltip component

#### Chores

- Delete AI working docs (plans, specs, debates) — tracked in docs instead
- Consolidate CSS files and reintroduce responsive header scroll-hide
- Replace gutters wrapper with fragment on home page

## 0.21.0 (2026-04-02)

### Infrastructure & Code Quality

#### Security

- Add HSTS header to close Checkmarx security finding
- Update CSP to allow external analytics and error tracking scripts

#### Infrastructure

- Replace Playwright with Vitest smoke tests, update docker-compose for local dev (#202)
- Consolidate package.json scripts — remove 4 redundant commands (#201)
- Automate production releases with tag-triggered GitHub Releases
- Self-heal missing migrate image in staging CI

#### Code Quality (desloppify)

- Fix server action directives — remove from pipeline, standardize in queries
- Refactor rebroadcast queries and route validation order
- Standardize query return shapes across `db/queries/`
- Standardize auth/error handling in `api.mjs`
- Fix contract lies in utils — explicit returns, docstrings, error logging
- Restore module-level `'use server'` on `api.mjs` — required for client imports

#### Chores

- Disable link prefetching, reorganize README security section

## 0.20.0 (2026-03-31)

### Phase 8: Timeline Visual Redesign

#### Features

- Add TimelineSection with vertical rail and date grouping below dashboard
- Add WarSummary component with win/loss counts (replaces timeline in sidebar)
- Add compact variant to Event card for resolved events
- Add `groupEventsByDay` utility with date labeling
- Add snap scroll container with TimelineSection below dashboard
- Refine timeline layout — unified scroll, smart map fit, season events in StatGrid
- Redesign timeline rail — per-segment mobile, circle+line desktop (#186)

#### Bug Fixes

- Match sidebar-map column gap to page gutters (6rem / 96px)
- Timeline rail polish — alignment, breakpoints, grid scaling

## 0.19.0 (2026-03-30)

### Phase 7b: Responsive Polish & SEO

#### Features

- Rename `/war` to `/archives` with in-universe SEO copy
- Add permanent redirect `/war` → `/archives`
- Add canonical URLs and `og:url` to all pages
- Add in-universe Super Earth propaganda copy to error and placeholder pages
- Show FactionTabs icon + text together at sm:+
- Show FactionTabs icons in sidebar at lg: (#167)
- Desktop & wide responsive layout (#168)

#### Bug Fixes

- Small phone responsive — faction icons, grid overflow, viewport warning
- Map invisible on `/war` at md:, move nav switch to md: breakpoint
- CSS audit — delete global button styles, unify overlays, fix tokens
- Show header Status/GitHub icons above 250px instead of sm:
- Hide BottomNav at lg: via unlayered CSS media query
- Add horizontal and vertical padding to desktop dashboard grid
- Restore sr-only h1 lost during sidebar restructure (#167)

#### Security

- Fix timing attack vulnerability in password comparison

#### Refactoring

- Simplify responsive overrides after review
- Extract map callbacks to named functions

## 0.18.0 (2026-03-30)

### Phase 7a: Tablet Responsive & Accessibility

#### Features

- Dashboard sidebar layout at lg: breakpoint (#167)
- Add header page navigation links at lg: (#167)
- Galaxy map max-width at md:, reset at lg: (#167)
- StatGrid 4 columns at md: (#167)
- Alerts horizontal scroll at md: (#167)
- Hide BottomNav at lg: breakpoint (#167)
- Add md: gutter breakpoint and lg:pb-0 on main (#167)
- Restore SEO content on homepage, expand sitemap, fix noindex gaps (#123)

#### Bug Fixes

- Page-level WCAG accessibility fixes (#152)
- Semantic HTML improvements for screen readers (#150)
- Form accessibility — error linking, table headers, avatar alt (#151)
- Add missing h1 headings across all pages (#149)

#### Chores

- Delete redirect stubs for `/api` and `/docs` pages
- Delete unused Button component (#169)
- Clean up api-reference documentation

## 0.17.0 (2026-03-29)

### Phase 6b: Mobile Polish & Documentation

#### Features

- Add interactive data-flow architecture page
- Refactor `evaluateProgress()` to structured return, fix div-by-zero, surface pace in UI
- Mobile carousel for WarTimeline — swipeable cards replace range slider
- Apply brandkit design tokens to all pages
- Restyle BottomNav — horizontal layout, spacing, font sizes
- Migrate OG image from static PNG + API route to file convention

#### Bug Fixes

- Add CSP headers to `next.config.mjs` to unblock sign-in page
- Remove awkward "On track by 0 points" label

#### Refactoring

- Centralize event/status constants and remove prototype code

#### Chores

- Update doc references, fix Mermaid FK-UK syntax
- Move loadout builder spec + plan to GitHub issue #162
- Add grouping and schedule alignment to dependabot config

## 0.16.0 (2026-03-28)

### Infrastructure

- Chain seed script after `prisma migrate deploy` in `Dockerfile.migrate` — historical season data is now automatically seeded on deployment

### Features

- On-demand season fetching: `/war` page derives season selector from current season number instead of querying DB. Missing seasons are fetched from the official Helldivers API and stored on first request via `fetchAndSeedSeason()`
- Deleted `getSeasonList.mjs` query — no longer needed

### Bug Fixes

- Fix map sector calculation: only pass active events to `computeMapState()` on live homepage and OG image. Completed defend events were overwriting campaign score-based sector ownership, causing fewer sectors to appear captured than the score warranted
- Affects: `src/app/page.jsx`, `src/app/api/og/route.js`

### Debugging Technique

- Used Chrome DevTools MCP to parse live DOM sector classes and extract RSC payload data, comparing `points` vs `points_taken` field values across all three factions to identify the root cause

## 0.15.0 (2026-03-28)

### Phase 5: Design System

- Create design token system (`src/styles/tokens.css`) with colors, surfaces, fonts, spacing
- Integrate tokens into Tailwind v4 `@theme` block with 0px radius overrides
- Load Space Grotesk and Inter via `next/font/google`
- Create `/brandkit` visual reference page (palette, typography, spacing, components)
- Fix faction colors to match game icons: Bugs=orange, Cyborgs=dark red, Illuminate=cyan
- Standardize card component: right-side accent line, grid-based layout

### Phase 6: Mobile-First Dashboard

- Add BottomNav component (fixed bottom tab bar: Live/History/About)
- Add FactionTabs segmented control (Global/Bugs/Cyborgs/Illuminate)
- Add StatGrid 2×2 data card grid with faction filtering
- Rewrite Event cards with right-side accent, status-based background tinting
- Rewrite Alerts as full-width stacked banners (replacing carousel)
- Complete homepage rewrite with DashboardClient mobile-first layout
- Update war history page for mobile-first single column
- Slim header on mobile (hide nav links, BottomNav handles primary nav)
- Migrate `.card` class from Tailwind hardcoded to design tokens
- Update war outcome badge to use design tokens

## 0.14.0 (2026-03-27)

### Security

- Migrate update endpoint auth from query param to Bearer token header
- Upgrade API key hashing from MD5 to SHA-256
- Normalize auth patterns across all protected endpoints

### Code Quality (desloppify)

- Add 210 unit tests across 16 files (validators, queries, utilities)
- Migrate `api.mjs` and `post.mjs` to `tryCatch` pattern, fix `db.post` → `db.review`
- Rename all enum and validator files from `.js` to `.mjs` for consistency
- Standardize rebroadcast query structure, remove dead code
- Deduplicate logic, simplify utilities, remove unused exports
- Add `evaluateProgress` utility for live event progress tracking
- Add `'use server'` directives where missing

### Performance

- Fix React rendering waterfalls, reduce bundle size, improve caching (#146)

### Features

- Timeline deep-linking with URL hash navigation
- Lost sector visibility improvements on war page
- Season URL redirect (bare `/war` → current season)

### Chores

- Move OG image spec/plan to completed
- Remove deprecated `TODO.md`
- Run prettier formatting pass

## 0.13.0 (2026-03-26)

- Dynamic OG image generation showing galaxy map with live war progress
- Extract SVG path geometry into shared `src/enums/mapPaths.mjs`
- Extract `getWarOutcome` into shared utility with unit tests
- Refactor `Map.jsx` to consume shared path data
- Add OG route smoke test

## 0.12.0 (2026-03-26)

- Add Vitest testing infrastructure with node environment, v8 coverage, and `@`/`@test-utils` path aliases
- Add global mocks for NextAuth v5 `auth()`, Prisma client (all models), and Next.js modules
- Add test utilities: `createMockRequest`, `createMockSession`, `createMockModel`
- Migrate Playwright smoke tests from `tests/` to `src/__tests__/e2e/` (aegis conventions)
- Configure Playwright screenshot-on-failure and trace-on-first-retry
- Add `docs/06-testing.md` — testing conventions, mock factories, API route testing patterns
- Add starter unit tests for `tryCatch` utility (100% coverage)
- Fix war outcome detection: data-derived algorithm replaces lookup table, verified against 137 wiki seasons (0 mismatches)

## 0.11.0 (2026-03-26)

- Phase 3: Gate `/api/h1/rebroadcast` behind API key validation (Bearer token + MD5 hash lookup)
- Phase 4: War Outcome & Interactive Timeline on `/war?season=N`
    - Victory/Defeat banner derived from snapshot + event data
    - Interactive timeline scrubber (`<input type="range">`) with event markers
    - Extract `computeMapState` pure utility from Galaxy (no more shared mutable state)
    - Refactor Galaxy to accept `mapState` prop
    - Re-enable attack event visualization on the map
    - Native `<select>` season dropdown replaces 155-button grid
    - Exclude active season from history (homepage shows live war)
    - Sort snapshots by time ascending in campaign query
- Merge `/about`, `/docs`, `/api` pages into single `/about` page with Swagger UI
- Add blinking red "Live" nav item linking to homepage
- Restructure navigation: site links | external links (heartbeat + GitHub) | user section
- Dashboard link moved into user avatar (clickable) section
- Fix homepage Galaxy map visibility on desktop (fixed-position width regression)
- Sync OpenAPI spec with actual response format (`time`/`code`/`message` fields)
- Fix rebroadcast `after()` closure bug and analytics URL copy-paste error
- Fix documentation inaccuracies across all 5 doc files

## 0.10.0 (2026-03-26)

- Restructure homepage as live war dashboard (galaxy map, faction stats, event timeline)
- Repurpose `/war` as historical season browser with season selector
- Create `/about` page for relocated marketing content (about, discord, API)
- Update navigation: rename "War" to "History", add "About" link
- Add `getSeasonList` query for season selector
- Update sitemap with `/war` and `/about` entries
- Update layout metadata to reflect dashboard purpose
- Upgrade to Next.js 16 with Turbopack default bundler
- Upgrade to Prisma 7.5 with `@prisma/adapter-pg` driver adapter
- Phase 1 backend: restructure Prisma schema — unify events into `h1_event`, add `h1_live`, drop redundant tables (`h1_campaign`, `h1_defend_event`, `h1_attack_event`, `h1_statistic`)
- Phase 2 backend: add `h1_live_snapshot` and `h1_event_snapshot` tables for time-series data
- Add in-memory snapshot throttle system (15-min stats, 10-min events)
- Wire snapshot capture into the polling pipeline
- Add seed files for all 156 past seasons
- Add database migration for Phase 1 schema rewrite
- Implement fluid typography with CSS `clamp()` for responsive text scaling
- Add ESM `"type": "module"` to `package.json`
- Add Vitest smoke tests (`npm run test:smoke`)

## 0.8.0 (2025-12-09)

- Completely rework the website layout and structure
    - Add Active component
    - Update Navigation with Github links and umami event tracking
    - Update HomePage to say more about the project (actual landing page)
        - Features
        - About
        - Roadmap
    - Update Footer to have a proper sitemap, legal and donate links.
    - Move the detailed map a new /campaign page
    - Move stats to the /stats page
- Add Mobile Navigation
- Add JSON LD to Event component
- Add robots.txt
- Add sitemap.js to generate sitemap.xml
- Update Umami tracking to only run in production.
- Remove NodeMailer and email/password login from auth.

## 0.7.4 (2025-12-09)

- fix react2shell

## 0.7.3 (2025-06-24)

- Add Github Action to generate PageSpeed Insights Metrics
- Update favicon.ico so there's less whitespace (more icon)
- Add loaderio verification file

## 0.7.2 (2025-06-20)

- Update Timeline to display nothing when no events are present.
- Fix Cyborg map order
- Update and reorganise README.md
- Add CodeQL and Dependabot badges to README.md

## 0.7.1 (2025-06-17)

- Update Umami tracking code(s)
- Update Tooltip to always show inside body
- Hidden campaigns now correctly display as 0 progress
- "in_progress" (contested region) doesn't pulse red. Only "active" (Defend & Attack Events) should pulse red.

## 0.7.0 (2025-06-16)

- Add reload.js to reload the page in client every 30 seconds.
- Update Map
    - show attack events (flashing)
    - show defend events (flashing)
    - Homeworld Tooptips
- Update Header to hide and show on scroll
- Update Timeline to show human readable time
- Update umami to use environment variables
- Fix Timeline
    - fix text color in Firefox & Chrome light modes
- Fix Map
    - progress styling in Firefox & Chrome
    - active event keeps showing up after finishing
- Fix Lighthouse bugs
    - Image sizing
    - WebP Fixes
    - Caching

## 0.6.3 (2025-06-11)

- add human readable time to attack and defend events
- add progress bar with points and percentage
- add event type icons

## 0.6.2 (2025-06-11)

- remove console.logs
- fix bug showing 0% Sol System
- rename layout2 to layout
- remove footer (temporarily)
- add season time
- track api calls as events instead of page visits.
- initialize.env.mjs - check if all .env variables are set.
- add proper favicons
- fix layout

## 0.6.1 (2025-06-09)

- Fixes to get Docker working (again).
- Responsive fixes
- code split Galaxy into:
    - Galaxy.jsx
        - Map.jsx & Map.css
        - Tooltip.jsx & Tooltip.css
- Adjust Tooltop
    - show percentage bar
    - show points earned/max
- Adjust Timeline
    - proper styling
- Create War Stats

## 0.6.0 (2025-06-09)

- Update Galaxy.jsx functionality
    - show captured regions (yellow border, yellow color)
    - show in_progress region (gold border, faction color)
    - show lost region (dark/transparent)
    - hover tooltip over regions to show region name

- Create Timeline.jsx component
    - show list of all defend/attack events, sorted by start_time

## 0.5.4 (2025-06-08)

- rewrite update logic to avoid having to generate complete season list.
- update worker to use .env variables for key and interval
- update route.js & rebroadcast.mjs for new logic
    - working POST /api/h1/rebroadcast
- update route.js & getCampaigns().mjs for new logic
    - working GET /api/h1/campaign
    - working GET /api/h1/campaign?season=[season]

## 0.5.3 (2025-05-31)

- rebroadcast now attempts to fetch data if it's not available locally before erroring out on season (get_snapshots) requests.
    - it will not fetch data for status (get_campaign_status) requests, because that data is continiously updated by the worker.
    - it will not longer check last_updated and trigger automatic updates in after().
        - current campaign's data is continiously updated by the worker.
        - old data will never change, and an update should thus only be triggered manually.
- GET /api/h1/campaign/ -> complete current/latest season data
- GET /api/h1/campaign?season=[season] -> complete specific season data

## 0.5.2 (2025-05-30)

- add server-side umami tracking to api routes
- adjust instrumentation.js
    - to make use of the new update functions to initialize the database with the current campaign
    - to add a node.js worker that will continiously update the database every 20 seconds

## 0.5.1 (2025-05-30)

- rework update functions
    - add `/api/h1/update` route to test update functionality
    - separate `update` directory
    - code split into:
        - fetch.mjs -> functions to fetch data from the API
        - status.mjs -> standalone function to update current status
        - season.mjs -> standalone function to update specified season
    - separate upsert queries for each data type
        - upsertAttackEvents.mjs
        - upsertCampaigns.mjs
        - upsertDefendEvent.mjs
        - upsertDefendEvents.mjs
        - upsertIntroductionOrder.mjs
        - upsertPointsMax.mjs
        - upsertSeason.mjs
        - upsertSnapshots.mjs
        - upsertStatistics.mjs

## 0.5.0 (2025-05-28)

- status badges in README.md
- /docs works in SSR mode
- generate opengraph-image at /api/og
- moved openapi spec to /public/openapi.json and adjust /Docs page
- moved prisma to production dependencies (as to run migrations from the docker container)
- cleaned up github action workflows
    - deleted manual.docker.yml
    - disabled status.docker.yml
    - created staging.docker.yml
        - added NODE_ENV=staging to build-args
        - added manual dispatch option (replaces manual.docker.yml)
    - edited release.docker.yml, added NODE_ENV=production to build-args
    - adjusted Dockerfile to support build-arg "NODE_ENV"

## 0.4.2 (2025-05-28)

- migrate openapi generation to instrumentation.js -> npm run build removes all comments from the code, so it cannot be generated live.
- add umami.js
- add Galactic Map
- add Stats
- Docker fixes
- Hosted and available at staging.helldivers.bot

## 0.4.1 (2025-05-20)

- create `/api/openapi` route.js that uses swagger-jsdoc and the JSDoc comments in `/api/h1/\*\*/\*.js` to generate an OpenAPI spec.
- create `/docs` page.jsx that uses swagger-ui-dist to render the OpenAPI spec.

## 0.4.0 (2025-05-20)

- implement Prisma Models for helldivers1 data
- POST /api/h1/rebroadcast
    - get_campaign_status
    - get_snapshots
- updateStatus.mjs
- updateSnapshot.mjs
- validate works in docker

## 0.3.3 (2025-05-19)

- Flesh out the Dashboard
    - Show list of API keys
    - Create new API key
    - Delete existing API key
- zod for validation
- Validate works in docker

## 0.3.2 (2025-05-15)

- Add nodemailer provider to auth
- Flesh out Frontend layout
- Add json-ld to Homepage
- Create Posts button ("use server")
- Show Posts

## 0.3.1 (2025-05-12)

- Validate auth still works in docker

## 0.3.0 (2025-05-12)

- Add dependencies for next-auth
- Configure [Auth](https://authjs.dev/getting-started/installation?framework=Next.js)
- Adjust Prisma Schema to support authentication
- Add pages and components to handle authentication

## 0.2.0 (2025-05-11)

- Change Github Actions to only build for amd64 -> this is so I can properly use the Labels in the Dockerfile, without requiring the use of annotations. [read more](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry#adding-a-description-to-multi-arch-images)
- Added and configured PrismaORM
- Added .example.env file
- Switched whole project to JavaScript (once again I am convinced typescript doesn't actually help, but only put spokes in your wheels).
- Working Docker build with PrismaORM

## 0.1.0 (2025-05-10)

- initialize project with `npx create-next-app@latest`
- Configure next.config.js to use output: 'standalone', which will be used by the container
- Configure Dockerfile, docker-compose.yml and .dockerignore to build a working container
- Configure Prettier and make it sort Tailwind CSS classes
- Add Chokidar to watch for changes in the src folder and run linting and prettier
- Add README.md, CHANGELOG.md, LICENSE
- Add Github Action to manually build the container and push it to Github Container Registry
- Add labels to Dockerfile
- Add some folder structure to the project
    - src/app -> routable content
    - src/components -> reusable components
- Add Github Action to automatically build and push the container to Github Container Registry on every tagged commit, and create a new release on Github.
