# TODO

> Mobile-first. Most users visit from mobile — every feature starts there.

---

## v0.9 — Mobile-First Redesign & PWA

The fundamental shift: rebuild the frontend mobile-first using the Stitch redesign.

### Style Guide & Design System

- [ ] Define design tokens in CSS/Tailwind (from Stitch redesign)
  - Colors: map current CSS vars (`--orange`, `--cyan`, `--blue`, `--black`) to Stitch palette
  - Typography: `Insignia` for headings, system stack for body — define scale
  - Spacing: standardize gutters, padding, gaps
  - Shadows, borders, radii
- [ ] Define breakpoint semantics:
  - `default` — phone (mobile-first base)
  - `sm` (640px) — tablet portrait
  - `md` (768px) — tablet landscape
  - `lg` (1024px) — desktop
  - `xl` (1280px) — desktop wide
  - `2xl` (1536px) — max-width applied
  - `3xl` (1920px) — ultrawide: max-width released, wide layout
- [ ] Create reusable component patterns: cards, buttons, section containers
- [ ] Patch color palette — replace leftover purple/blue-ish with Helldivers yellow/cyan

### Mobile Navigation

- [ ] Rewrite mobile nav as a proper React component (replace vanilla `navigation.js`)
- [ ] Slide-out or slide-down mobile menu with backdrop
- [ ] Smooth open/close animation (CSS transitions, no layout shift)
- [ ] Close on route change and outside click
- [ ] Sign-in button with distinct mobile style

### Homepage Redesign (Mobile-First)

- [ ] Hero section: rebuild from phone viewport up
  - Map: decide mobile treatment (cut off? scroll? separate view?)
  - Alerts: stack vertically on mobile, horizontal scroll on tablet+
  - Stats row: 2x2 grid on mobile, inline on desktop
  - CTA button: full-width on mobile
- [ ] About section: single column, properly spaced
- [ ] Features section: stack cards vertically on mobile (currently broken — `w-1/3` on mobile)
- [ ] Discord section: clean up placeholder text ("insert [screenshot]")
- [ ] API section: clean up
- [ ] Buy/Play section: small card, links to Steam/PSN
- [ ] Roadmap section: link to GitHub Issues/Projects

### Footer

- [ ] Fix empty `href=""` links (Terms, Privacy, Bug Bounty, Cookies, Campaign, History, GitHub, Twitter)
- [ ] Responsive: stack sections properly on mobile
- [ ] Proper sitemap links pointing to actual pages

### SEO & Meta

- [ ] Add `robots.txt` (static file or Next.js route)
- [ ] Update `sitemap.js` — add `/war`, `/docs`, `/api`, `/faq`, `/discord` pages
- [ ] Add JSON-LD to Event component

### PWA

- [ ] Add `manifest.json` (app name, icons, theme color, display: standalone)
- [ ] Implement service worker for offline shell + caching
- [ ] Push notification subscription flow (ask permission, store subscription)
- [ ] Server-side push: send notifications on in-game events (defend/attack events)
- [ ] "Install app" prompt/banner

---

## v1.0 — Real-Time Data & Schema

### WebSockets

- [ ] WebSocket server for live campaign updates
- [ ] Client-side: connect on homepage, update map + stats + alerts in real-time
- [ ] Fallback to polling if WebSocket connection fails

### Database Schema Rework

- [ ] Unify `h1_attack_event` + `h1_defend_event` into single `h1_event` table with `type` field
- [ ] Add interval statistics table (15-min snapshots for season stats)
- [ ] Add event-level interval statistics (10-min snapshots for event progress)
- [ ] Historic player count tracking (link to sale events — user-submitted, admin-approved)
- [ ] Migrate existing data to new schema

### Map Data Pipeline

- [ ] Generate map data as JSON on each update cycle
- [ ] Store in `h1_map` JSON field (or similar)
- [ ] Map component + WebSocket reads latest map state directly

---

## v1.1 — War History & Polish

### War History Page

- [ ] Route: `/war/:seasonId` (e.g., `/war/153`)
- [ ] On load: animate war progress from start to current
- [ ] Season switcher to browse previous wars
- [ ] Animated map playback using historical statistics

### Design Polish

- [ ] Section flourishes (decorative dividers, lines, Helldivers motifs)
- [ ] Add skull/wing decorative elements where appropriate
- [ ] Rotating/blinking logo animation on hover (satellite)
- [ ] `Wings` component integration on section titles
- [ ] Map: hovering alert highlights related map region (mobile: info replaces alert area)

### Ultrawide Support

- [ ] `3xl` (1920px+): release max-width, go wide
- [ ] Custom ultrawide layout — use extra space meaningfully
- [ ] Test up to 21:9 ultrawide, apply max-width beyond that

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

> Revisit after v1.0 is stable.

- **Discord bot rewrite** — focus on website + API first
- **SwiftUI app** — native iOS with Live Activities / Dynamic Island
- **Helmet photoshop** — about section avatar
