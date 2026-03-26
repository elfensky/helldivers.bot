# TODO

> Mobile-first. Most users visit from mobile — every feature starts there.
> Priority order: backend → core feature → phone → tablet → desktop → polish.

---

## Phase 1 — Backend & Database

Get the data layer right before touching the frontend.

> Spec: [`docs/superpowers/specs/2026-03-25-phase-1-backend-database-design.md`](superpowers/specs/2026-03-25-phase-1-backend-database-design.md)

- [x] Unify `h1_defend_event` + `h1_attack_event` → `h1_event`
- [x] Drop redundant `json` fields from `h1_introduction_order`, `h1_points_max`, and `h1_snapshot`
- [x] Replace `h1_campaign` + `h1_statistic` + `App.map` → `h1_live` table
- [x] Make `defend_event` nullable in Zod validator (`isValidStatus.js`)
- [x] Fix BigInt serialization in API responses (`responses.mjs`)
- [x] Add composite indexes for common query patterns
- [x] Clean up rebroadcast route (`tryCatch` consistency)
- [x] Update `/api/h1/campaign` route to read from `h1_live`
- [x] Create seed files for past seasons (`prisma/seed/seasons/`)

---

## Phase 2 — Time-Series Snapshots

Capture how stats and events change over time. Depends on Phase 1 normalized tables.

> Spec: [`docs/superpowers/specs/2026-03-25-phase-2-time-series-snapshots.md`](superpowers/specs/2026-03-25-phase-2-time-series-snapshots.md)

- [x] Drop `h1_snapshot.json` column (Phase 1 gap)
- [x] Add `h1_live_snapshot` table (15-min interval stats from `h1_live`)
- [x] Add `h1_event_snapshot` table (10-min event progress with FK to `h1_event`)
- [x] Wire snapshot capture into polling pipeline (`status.mjs`)
- [x] Fix `fetchStatus()` error swallowing
- [x] Add timestamp range validation to Zod schema

---

## Phase 3 — API Key Enforcement

Gate the rebroadcast endpoint behind API key validation.

> Spec: [`docs/superpowers/specs/2026-03-25-phase-3-api-key-enforcement-design.md`](superpowers/specs/2026-03-25-phase-3-api-key-enforcement-design.md)

- [x] Add `validateApiKey(request)` utility in `src/db/queries/api.mjs`
- [x] Integrate key validation into rebroadcast POST handler
- [x] Add error codes 6 (401 Unauthorized) and 7 (403 Forbidden)

---

## Phase 4 — War Status Dashboard (Core Feature)

The war dashboard is now the homepage. `/war` repurposed as historical season browser.

### Layout

- [x] Move war dashboard to `/` (replace current homepage sections)
- [ ] Single-page layout: sidebar with stats, main area with map + active events
- [ ] No vertical scroll on desktop — everything fits in viewport
- [x] Old homepage content (About, Discord, API) moved to `/about`; Features section deleted

### Alerts & Notifications

- [ ] Install Sonner
- [ ] Wire up event alerts (defend/attack events) as toasts

### Real-Time Updates

- [ ] WebSocket server for live campaign updates
- [ ] Client-side: connect on dashboard, update map + stats + alerts in real-time
- [ ] Fallback to polling if WebSocket connection fails

---

## Phase 5 — Mobile-First Design (Phone)

Base Tailwind styles (no breakpoint prefix) = phone viewport. Build everything from here up.

### Design Tokens

- [ ] Define design tokens in CSS/Tailwind
    - Colors: map CSS vars (`--orange`, `--cyan`, `--blue`, `--black`) to final palette
    - [x] Typography: fluid `clamp()` scale on base HTML elements (`layout.css`) — `Insignia` for headings, system stack for body; breakpoint text classes removed from components
    - Spacing: standardize gutters, padding, gaps
    - Shadows, borders, radii
- [ ] Patch color palette — replace leftover purple/blue-ish with Helldivers yellow/cyan
- [ ] Create reusable component patterns: cards, buttons, section containers
- [ ] Define breakpoint semantics:
    - `default` — phone (mobile-first base)
    - `sm` (640px) — tablet portrait
    - `md` (768px) — tablet landscape
    - `lg` (1024px) — desktop
    - `xl` (1280px) — desktop wide
    - `2xl` (1536px) — max-width applied
    - `3xl` (1920px) — ultrawide: max-width released, wide layout

### Mobile Navigation

- [ ] Rewrite mobile nav as a proper React component (replace vanilla `navigation.js`)
- [ ] Slide-out or slide-down mobile menu with backdrop
- [ ] Smooth open/close animation (CSS transitions, no layout shift)
- [ ] Close on route change and outside click
- [ ] Sign-in button with distinct mobile style

### Dashboard on Phone

- [ ] Map stacked above stats list
- [ ] Events list below map
- [ ] Touch-friendly hit targets and interactions
- [ ] Sonner toasts positioned for mobile

---

## Phase 6 — Tablet (`sm:` / `md:`)

- [ ] Tablet portrait: sidebar slides in or sits beside map
- [ ] Tablet landscape: side-by-side layout begins
- [ ] Navigation adapts to tablet size
- [ ] Alerts: horizontal scroll on tablet+

