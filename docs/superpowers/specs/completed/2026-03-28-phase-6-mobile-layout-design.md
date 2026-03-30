# Phase 6: Mobile-First Dashboard Layout — Design Spec

**Date:** 2026-03-28
**Issue:** #121 (Phase 6: Dashboard Layout Mobile-First)
**Status:** Draft — pending user approval

## Problem

The current frontend was built desktop-first with no mobile considerations. Components are laid out with `flex-row` and `xl:fixed` positioning that breaks on small screens. The homepage has content overflowing, the galaxy map is hard to interact with, and stats are in long scrollable columns.

## Goal

Rebuild the homepage and war history page with a mobile-first layout that works perfectly on phones, then progressively enhances for tablet/desktop in Phase 7.

## Design Decisions

### Navigation: Bottom Tab Bar

Replace the current header-only nav with a **bottom tab bar** on mobile:

- 3 tabs: **Live** | **History** | **About**
- 48px height, `--color-surface-1` background
- Active tab: `--color-primary` text + 2px top border
- Inactive: `--color-text-muted`
- Keep the header slim (logo + hamburger for secondary links like Dashboard, GitHub, Sign In)

**Why:** For a 3-page app, a hamburger menu is an unnecessary extra tap. Bottom tabs are thumb-accessible and show you where you are.

### Homepage Layout (Live Dashboard)

Single column, top to bottom:

```
┌──────────────────────────┐
│ HEADER (logo + hamburger)│
├──────────────────────────┤
│ ALERT BANNER             │  ← only when active events exist
│ (defend/attack event)    │
├──────────────────────────┤
│ GALAXY MAP               │  ← full-width, view-only
│ (SVG, non-interactive)   │
│ + "LIVE" indicator       │
├──────────────────────────┤
│ [GLOBAL][BUGS][CYB][ILL] │  ← sticky faction tabs
├──────────────────────────┤
│ STATS GRID (2×2)         │  ← updates based on selected tab
│ ┌──────┐ ┌──────┐       │
│ │ 332  │ │39.5M │       │
│ │Online│ │Killed│       │
│ └──────┘ └──────┘       │
│ ┌──────┐ ┌──────┐       │
│ │857K  │ │199K  │       │
│ │Lost  │ │Accid.│       │
│ └──────┘ └──────┘       │
├──────────────────────────┤
│ EVENT TIMELINE           │
│ ┌────────────────────┬─┐ │
│ │Won Defend Event    │▌│ │
│ │Finished 10h ago    │▌│ │
│ └────────────────────┴─┘ │
│ ┌────────────────────┬─┐ │
│ │Failed Defend Event │▌│ │
│ │Finished 15h ago    │▌│ │
│ └────────────────────┴─┘ │
├──────────────────────────┤
│ BOTTOM TAB BAR           │
│ [Live]  [History] [About]│
└──────────────────────────┘
```

Key decisions:

