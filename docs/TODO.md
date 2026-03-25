# TODO

> Mobile-first. Most users visit from mobile — every feature starts there.
> Priority order: backend → core feature → phone → tablet → desktop → polish.

---

## Phase 1 — Backend & Database

Get the data layer right before touching the frontend.

### Schema Rework

- [ ] Drop `h1_defend_event` and `h1_attack_event` tables — migrate fully to unified `h1_event`
- [ ] Clean up redundant storage in `h1_introduction_order` (stores both `order Int[]` and `json Json`)
- [ ] Clean up redundant storage in `h1_points_max` (same duplication)
- [ ] Add interval statistics table — 15-min snapshots for season stats
- [ ] Add event-level interval statistics — 10-min snapshots for event progress
- [ ] Add composite indexes for common query patterns
- [ ] Migrate existing data to new schema

### Data Pipeline

- [ ] Map data pipeline — generate map JSON on each update cycle, store in `h1_map` or `App.map`
- [ ] Historic player count tracking (link to sale events — user-submitted, admin-approved)

### API Routes

- [ ] Review and clean up `/api/h1/update`, `/api/h1/campaign`, `/api/h1/rebroadcast`
- [ ] Ensure all routes use `tryCatch`, `errorResponse`/`successResponse`, Zod validation consistently

---

## Phase 2 — War Status Dashboard (Core Feature)

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

## Phase 3 — Mobile-First Design (Phone)

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

## Phase 4 — Tablet (`sm:` / `md:`)

- [ ] Tablet portrait: sidebar slides in or sits beside map
- [ ] Tablet landscape: side-by-side layout begins
- [ ] Navigation adapts to tablet size
- [ ] Alerts: horizontal scroll on tablet+

---

## Phase 5 — Desktop & Wide (`lg:` / `xl:` / `2xl:` / `3xl:`)

- [ ] Full sidebar + map + stats layout, no vertical scrolling
- [ ] Map: hovering alert highlights related map region
- [ ] `3xl` (1920px+): release max-width, go wide
- [ ] Custom ultrawide layout — use extra space meaningfully
- [ ] Test up to 21:9 ultrawide, apply max-width beyond that

---

## Phase 6 — Polish & Extras

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

> Revisit after Phase 5 is stable.

- **Discord bot rewrite** — focus on website + API first
- **SwiftUI app** — native iOS with Live Activities / Dynamic Island
- **Helmet photoshop** — about section avatar
