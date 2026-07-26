# CLAUDE.md

Next.js 16 app that caches the official Helldivers 1 API, stores historic game data, and provides API access + frontend visualizations.

## Critical Rules

- **KISS.** Simple solutions only. Do not overengineer or add abstractions for hypothetical future needs.
- **Never commit or push directly to `main` or `develop`** — always branch first, merge via PR.
- **Always verify** after implementing a feature: run `npm run lint`, `npm run typecheck`, `npm run test:unit`, and `npm run build`. All four must pass.
- **Assume the dev server is already running on :3000.** Ask the user to (re)start it separately if needed to clear cache or if it crashed.
- Report outcomes faithfully: if tests fail, say so with the relevant output; if you did not run a verification step, say that rather than implying it succeeded. Never claim "all tests pass" when output shows failures, never suppress or simplify failing checks (tests, lints, type errors) to manufacture a green result, and never characterize incomplete or broken work as done.

## File & Function Size

- Prefer files under ~500–800 LOC. Files over 1000 LOC must be split before major changes.
- Functions should stay under ~100 lines. Functions over 200 lines must be refactored before modification.
- Prioritize cohesion (one responsibility per file/module), clear boundaries, and readability over compactness.
- When reading files over 500 lines, use offset and limit parameters to read in chunks.
- When renaming or changing a function/type/variable, search for: direct calls, type references, string literals, re-exports, barrel files, and test mocks. Don't assume a single grep found everything.

## Working Style

- **Use agents** for codebase exploration and multi-step research tasks.
- **Use git worktrees** for parallel development on separate branches.
- **Vitest:** `npm run test:unit` (single run), `npm run test:coverage` (with coverage).
- **Smoke tests:** `npm run test:smoke` (`test:e2e` is an alias) — plain Vitest + `fetch` against a running server, no Playwright and no browser. Requires a server on `:3000` or `TEST_SERVER_URL`; it **fails** if none is reachable (`SMOKE_ALLOW_SKIP=1` to skip instead).
- Commands are in `package.json` (`npm run` to list). Env vars are in `.example.env`.
- **The unit test tree mirrors the source tree.** See § Test Layout below — put a new test at the mirrored path of the module it covers, or `npm run test:unit` fails.
- **Progressive env vars:** Only `POSTGRES_URL`, `UPDATE_KEY`, `UPDATE_INTERVAL` are required. Auth, analytics, and `BUCKET_SIZE` (timeseries bucket width) are optional — see `.example.env` section headers.

### DevTools Verification

Chrome DevTools MCP is available for debugging live pages. Use `evaluate_script` to inspect DOM state and RSC payload data. **Always verify CSS issues via DevTools before guessing** — use `getComputedStyle()` to check actual applied values.

After any frontend/CSS change, verify via DevTools before declaring done:

- `getComputedStyle()` — confirm CSS properties match intent
- `getBoundingClientRect()` — confirm sizing, no unexpected overflow
- For map/SVG: verify SVG rect within container rect on all sides
- For grid/flex: check parent-child sizing chain
- For interactive changes: programmatically trigger state changes and verify DOM updates

## Worktree Workflow

Features use an isolated git worktree off `develop`; small chores commit directly on a branch (no worktree). Both still follow the rules in § Git Workflow.

**When to use a worktree (features):** new functionality, multi-file refactors, anything large enough to warrant a PR, anything that benefits from isolation while iterating. Default for any task you'd otherwise raise a feature branch for.

**When to skip the worktree (small chores/bugfixes):** dependency bumps, `npm audit` fixes, doc edits, lint/format passes, copy tweaks, single-call-site bugfixes, CLAUDE.md/CHANGELOG updates. Branch from `develop` in the main checkout, commit, merge with `git merge --no-ff` per § Git Workflow. Use judgment; if unsure, default to a worktree.

**Feature workflow (worktree):**

1. Create the worktree off `develop` (run from the main checkout):
   `git worktree add .worktrees/<branch-dir> -b feature/<desc> develop`
