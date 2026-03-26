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
- [ ] Create seed files for past seasons (`prisma/seed/seasons/`)

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

- [ ] Add `validateApiKey(request)` utility in `src/db/queries/api.mjs`
- [ ] Integrate key validation into rebroadcast POST handler
- [ ] Add error codes 6 (401 Unauthorized) and 7 (403 Forbidden)

---

## Phase 4 — War Status Dashboard (Core Feature)

The war dashboard becomes the homepage. Single-page, no vertical scrolling on desktop.

### Layout

- [ ] Move war dashboard to `/` (replace current homepage sections)
- [ ] Single-page layout: sidebar with stats, main area with map + active events
- [ ] No vertical scroll on desktop — everything fits in viewport
- [ ] Decide what to do with old homepage content (About, Features, Discord, API, Buy/Play sections)

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
    - Typography: `Insignia` for headings, system stack for body — define scale
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

### War History Page

- [ ] Route: `/war/:seasonId` (e.g., `/war/153`)
- [ ] On load: animate war progress from start to current
- [ ] Season switcher to browse previous wars
- [ ] Animated map playback using historical statistics

### SEO & Meta

- [ ] Add `robots.txt` (static file or Next.js route)
- [ ] Update `sitemap.js` — add `/war`, `/docs`, `/api`, `/faq`, `/discord` pages
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
- [x] Homepage sections: About, Features, Discord, API
- [x] Footer with sitemap structure
- [x] `sitemap.js` route
- [x] Umami analytics — production only
- [x] Remove NodeMailer (commented out in `auth.js`)
- [x] Color palette CSS variables
- [x] Custom `Insignia` font for headings
- [x] Gutters utility classes
- [x] War page (`/war`) with Galaxy, War, Timeline
- [x] Stats page (`/stats`)
- [x] JSON-LD on layout and war page
- [x] Mobile hamburger menu (basic — needs React rewrite)

---

## Shelved

> Revisit after Phase 7 is stable.

- **Discord bot rewrite** — focus on website + API first
- **SwiftUI app** — native iOS with Live Activities / Dynamic Island
- **Helmet photoshop** — about section avatar
