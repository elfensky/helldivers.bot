# Codebase Structure

**Analysis Date:** 2026-08-28

## Directory Layout

```
helldivers.bot/
├── src/
│   ├── app/                # Next.js App Router — pages, layouts, API routes
│   │   ├── api/             # Route handlers (internal + public v1 + auth)
│   │   ├── archives/        # /archives page + loading/error boundaries
│   │   ├── docs/            # MDX documentation site (architecture, API, notifications, etc.)
│   │   ├── legal/, profile/, sandbox/, sign-in/, stats/  # remaining top-level routes
│   │   └── layout.jsx, page.jsx, error.jsx, global-error.jsx, sitemap.js, robots.txt
│   ├── features/            # Feature-scoped components + logic, one dir per domain area
│   │   ├── account/, admin/, archives/, dashboard/, galaxy/, ministry/, notifications/, stats/, timeline/
│   ├── shared/              # Cross-feature reusable code
│   │   ├── components/      # Shared UI primitives (per-component folders AND flat files)
│   │   ├── enums/, hooks/, preferences/, providers/, utils/
│   ├── update/               # Ingestion pipeline: fetch upstream, validate, bucket-upsert, lease, push
│   ├── db/                   # Prisma client singleton + one query file per table/operation
│   │   └── queries/
│   ├── validators/            # Zod schemas for external/upstream data
│   ├── config/                 # App-level configuration
│   ├── types/                   # Shared JSDoc/type definitions
│   ├── generated/prisma/         # Prisma client output (gitignored)
│   └── __tests__/
│       ├── unit/                 # Mirrors src/ + public/ tree exactly (see § Naming Conventions)
│       ├── smoke/                 # Plain Vitest + fetch against a running server
│       ├── visual/                 # Vitest browser mode, committed baseline PNGs
│       └── utils/                   # Test helpers
├── public/
│   └── workers/                # cron.js (thread shell) + cronLogic.js (testable poll loop)
├── prisma/
│   ├── schema.prisma            # 5-table h1_* schema + auth tables
│   ├── migrations/                # One dir per migration
│   └── seed/                       # Local dev seed scripts
├── deploy/
│   └── staging/compose.yaml        # Docker Swarm stack, Git-Synced by Arcane
│   └── README.md                     # Staging deploy runbook (lease, ingress, secrets, known gaps)
├── scripts/
│   ├── analysis/                    # Standalone prediction/analysis scripts (numbered pipeline)
│   └── backfill-h1-tables.mjs, start-standalone.sh, visual-tests.sh
├── docs/                              # (mostly superseded by src/app/docs MDX; docs/superpowers/ holds handoff notes)
└── .planning/codebase/                  # This directory — codebase maps for GSD tooling
```

## Directory Purposes

**`src/app/`:**
- Purpose: Next.js App Router — every folder with a `page.jsx`/`route.js` is a routable URL segment.
- Contains: page components, layouts, loading/error boundaries, API route handlers, MDX docs pages.
- Key files: `src/app/layout.jsx` (root layout, SSR map seed), `src/app/page.jsx` (dashboard home), `src/app/api/h1/update/route.js` (ingestion entry point), `src/app/api/h1/live/route.js` (live polling endpoint).

**`src/app/api/`:**
- Purpose: All HTTP route handlers.
- Contains: `h1/` (internal: `update`, `live`, `campaign`, `rebroadcast`), `v1/h1/` (public, versioned: `map`, `season`, `stats`, `status`, each with a co-located `*Projection.mjs` that shapes the wire response), `auth/[...all]` (BetterAuth catch-all), `notifications/subscribe`, `healthcheck`, `glitchtip` (Sentry tunnel), `umami` (analytics proxy).
- Key files: each `route.js` exports `GET`/`POST` etc.; unsupported methods export `methodNotAllowed` from `src/shared/utils/api/methodNotAllowed.mjs`.

**`src/features/`:**
- Purpose: Domain-scoped UI + logic that isn't shared across features.
- Contains: one directory per feature area — `dashboard` (home page components + forecast models), `galaxy` (map SVG + event cards), `timeline` (event/cascade logs), `archives` (season browsing + narrative generation), `admin` (internal tools, worker health), `account` (API key management), `ministry` ("ministry interference" flavor text/hijack UI), `notifications`, `stats`.
- Key files: components and their co-located `.mjs` logic/`.css` files live flat in each feature dir (no further nesting).