2. Copy gitignored env files from the main checkout: `cp ../../.env.development .` (and any `.env.local` if present — `*.env*` is gitignored, so the dev server can't boot without them)
3. Install dependencies in the worktree: `npm install && npx prisma generate` (Prisma client outputs to `src/generated/prisma/` which is gitignored, so it must be regenerated per worktree)
4. Do the work in the worktree directory — small, logical commits as you go, not one giant commit at the end
5. Verify in the worktree: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build` (all four must pass — same chain as § Critical Rules)
6. Merge back from the main checkout: `git checkout develop && git merge --no-ff feature/<desc>` — include the version bump + CHANGELOG move into `## X.Y.Z` in the merge commit per § Git Workflow rule #2
7. Push `develop`, then clean up: `git worktree remove .worktrees/<branch-dir>` + `git branch -d feature/<desc>`

**Worktree directory:** `.worktrees/` in project root (already gitignored). Directory names mirror the branch with slashes replaced by hyphens (e.g., `feature/ministry-interference` → `.worktrees/feature-ministry-interference`).

**Prisma migrations:** If the branch creates a migration under `prisma/migrations/`, remind the user to run `npx prisma migrate deploy` against the local database after merging, before the next dev-server restart.

## Git Workflow

**Branching model:** Simplified Git Flow — no release branches.

| Branch            | Purpose              | Deploys to            | Protected     |
| ----------------- | -------------------- | --------------------- | ------------- |
| `main`            | Production releases  | Production (via tags) | Yes — PR only |
| `develop`         | Integration/staging  | Staging (auto)        | No            |
| `feature/<desc>`  | New functionality    | —                     | No            |
| `bugfix/<desc>`   | Non-urgent fixes     | —                     | No            |
| `hotfix/<semver>` | Emergency prod fixes | —                     | No            |
| `metrics`         | CI-generated metrics | —                     | No            |

`metrics` is a **standalone** branch, not part of the flow: CI pushes generated
metrics to it (PageSpeed/Lighthouse, etc.). It never merges to or from `develop` or
`main` — leave it alone (don't delete it as stale, don't fold it into the flow).

**Rules:**

0. **Never squash merge. Never fast-forward merge.** Always use `git merge --no-ff` so every merge creates a merge commit and the branch boundary stays visible in `git log --graph`. Never `--squash`, never `--rebase`, never `--ff-only`.
1. **Create feature/bugfix/chore branches from `develop`.** Features use a worktree (see § Worktree Workflow) and merge back via PR. Bugfix and chore branches skip the worktree and merge via `git merge --no-ff` directly into `develop` (branch → commit → `git checkout develop && git merge --no-ff <branch>` → push → delete branch). No PR needed.
2. **Version on merge to `develop`:** When merging a branch into `develop`, **in the same commit** move its changelog entries from `## Unreleased` into a new `## X.Y.Z` section and bump `"version"` in `package.json` to match. Do not defer this to a separate commit or ask — it is part of the merge step. Use semver: patch for bugfixes, minor for features, major for breaking changes. Skipping version numbers between releases is fine — not every version on `develop` will be tagged on `main`.
3. **Release process:** Merge `develop` → `main` via PR → **tag `vX.Y.Z` on the merge commit on `main`** (use the latest version from `CHANGELOG.md`) → push tag → **merge `main` back into `develop`** (`git checkout develop && git merge origin/main && git push`). The production Docker build only triggers on version tags, so forgetting to tag means no deployment. The merge-back carries main's PR merge commit into develop so the next release PR doesn't trip the "branch not up to date" check.
4. **Hotfix process:** Cut `hotfix/X.Y.Z` from `main` → fix → update `CHANGELOG.md` with new version section → PR to `main` → tag `vX.Y.Z` → merge back to `develop`
5. **Semver tagging:** `v<major>.<minor>.<patch>` on `main` only (always use `v` prefix)

**Git Flow automation (git-workflow skill):**

- `/git-workflow:feature <desc>` — create feature branch from `develop`
- `/git-workflow:hotfix <semver>` — create hotfix branch from `main`
- `/git-workflow:finish` — merge current branch to correct target(s), tag, cleanup
- `/git-workflow:flow-status` — show branch status, stale branches, version info

Prefer these commands over manual git operations.

## Conventions

### Error Handling

Use the `tryCatch` wrapper (`src/shared/utils/tryCatch.mjs`). Do NOT use try/catch blocks.

```js
const { data, error } = await tryCatch(someAsyncOperation());
if (error) {
    /* handle */
}
```

### API Routes

- Use `errorResponse(code, start, error)` and `successResponse(code, start, data)` from `src/shared/utils/api/responses.mjs`
- Measure execution time with `roundedPerformanceTime(start)` from `src/shared/utils/time.mjs`

### Analytics Tracking

Every interactive element (links, buttons, nav items) must have Umami tracking. Use `category-action` naming:

- **`data-umami-event="category-action"`** for simple clicks (nav links, buttons, toggles). Preferred — the tracker script handles it automatically.
- **`useTrack()` hook** for dynamic interactions where event name or data depends on state (e.g., `track('faction-tab-switch', { faction: id })`).
- **`window.umami?.track()`** inside `useEffect` callbacks where hooks can't be called.
- **`sendUmamiEvent()`** for server-side API route tracking (called inside `after()` to avoid blocking responses).

Categories: `nav`, `auth`, `footer`, `docs`, `diagram`, `faction`, `archive`, `notification`, `push`, `sw`, `toast`, `dashboard`, `api`.

When adding a new interactive element, always add a `data-umami-event` attribute. When adding a new API route that serves external consumers, add a server-side `umamiTrackEvent` call.

### Validation

All external data validated with Zod schemas (`src/validators/`) before database operations.

### Test Layout

`src/__tests__/unit/` mirrors the source tree, so "does X have a test?" is answerable by path. A test for `src/features/galaxy/Map.jsx` is at `src/__tests__/unit/features/galaxy/Map.test.jsx`, and nowhere else. Enforced by `src/__tests__/unit/_meta/mirrorTree.test.mjs`:

> a test at `unit/<dir>/<Base>[.<qualifier>].test.*` must have a source file at `<root>/<dir>/<Base>.*` or `<root>/<dir>/<Base>/<Base>.*`, for `<root>` in {`src`, `public`}

Both source shapes are accepted because `src/shared/components/` mixes them (per-component folders _and_ flat files) — mirror whichever shape the component actually uses.

The optional `.<qualifier>` segment covers everything the bare rule can't:

- **Several tests for one module** — `actions.apiKeys.test.mjs` + `actions.userData.test.mjs` both cover `features/account/actions.mjs`.
- **A named export of a differently-named file** — `StatGrid.StatCard.test.jsx` tests `StatCard`, exported from `StatGrid.jsx`. Name it after the **host file**, not the export.

Three escape hatches, all name-based (there is no allowlist):

| Pattern                | Use for                                                               |
| ---------------------- | --------------------------------------------------------------------- |
| `unit/_meta/**`        | tests of the repo itself — `package.json`, `jsconfig`, `.example.env` |
| `*.contract.test.*`    | a contract spanning several modules (e.g. the v1 pagination contract) |
| `*.integration.test.*` | a test exercising several modules together                            |

Don't reach for an escape hatch to dodge a move. A test that imports many modules but is _about_ one still belongs next to that one.

### Imports

`@/*` maps to `./src/*` (configured in `jsconfig.json`).

### Formatting & Linting

Prettier with tailwindcss plugin handles formatting. ESLint v9 (flat config in `eslint.config.mjs`) handles lint, with Prettier wired in as a rule via `eslint-plugin-prettier` — so `npm run lint` catches both formatting and lint violations. `npm run lint:fix` auto-fixes both. **Always run `npm run lint:fix` before committing** — not during development.

Type checking: `npm run typecheck` runs `tsc --noEmit` against `jsconfig.json` with `checkJs: true`, validating JSDoc annotations across the project. Tests are excluded from the typecheck scope (they're validated by vitest).

### Styling

Tailwind-first: use utility classes and theme tokens (`bg-primary`, `border-ghost`, `text-text-muted`, etc.) before reaching for custom CSS. Only create a `.css` file when Tailwind cannot express the style (complex animations, pseudo-element content, multi-selector cascades). If a CSS custom property is used in more than one component, add it to the `@theme` block in `layout.css` so it's available as a utility.

### Design Tokens

All visual properties use CSS custom properties defined in the Tailwind v4 `@theme` block in `src/app/layout.css`. See `/brandkit` for visual reference.

- Colors: `--color-primary`, `--color-danger`, `--color-surface-0` through `--color-surface-4`, `--color-faction-*`
- Fonts: `--font-display` (Insignia, titles only), `--font-body` (Inter), `--font-mono` (Space Mono)
- Faction colors: Bugs=#E8822A (orange), Cyborgs=#8B2D2D (dark red), Illuminate=#7EC8E3 (cyan)
- Border radius: 0px everywhere (enforced via Tailwind `@theme`)
- Cards: right-side accent line (4-6px) using CSS Grid

## Architecture — Stack

- **Normalized 5-table schema:** `h1_season` (root anchor with inlined `introduction_order[]`, `points_max[]`, `season_duration[]`), `h1_status` (bucketed campaign timeseries), `h1_statistic` (bucketed stats timeseries), `h1_event` (mutable current event state), `h1_event_progress` (bucketed event progression). No raw-cache tables — the rebroadcast API reconstructs wire format from normalized data.
- **Bucket-upsert pattern:** Both API paths (`updateStatus` from `get_campaign_status`, `updateSeason` from `get_snapshots`) write to the same `h1_status` / `h1_statistic` / `h1_event_progress` tables. Polls are grouped into configurable time buckets (`BUCKET_SIZE` env var, in seconds, default `900` = 15 min). Within a bucket, values are overwritten (upsert by `season + enemy + bucket`); a new bucket creates a new row. Shared helper: `src/shared/utils/bucketing.mjs`.
- **Data-source unification:** Both HD1 endpoints write to the same normalized tables. `get_campaign_status` provides live campaign progress + statistics; `get_snapshots` provides historical snapshots + events. The worker polls both every ~15 seconds. On-demand backfill of missing seasons also uses `updateSeason`. The live dashboard reads the latest bucket; archives read the full timeseries.
- **Season transition closing pass:** When the HD1 API flips from one season to the next, it writes one final "closing" snapshot to the old season a few minutes after the transition. `src/app/api/h1/update/route.js` tracks the season from the previous poll in module-level state (`lastSeasonObserved`) and runs `updateSeason(previousSeason)` once when the current poll's season is higher — catching that closing frame before the worker moves on. Non-fatal on error; the module state resets on worker restart (the only edge case being a restart during the tiny transition window, recoverable via the admin refresh button).
- **Cross-season lagged event slots:** `get_campaign_status` returns `defend_event` and `attack_events` as "most recent event" slots that persist across season transitions until a new event of the same type replaces them. `getSeasonFromStatus` must NOT aggregate their `.season` into the current-season resolver (they'll report stale values for hours or days after a transition), and `queryUpsertEvent` has an explicit `if (event.season !== season) skip` guard to prevent lagged events from leaking into the wrong season bucket.
- **Worker thread** (`public/workers/cron.js`) uses `setTimeout` (not `setInterval`) to prevent overlapping requests. Both API endpoints polled every ~15s, each going through Zod validation then bucket-upsert into the `h1_*` tables.
- **Prisma 7** with `@prisma/adapter-pg` driver adapter. Client outputs to `src/generated/prisma/`. CLI config in `prisma.config.mjs`.
- **Auth (optional):** BetterAuth with database sessions (Prisma adapter). Discord + GitHub OAuth. Server config in `src/auth.js` (exports `null` when `BETTER_AUTH_SECRET` absent), client utilities in `src/auth-client.js`. When disabled: no sign-in UI, `/profile` redirects home, auth API returns 503.
- **React Compiler** enabled experimentally in `next.config.mjs`.
- **Error tracking (optional):** Sentry SDK configured for self-hosted GlitchTip (`tracesSampleRate` 0.1 in production / 1.0 in dev, `environment` tagging, no replays/logs). Client tunnel (`/api/glitchtip`) bypasses ad blockers. CSP violations reported via `report-uri`. Route-level (`error.jsx`) and component-level (`ComponentErrorBoundary`) error boundaries for graceful degradation. When `SENTRY_AUTH_TOKEN` absent, `withSentryConfig` build plugin skipped.
- **Node version:** mise pins node@24 (ships with npm 11 natively).
- **Server actions:** Most utilities use `'use server'` directive.
- **Shared utilities:** `formatNumber` (`src/shared/utils/format/formatNumber.mjs`) for compact numbers (25.0M, 1.2K — M suffix at 1M+, locale grouping below). `formatTimeAgo` (`src/shared/utils/format/formatTimeAgo.mjs`) for relative timestamps.
- **Map state:** `computeMapState` (`src/shared/utils/game/computeMapState.mjs`) computes galaxy map sector ownership. Sectors 1-10 from campaign `points`/`points_max`; region 11 (homeworld) from attack events only. **Critical:** live views must only pass active events. `computeLiveMap(data)` is the **single source** of that active-events filter — it returns `{ activeEvents, mapState }` and is used by both `/api/h1/live` and the public `/api/v1/h1/map` so the two can't drift. `computeLiveMapState(data)` is a thin wrapper returning just the map, for SSR/OG callers (`layout.jsx`, `opengraph-image.jsx`).
- **On-demand season fetching:** `/archives` page derives SeasonSelector from current season number (not DB query). Missing seasons are backfilled from the official HD1 API on first request via `updateSeason()` (`src/update/season.mjs`) -- the same shared pipeline the worker runs every poll for the active season and the admin "Refresh" button triggers via `reseedSeason`. `updateSeason` writes `h1_season` (with inlined arrays) + `h1_status` + `h1_statistic` + `h1_event` + `h1_event_progress`, then stamps `h1_season.last_updated`.
- **Live polling:** `useLiveData` hook (`src/shared/hooks/useLiveData.mjs`) polls `GET /api/h1/live` every 10 seconds via `setInterval` + `fetch`. A `visibilitychange` listener fires an immediate poll on tab focus. Tri-state status: `'polling'` (request in flight), `'live'` (last poll succeeded), `'offline'` (last poll failed or PWA offline). Module-level singleton ensures one connection per tab. BroadcastChannel leader election for Web Notifications.
- **Stale version auto-reload:** Three layers detect stale client code after deployments and hard-reload: (1) Next.js `deploymentId` in `next.config.mjs` triggers hard navigation on version mismatch during client-side routing; (2) `/api/h1/live` includes `appVersion` — `useLiveData` compares it against the build-time version and reloads on mismatch (~10s detection); (3) global `ChunkLoadError` handler in `instrumentation-client.js` catches failed dynamic imports. All layers share `guardedReload()` (`src/shared/utils/reloadGuard.mjs`) — a localStorage-backed circuit breaker with 30s TTL and max 3 attempts to prevent infinite reload loops.
- **Notifications:** `detectChanges()` (`src/shared/utils/game/detectChanges.mjs`) detects event transitions (started/won/lost) on both client (Sonner toasts + Web Notifications) and server (push via `web-push`). `LiveToasts` also shows catch-up toasts for active events on page load. The Sonner `<Toaster>` is co-located inside `LiveToasts` (not root layout) to share the same module singleton — rendering it from a server component creates a separate `ToastState`. Single "Enable notifications" button enables both web and push. Push subscriptions stored in `push_subscription` table.
- **Analytics (optional):** Umami v3 (self-hosted, cookieless). Umami `<Script>` tag conditional on `UMAMI_SITE_ID`. Three tracking layers: (1) `data-umami-event` HTML attributes for click tracking — the tracker script captures these automatically; (2) `useTrack` hook (`src/shared/hooks/useTrack.mjs`) or `window.umami?.track()` for dynamic JS interactions; (3) `sendUmamiEvent()` (`src/shared/utils/umami.mjs`) for server-side API route tracking. Client-side tracker posts through same-origin proxy (`/api/umami` route, `/api/send` rewrite) to bypass ad blockers. Authenticated users identified via `umami.identify()` in `UserSection.jsx`. Production-only — no tracking in dev/test.
- **PWA:** Serwist (`@serwist/next`) generates service worker at build time with automatic precache manifest (content-hash based). Config in `serwist.config.js`, source in `src/sw.js`, output in `public/sw.js` (gitignored build artifact). `skipWaiting: true` for immediate updates. Custom push notification handlers in `src/sw.js`. Last poll payload cached in localStorage for offline fallback.
- **Diagrams:** Mermaid-based via shared `MermaidDiagram` component (`src/shared/components/MermaidDiagram/`). Each diagram is a Mermaid definition string + config object (views, flows, node details, legend). Supports flow-based filtering (dim/highlight via CSS classes on SVG DOM nodes) and clickable detail panels. Node IDs must use underscores (Mermaid treats hyphens as minus). Colors match docs conventions (`classDef` with same hex values). Mermaid loaded via dynamic `import()` — client-side only, no SSR. `ProgressExplainer` (Recharts) is separate.

## Architecture — Frontend Layout

- **Mobile-first layout:** Phase 6 single-column dashboard. Phase 7 added tablet responsive (md: portrait, lg: landscape with map+sidebar). Phase 9 removed snap scroll, added hero section, replaced `WarSummary` with WON/LOST stat cards in StatGrid.
- **Key components:** `BottomNav` (hidden at md:), `HeaderNav` (page links at md:), `FactionTabs`, `StatGrid`, `DashboardClient`, `EventCard`, `TimelineSection`, `ConnectionStatus`, `LiveToasts`, `NotificationToggle`.
- **Dashboard hero section:** At lg:, fills viewport height (`height: calc(100dvh - 80px)`). Sidebar (hero text + regions + stats) left, galaxy map right. Normal scroll to `TimelineSection` below.
- **Map sizing:** Map column sized from viewport height via `minmax(0, calc((100dvh - 80px) * 806.93 / 868.81))`. SVG uses `preserveAspectRatio="xMaxYMid meet"`. Galaxy wrapper uses `w-full h-full`.
- **Grid rules:** Columns must use `minmax(0, 1fr)` not bare `1fr` to prevent overflow. Dashboard grid: `minmax(260px, 1fr) minmax(0, calc(...))` — single definition for all desktop breakpoints.

## Task Tracking

All work tracked via [GitHub Issues](https://github.com/elfensky/helldivers.bot/issues), grouped by milestone and labels. No project board — issues + milestones + labels only.

- **Milestones** group issues by phase (Phase 0 through ~13 as of writing, plus `Desloppify` and `Shelved`). Phase numbers grow and open/closed status drifts — check the [milestones list](https://github.com/elfensky/helldivers.bot/milestones) for current state rather than trusting a number here.
- **Labels**: `bug`, `enhancement`, `feature`, `api`, `frontend`, `infrastructure`, `security`, `chore`, `shelved`.
- **Issue title prefixes**: `Phase N:`, `Shelved:`.

### Workflow

1. **Before starting**: Check GitHub Issues. If none exists, create one with the right milestone and labels.
2. **When done**: Close the issue with an implementation comment.

## Specs & Plans

For every phase or feature, use the `/superpowers:brainstorming` skill to explore requirements and design, then `/octo:embrace` to execute a full Discovery → Define → Develop → Deliver workflow. These skills generate specs and plans as conversation artifacts — no separate doc files needed.

## Reference Docs

| Topic                              | Location                                                  |
| ---------------------------------- | --------------------------------------------------------- |
| Docker, CI/CD, init flow, env vars | [`/docs/infrastructure`](/docs/infrastructure)            |
| Database schema & relationships    | [`/docs/database`](/docs/database)                        |
| Data pipeline & worker lifecycle   | [`/docs/data-flow`](/docs/data-flow)                      |
| API endpoints & authentication     | [`/docs/api`](/docs/api)                                  |
| Utilities & Zod validators         | [`/docs/utilities`](/docs/utilities)                      |
| Testing infrastructure             | [`/docs/testing`](/docs/testing)                          |
| Real-time & notifications          | [`/docs/notifications`](/docs/notifications)              |
| Data flow architecture             | [`/docs/architecture`](/docs/architecture)                |
| Authentication & roles             | [`/docs/authentication`](/docs/authentication)            |
| Frontend design system & tokens    | [`/docs/brandkit`](/docs/brandkit) + `src/app/layout.css` |
| Official HD1 API reference         | [`/docs/hd1-api`](/docs/hd1-api)                          |