---

## Phase 7 — Desktop & Wide (`lg:` / `xl:` / `2xl:` / `3xl:`)

- [ ] Full sidebar + map + stats layout, no vertical scrolling
- [ ] Map: hovering alert highlights related map region
- [ ] `3xl` (1920px+): release max-width, go wide
- [ ] Custom ultrawide layout — use extra space meaningfully
- [ ] Test up to 21:9 ultrawide, apply max-width beyond that

---

## Phase 8 — Polish & Extras

### PWA

- [ ] Add `manifest.json` (app name, icons, theme color, display: standalone)
- [ ] Implement service worker for offline shell + caching
- [ ] Push notification subscription flow (ask permission, store subscription)
- [ ] Server-side push: send notifications on in-game events (defend/attack events)
- [ ] "Install app" prompt/banner

### War History & Animated Replay

- [x] Route: `/war?season=N` — historical season browser with season selector
- [x] `getSeasonList()` query for season selector

#### Data prerequisites

- [ ] Add `points`, `points_taken`, `points_max`, `status` columns to `h1_live_snapshot` — currently only captures stats, not campaign progress; without these fields the sector map cannot be reconstructed from time-series data alone (must fall back to legacy `h1_snapshot` table)

#### Animation engine (zero new dependencies)

- [ ] Extract `processCampaigns()` + `processDefendEvents()` + `processAttackEvents()` from `Galaxy.jsx` into a pure function `deriveMapState(snapshotData, events, pointsMax)` — no shared mutable `map` object
- [ ] New API route: `GET /api/v1/war/[season]/timeline` — server-side merge of `h1_snapshot` + `h1_event` + `h1_event_snapshot` into sorted keyframe array
- [ ] `usePlayback` hook: `setInterval` stepping through keyframe array indices (not wall-clock time — snapshots are unevenly spaced)
- [ ] CSS transitions on `.sector { transition: fill 500ms ease-in-out }` for smooth state changes between frames

#### Timeline scrubber

- [ ] `<input type="range">` mapped to keyframe array index, display real timestamp as label
- [ ] Play / Pause button
- [ ] Speed selector (1x / 2x / 5x / 10x)
- [ ] Day counter ("Day 14 of 45")
- [ ] "Jump to next event" button

#### Event visualization during playback

- [ ] Active events: use existing `.active` CSS pulse animation on contested regions
- [ ] Defend success: green flash (800ms `@keyframes`), then revert to `captured`
- [ ] Defend fail: red flash (800ms), revert to `lost`
- [ ] Attack events: pulse on homeworld (region 11) with progress overlay

#### Data limitations (known)

- Past seasons: no event point progression (only final state in `h1_event`)
- Past seasons: no homeworld attack progress over time
- `h1_event_snapshot` only exists going forward (Phase 2 capture)
- Snapshot intervals are irregular — map slider to array index, not wall-clock

### SEO & Meta

- [ ] Add `robots.txt` (static file or Next.js route)
- [x] Update `sitemap.js` — added `/war`, `/about`
- [ ] Update `sitemap.js` — add `/docs`, `/api`, `/faq` pages
- [ ] Add JSON-LD to Event component

### Design Polish

- [ ] Section flourishes (decorative dividers, lines, Helldivers motifs)
- [ ] Add skull/wing decorative elements where appropriate
- [ ] Rotating/blinking logo animation on hover (satellite)
- [ ] `Wings` component integration on section titles

### Footer

- [ ] Fix empty `href=""` links (Terms, Privacy, Bug Bounty, Cookies, Campaign, History, GitHub, Twitter)
- [ ] Responsive: stack sections properly on mobile
- [ ] Proper sitemap links pointing to actual pages

---

## Done

- [x] Active component (`src/components/h1/Active/Active.jsx`)
- [x] Navigation with GitHub link + Umami event tracking
- [x] Homepage sections: About, Features, Discord, API (moved to `/about` in v0.10.0)
- [x] Footer with sitemap structure
- [x] `sitemap.js` route
- [x] Umami analytics — production only
- [x] Remove NodeMailer (commented out in `auth.js`)
- [x] Color palette CSS variables
- [x] Custom `Insignia` font for headings
- [x] Gutters utility classes
- [x] War page (`/war`) with Galaxy, War, Timeline (repurposed as history browser in v0.10.0)
- [x] Live war dashboard at `/` with Galaxy, War, Timeline (v0.10.0)
- [x] About page (`/about`) with relocated marketing content (v0.10.0)
- [x] Navigation: "War" → "History", added "About" link (v0.10.0)
- [x] Stats page (`/stats`)
- [x] JSON-LD on layout and war page
- [x] Mobile hamburger menu (basic — needs React rewrite)
- [x] Fluid `clamp()` typography on base HTML elements (`layout.css`), breakpoint text classes removed from components

---

## Shelved

> Revisit after Phase 7 is stable.

- **Discord bot rewrite** — focus on website + API first
- **SwiftUI app** — native iOS with Live Activities / Dynamic Island
- **Helmet photoshop** — about section avatar
