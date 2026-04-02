# Changelog

## Unreleased

### Phase 9: Timeline Visual Refinement & Dashboard Polish

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
- Update CSP to allow external analytics and error tracking scripts
- Add HSTS header to close Checkmarx security finding

#### Infrastructure

- Replace Playwright with Vitest smoke tests, update docker-compose for local dev (#202)
- Consolidate package.json scripts — remove 4 redundant commands (#201)
- Automate production releases with release-please

#### Code Quality (desloppify)

- Fix server action directives — remove from pipeline, standardize in queries
- Refactor rebroadcast queries and route validation order
- Standardize query return shapes across `db/queries/`
- Standardize auth/error handling in `api.mjs`
- Fix contract lies in utils — explicit returns, docstrings, error logging
- Restore module-level `'use server'` on `api.mjs` — required for client imports

#### Chores

- Consolidate CSS files and reintroduce responsive header scroll-hide
- Replace gutters wrapper with fragment on home page
- Disable link prefetching, reorganize README security section
- Self-heal missing migrate image in staging CI

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

- Update doc references to wiki, fix Mermaid FK-UK syntax
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
- Add Playwright smoke tests (`npm run test:smoke`)

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
