# Changelog

## Unreleased

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
- Add Playwright smoke tests (`npm run test:smoke`)

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