- **Faction switcher tabs** replace the 3 separate faction stat sections. Tap a faction → stats grid updates. Reduces scroll by ~60%.
- **Galaxy map is view-only** on mobile. No hover tooltips (touch doesn't have hover). Tap for fullscreen zoom later.
- **Stats in 2×2 grid** — data cards with right-side accent lines.
- **Alert banner** at top (red pulsing border) only shows when active events exist.

### War History Layout

```
┌──────────────────────────┐
│ HEADER                   │
├──────────────────────────┤
│ SEASON SELECTOR          │  ← native <select> dropdown
│ [Season 167        ▼]   │
├──────────────────────────┤
│ ── VICTORY ──            │  ← large outcome badge
├──────────────────────────┤
│ GALAXY MAP               │  ← static snapshot at selected point
│ (historical state)       │
├──────────────────────────┤
│ TIMELINE SCRUBBER        │  ← range input, full-width
│ ═══════●═════════════    │
│ T-MINUS 14:02:45         │
├──────────────────────────┤
│ EVENT DETAIL CARD        │  ← shows event at scrubber position
│ ┌────────────────────┬─┐ │
│ │Defense of Malevelon│▌│ │
│ │63/100 (63.2%)      │▌│ │
│ └────────────────────┴─┘ │
├──────────────────────────┤
│ BOTTOM TAB BAR           │
│ [Live]  [History] [About]│
└──────────────────────────┘
```

Key decisions:

- **Native `<select>`** for season — not a custom dropdown. Works on all mobile browsers.
- **Timeline scrubber stays as range input** — simpler than a vertical stepper, already works on touch.
- **Map shows static snapshot** at the selected timeline point. No real-time scrubbing animation on mobile.

### Stats Page

**Merge into homepage.** The faction switcher tabs on the homepage replace the need for a separate `/stats` page. The current stats page is a text-only duplicate of homepage data.

### About Page

Minimal changes needed — it's mostly static text sections. Just ensure the Swagger UI is scrollable and the sections use full-width cards with proper mobile spacing.

## Component Changes

| Component             | Change                                                | Files                                                    |
| --------------------- | ----------------------------------------------------- | -------------------------------------------------------- |
| **BottomNav** (new)   | Bottom tab bar with 3 tabs                            | `src/components/layout/BottomNav/BottomNav.jsx` + `.css` |
| **Header**            | Slim down: logo left, hamburger right (secondary nav) | `src/components/layout/Header/Header.jsx`                |
| **FactionTabs** (new) | Segmented control for faction switching               | `src/components/h1/FactionTabs/FactionTabs.jsx`          |
| **Stats**             | Refactor to accept faction filter, render 2×2 grid    | `src/components/h1/Stats/Stats.jsx`                      |
| **Galaxy**            | View-only mode on mobile, no tooltip                  | `src/components/h1/Galaxy/Galaxy.jsx`                    |
| **Timeline**          | Vertical event card list, right-side accents          | `src/components/h1/Timeline/Timeline.jsx`                |
| **Alerts**            | Full-width top banner, pulsing red border             | `src/components/h1/Alerts/Alerts.jsx`                    |
| **Event**             | Data card format with right-side accent               | `src/components/h1/Event/Event.jsx`                      |
| **Homepage**          | Complete layout rewrite, mobile-first                 | `src/app/page.jsx`                                       |

## Out of Scope

- Interactive map tooltips on mobile (Phase 7 — long-press gesture)
- Tablet layout (Phase 7)
- Desktop sidebar layout (Phase 7)
- Ultrawide optimizations (Phase 7)
- Reviews page redesign (shelved)
- FAQ page (not implemented)
- Dashboard page redesign (auth-gated, low priority)
- Advanced history filtering/search
- PWA / offline support (Phase 9)
- Complex data visualizations / charts (Phase 9)

## Design Token Usage

All components use tokens from `src/styles/tokens.css`:

- Backgrounds: `--color-surface-0` (page), `--color-surface-1` (nav, panels), `--color-surface-2` (cards)
- Text: `--color-text`, `--color-text-muted`
- Accents: `--color-primary` (yellow), `--color-danger` (red alerts)
- Factions: `--color-faction-bugs` (#E8822A), `--color-faction-cyborgs` (#8B2D2D), `--color-faction-illuminate` (#7EC8E3)
- Cards: 4px right-side accent, `--color-ghost-border` containers
- Radius: 0px everywhere
- Spacing: `--space-*` tokens

## Stitch Reference Screens

- Live Dashboard: `projects/17395750638589517331/screens/291878c9454d4d16b21f5f53d6c5635f`
- War History: `projects/17395750638589517331/screens/c4dd019bd9b74408b2f1d31165000843`
- Original refined mobile: `projects/17395750638589517331/screens/97e9e1db69fc4f68932bf3dcae2166ca`

## Verification

1. `npm run build` passes
2. `npm run test:unit:run` — all tests pass
3. Visual check at mobile viewport (390px) via Chrome DevTools
4. All content from content inventory is accessible on mobile
5. Bottom nav works and highlights active page
6. Faction tabs switch stats correctly
7. Galaxy map renders at full width without overflow