**`src/shared/`:**
- Purpose: Code used by 2+ features or by both `app/` and `features/`.
- Contains: `components/` (mixes per-component folders and flat files — mirror whichever shape a given component already uses), `hooks/` (`useLiveData.mjs`, `usePersistedState.mjs`, etc.), `utils/` (further subdivided into `api/`, `format/`, `game/`), `enums/`, `preferences/`, `providers/`.
- Key files: `src/shared/utils/tryCatch.mjs` (error-handling convention), `src/shared/utils/api/responses.mjs` (`errorResponse`/`successResponse`), `src/shared/utils/game/computeMapState.mjs` (live-map single source of truth), `src/shared/hooks/useLiveData.mjs`.

**`src/update/`:**
- Purpose: The ingestion pipeline — everything between "fetch from HD1 API" and "row written to `h1_*` tables".
- Contains: `fetch.mjs` (upstream HTTP), `status.mjs` (`get_campaign_status` → `h1_status`/`h1_statistic`), `season.mjs` (`get_snapshots` → `h1_event`/`h1_event_progress`/`h1_season`/`h1_statistic`), `lease.mjs` (poller coordination), `pushNotifier.mjs` (event-diff push notifications).
- Key files: `src/update/lease.mjs` (multi-replica lease, #517), consumed exclusively by `src/app/api/h1/update/route.js`.

**`src/db/`:**
- Purpose: Data access layer — thin, single-responsibility functions per table/query.
- Contains: `db.js` (Prisma client + `@prisma/adapter-pg` singleton), `queries/` (one file per upsert or read: `upsertStatus.mjs`, `upsertStatistic.mjs`, `upsertEvent.mjs`, `upsertEventProgress.mjs`, `upsertSeason.mjs`, `getCampaign.mjs`, `getSeasons.mjs`, `getStats.mjs`, `rebroadcast.mjs`, etc.).
- Key files: `src/db/db.js` is the only place a new Prisma client should be constructed.

**`src/validators/`:**
- Purpose: Zod schemas validating upstream HD1 API payloads before any DB write.
- Contains: `isValidStatus.mjs`, `isValidSeason.mjs`, `isValidNumber.mjs`, `isValidContentType.mjs`, `isValidFormData.mjs`.

**`public/workers/`:**
- Purpose: The polling worker thread, split for testability.
- Contains: `cron.js` (thin `worker_threads` shell — connects `parentPort` to the loop), `cronLogic.js` (`makeDoWork()` — the actual self-scheduling `fetch` loop, unit-tested without spawning a thread), `package.json` (worker's own package boundary).

**`prisma/`:**
- Purpose: Database schema, migrations, and local seed data.
- Contains: `schema.prisma` (5-table `h1_*` schema plus BetterAuth tables), `migrations/` (one dir per migration, timestamped), `seed/` (`seed.mjs`, `fetch-seasons.mjs`).
- Generated: `src/generated/prisma/` is the Prisma Client output — gitignored, regenerated per environment/worktree via `npx prisma generate`.

**`deploy/`:**
- Purpose: Infrastructure-as-code for the staging Docker Swarm stack.
- Contains: `staging/compose.yaml` (single writer, Git-Synced by Arcane — do not `docker stack deploy` by hand once Arcane is set up), `README.md` (runbook: lease behavior, ingress via Cloudflare Tunnel, Swarm secrets, known gaps).
- Note: `docker-compose.yml` for local dev is not in this directory — check repo root / `.example.env` for local dev setup.

**`scripts/analysis/`:**
- Purpose: Standalone, numbered prediction/analysis pipeline scripts (attack ETA, wave models, counterattack targeting, outcome composite) — not part of the app runtime.
- Contains: `01-trigger-hunt.mjs` through `18-outcome-composite.mjs`, `lib/backtest.mjs`, `lib/dataset.mjs`.
- Generated: Not generated; hand-authored research scripts, run ad hoc via `node scripts/analysis/NN-*.mjs`.

**`docs/`:**
- Purpose: `docs/superpowers/` holds a living investigation handoff doc (`predictions-handoff.md`). The user-facing documentation site itself lives at `src/app/docs/**` as MDX pages, not in this top-level `docs/` directory.

**`.planning/codebase/`:**
- Purpose: Machine-generated codebase maps consumed by GSD planning/execution commands (this file and its siblings).
- Generated: Yes, by `/gsd-map-codebase` mapper agents. Committed: yes.

## Key File Locations

**Entry Points:**
- `public/workers/cron.js`: worker thread bootstrap
- `src/app/api/h1/update/route.js`: ingestion pipeline HTTP entry point
- `src/app/api/h1/live/route.js`: live dashboard polling endpoint
- `src/app/layout.jsx`, `src/app/page.jsx`: SSR dashboard shell + home

**Configuration:**
- `prisma.config.mjs`: Prisma CLI config
- `next.config.mjs`: Next.js config (React Compiler, `deploymentId`)
- `jsconfig.json`: `@/*` → `./src/*` path alias, `checkJs: true` for `npm run typecheck`
- `eslint.config.mjs`: ESLint v9 flat config with Prettier wired in as a rule
- `serwist.config.js`: PWA service worker generation config
- `.example.env`: documents all env vars, progressive/optional groups

**Core Logic:**
- `src/update/*.mjs`: ingestion pipeline
- `src/db/queries/*.mjs`: data access
- `src/shared/utils/game/computeMapState.mjs`: live-map derivation single source of truth

**Testing:**
- `src/__tests__/unit/`: unit tests, mirrors source tree
- `src/__tests__/unit/_meta/mirrorTree.test.mjs`: enforces the mirror rule
- `src/__tests__/smoke/`: fetch-based smoke tests against a running server
- `src/__tests__/visual/`: Playwright-Docker visual regression, committed baselines

## Naming Conventions

**Files:**
- Source modules: `.mjs` for pure logic/utilities, `.js` for Next.js-convention files (`route.js`, `layout.jsx`'s sibling `.js` files), `.jsx` for React components.
- Component files: PascalCase matching the exported component (`DashboardClient.jsx`, `EventCard.jsx`).
- Utility/logic files: camelCase describing the function (`computeMapState.mjs`, `detectChanges.mjs`, `formatTimeAgo.mjs`).
- CSS: co-located with the component it styles, same base name (`EventCard.css` next to `EventCard.jsx`).
- Test files: `<Base>[.<qualifier>].test.<ext>` at the mirrored path — see § Test Layout in CLAUDE.md for the exact grammar (escape hatches: `_meta/**`, `*.contract.test.*`, `*.integration.test.*`).

**Directories:**
- Feature directories under `src/features/` are singular domain nouns (`dashboard`, `galaxy`, `timeline`, `archives`, `admin`, `account`, `ministry`, `notifications`, `stats`) — flat inside, no further nesting.
- API route directories under `src/app/api/` mirror the URL path exactly (`api/v1/h1/map/route.js` → `GET /api/v1/h1/map`).
- `src/shared/utils/` is subdivided by concern (`api/`, `format/`, `game/`), not by feature.

## Where to Add New Code

**New Feature (UI + logic for a domain area):**
- Primary code: new directory under `src/features/<name>/`, flat files inside (components + their `.mjs` logic + `.css`)
- Tests: `src/__tests__/unit/features/<name>/<Base>.test.jsx` (or `.mjs`), mirroring exactly

**New API route (internal or public):**
- Internal: `src/app/api/h1/<name>/route.js`
- Public versioned: `src/app/api/v1/h1/<name>/route.js` + a co-located `<name>Projection.mjs` if it reshapes normalized data into a wire format
- Use `errorResponse`/`successResponse` from `src/shared/utils/api/responses.mjs`, `roundedPerformanceTime` from `src/shared/utils/time.mjs`
- Tests: `src/__tests__/unit/app/api/<path>/route.test.mjs`

**New ingestion step (upstream data type):**
- Fetch/orchestration: `src/update/<name>.mjs`
- Validation: `src/validators/isValid<Name>.mjs`
- Persistence: `src/db/queries/upsert<Name>.mjs`
- Wire into `src/app/api/h1/update/route.js` if it must run every poll

**New DB query/upsert:**
- `src/db/queries/<verb><Name>.mjs`, one function per file

**Shared utility (used by 2+ features):**
- `src/shared/utils/<concern>/<name>.mjs` (pick `api/`, `format/`, or `game/` if it fits; otherwise flat under `src/shared/utils/`)

**Shared React hook:**
- `src/shared/hooks/use<Name>.mjs`

**New Zod validator:**
- `src/validators/isValid<Name>.mjs`

## Special Directories

**`src/generated/prisma/`:**
- Purpose: Prisma Client output.
- Generated: Yes (`npx prisma generate`).
- Committed: No (gitignored) — must be regenerated per worktree/environment.

**`public/sw.js`:**
- Purpose: Serwist-generated service worker with content-hash precache manifest.
- Generated: Yes, at build time.
- Committed: No (gitignored build artifact). Source lives at `src/sw.js`.

**`.worktrees/`:**
- Purpose: Git worktrees for isolated feature branches (per CLAUDE.md § Worktree Workflow).
- Generated: Created ad hoc via `git worktree add`.
- Committed: No (gitignored).

**`src/__tests__/visual/` baselines:**
- Purpose: Platform-specific PNG snapshots for visual regression.
- Generated: Yes (`npm run test:visual:update`, must run inside the Playwright Docker image).
- Committed: Yes.

**`prisma/migrations/`:**
- Purpose: One directory per schema migration, applied in order.
- Generated: Yes (`prisma migrate dev`/`deploy`).
- Committed: Yes.

---

*Structure analysis: 2026-08-28*
