# CHANGELOG

Given a version number MAJOR.MINOR.PATCH, increment the:

- MAJOR version when you make incompatible API changes
- MINOR version when you add functionality in a backward compatible manner
- PATCH version when you make backward compatible bug fixes

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

## x.x.x (YYYY-MM-DD)

- To be copied from RELEASE.md

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
