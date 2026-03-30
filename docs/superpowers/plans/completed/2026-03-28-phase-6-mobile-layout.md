# Phase 6: Mobile-First Dashboard Layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the homepage and war history page with mobile-first layouts — bottom tab nav, faction switcher, 2×2 stat grid, vertical event timeline.

**Architecture:** Mobile-first single-column layout. New BottomNav and FactionTabs components. Stats refactored from client-side fetch to server-rendered with faction filter prop. Homepage completely rewritten from `xl:fixed` desktop layout to mobile-first stacked sections. All components use design tokens from `src/styles/tokens.css`.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, CSS custom properties

**Spec:** `docs/superpowers/specs/2026-03-28-phase-6-mobile-layout-design.md`

---

## File Structure

### New Files

| File                                            | Responsibility                                             |
| ----------------------------------------------- | ---------------------------------------------------------- |
| `src/components/layout/BottomNav/BottomNav.jsx` | Bottom tab bar (Live/History/About)                        |
| `src/components/layout/BottomNav/BottomNav.css` | Bottom nav styling                                         |
| `src/components/h1/FactionTabs/FactionTabs.jsx` | Segmented control for faction switching (client component) |
| `src/components/h1/FactionTabs/FactionTabs.css` | Faction tabs styling                                       |
| `src/components/h1/StatGrid/StatGrid.jsx`       | 2×2 data card grid for stats                               |
| `src/components/h1/StatGrid/StatGrid.css`       | Stat grid styling                                          |

### Modified Files

| File                                      | Change                                            |
| ----------------------------------------- | ------------------------------------------------- |
| `src/app/layout.jsx`                      | Add BottomNav, adjust main padding for bottom nav |
| `src/app/page.jsx`                        | Complete rewrite — mobile-first stacked layout    |
| `src/app/war/page.jsx`                    | Mobile-friendly layout adjustments                |
| `src/components/h1/Event/Event.jsx`       | Data card format with right-side accent           |
| `src/components/h1/Event/Event.css`       | New — replaces Timeline.css event styles          |
| `src/components/h1/Alerts/Alerts.jsx`     | Full-width top banner format                      |
| `src/components/h1/Alerts/Alerts.css`     | Updated alert styling                             |
| `src/components/layout/Header/Header.jsx` | Slim mobile header                                |

### Key Existing Files (read-only reference)

| File                                  | What it provides                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| `src/styles/tokens.css`               | All design tokens (colors, fonts, spacing)                                     |
| `src/db/queries/getCampaign.mjs`      | Campaign data query                                                            |
| `src/utils/computeMapState.mjs`       | Derives map state from live + events data                                      |
| `src/enums/factions.mjs`              | Faction name/icon/url mapping (0=Bugs, 1=Cyborgs, 2=Illuminate, 3=Super Earth) |
| `src/components/h1/Galaxy/Galaxy.jsx` | Galaxy map — receives `mapState` prop                                          |

---

## Task 1: BottomNav Component

**Files:**

- Create: `src/components/layout/BottomNav/BottomNav.jsx`
- Create: `src/components/layout/BottomNav/BottomNav.css`
- Modify: `src/app/layout.jsx`
- Modify: `src/app/layout.css`

- [ ] **Step 1: Create BottomNav component**

```jsx
// src/components/layout/BottomNav/BottomNav.jsx
'use client';
import './BottomNav.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
    const pathname = usePathname();

    const tabs = [
        { href: '/', label: 'Live', icon: '◉' },
        { href: '/war', label: 'History', icon: '◈' },
        { href: '/about', label: 'About', icon: '◇' },
    ];

    return (
        <nav className="bottom-nav">
            {tabs.map(({ href, label, icon }) => {
                const isActive =
                    href === '/' ? pathname === '/' : pathname.startsWith(href);
                return (
                    <Link
                        key={href}
                        href={href}
                        className={`bottom-nav-tab ${isActive ? 'active' : ''}`}
                    >
                        <span className="bottom-nav-icon">{icon}</span>
                        <span className="bottom-nav-label">{label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
```

- [ ] **Step 2: Create BottomNav CSS**

```css
/* src/components/layout/BottomNav/BottomNav.css */
.bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 50;
    display: flex;
    height: 48px;
    background: var(--color-surface-1);
    border-top: 1px solid var(--color-ghost-border);
}

.bottom-nav-tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    color: var(--color-text-muted);
    text-decoration: none;
    font-family: var(--font-body);
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-top: 2px solid transparent;
    transition: color 0.15s ease;
}

.bottom-nav-tab.active {
    color: var(--color-primary);
    border-top-color: var(--color-primary);
}

.bottom-nav-icon {
    font-size: 1rem;
    line-height: 1;
}

.bottom-nav-label {
    line-height: 1;
}
```

- [ ] **Step 3: Add BottomNav to layout and adjust padding**

In `src/app/layout.jsx`, import and render BottomNav after Footer:

```jsx
import BottomNav from '@/components/layout/BottomNav/BottomNav';

// In the return, after <Footer />:
<BottomNav />;
```

In `src/app/layout.css`, add bottom padding to main for the bottom nav:

```css
/* Change the main padding-top and add padding-bottom */
/* The main element in layout.jsx uses className with pt-[50px] sm:pt-[80px] */
/* Add pb-[48px] to the main className in layout.jsx */
```

Update the main className in `layout.jsx`:

```jsx
<main className="flex min-h-screen w-screen flex-col pt-[50px] pb-[48px] sm:pt-[80px]">
```

- [ ] **Step 4: Build and verify**

Run: `npm run build`
Expected: Build succeeds, `/brandkit` and all pages still render.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/BottomNav/ src/app/layout.jsx
git commit -m "feat: add bottom tab navigation (Live/History/About)"
```

---

## Task 2: FactionTabs Component

**Files:**

- Create: `src/components/h1/FactionTabs/FactionTabs.jsx`
- Create: `src/components/h1/FactionTabs/FactionTabs.css`

- [ ] **Step 1: Create FactionTabs component**

```jsx
// src/components/h1/FactionTabs/FactionTabs.jsx
'use client';
import './FactionTabs.css';

const TABS = [
    { id: 'global', label: 'Global' },
    { id: 'bugs', label: 'Bugs' },
    { id: 'cyborgs', label: 'Cyborgs' },
    { id: 'illuminate', label: 'Illuminate' },
];

export default function FactionTabs({ active, onChange }) {
    return (
        <div className="faction-tabs">
            {TABS.map(({ id, label }) => (
                <button
                    key={id}
                    className={`faction-tab ${active === id ? 'active' : ''}`}
                    onClick={() => onChange(id)}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}
```

- [ ] **Step 2: Create FactionTabs CSS**

```css
/* src/components/h1/FactionTabs/FactionTabs.css */
.faction-tabs {
    display: flex;
    width: 100%;
    background: var(--color-surface-1);
    border: 1px solid var(--color-ghost-border);
}

.faction-tab {
    flex: 1;
    padding: 0.5rem 0;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    font-family: var(--font-body);
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition:
        color 0.15s ease,
        border-color 0.15s ease;
}

.faction-tab.active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
}

.faction-tab:nth-child(2).active {
    color: var(--color-faction-bugs);
    border-bottom-color: var(--color-faction-bugs);
}

.faction-tab:nth-child(3).active {
    color: var(--color-faction-cyborgs);
    border-bottom-color: var(--color-faction-cyborgs);
}

.faction-tab:nth-child(4).active {
    color: var(--color-faction-illuminate);
    border-bottom-color: var(--color-faction-illuminate);
}
```

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds. Component is created but not yet used.

- [ ] **Step 4: Commit**

```bash
git add src/components/h1/FactionTabs/
git commit -m "feat: add FactionTabs segmented control component"
```

---

## Task 3: StatGrid Component

**Files:**

- Create: `src/components/h1/StatGrid/StatGrid.jsx`
- Create: `src/components/h1/StatGrid/StatGrid.css`

- [ ] **Step 1: Create StatGrid component**

This is a server component that renders a 2×2 grid of data cards with right-side accent lines. It accepts campaign `live` data and a `faction` filter.

```jsx
// src/components/h1/StatGrid/StatGrid.jsx
import './StatGrid.css';

function formatNumber(n) {
    if (n === undefined || n === null) return '—';
    const num = Number(n);
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return num.toLocaleString();
    return String(num);
}

export default function StatGrid({ live, faction }) {
    if (!live?.length) return null;

    if (faction === 'global') {
        const totals = live.reduce(
            (acc, s) => ({
                players: acc.players + Number(s.players || 0),
                kills: acc.kills + Number(s.kills || 0),
                deaths: acc.deaths + Number(s.deaths || 0),
                accidentals: acc.accidentals + Number(s.accidentals || 0),
            }),
            { players: 0, kills: 0, deaths: 0, accidentals: 0 },
        );
        return (
            <div className="stat-grid">
                <StatCard
                    label="HELLDIVERS_ONLINE"
                    value={formatNumber(totals.players)}
                />
                <StatCard label="ENEMIES_KILLED" value={formatNumber(totals.kills)} />
                <StatCard label="HELLDIVERS_LOST" value={formatNumber(totals.deaths)} />
                <StatCard label="ACCIDENTALS" value={formatNumber(totals.accidentals)} />
            </div>
        );
    }

    const factionIndex = { bugs: 0, cyborgs: 1, illuminate: 2 }[faction];
    const stats = live.find((s) => s.enemy === factionIndex);
    if (!stats) return null;

    return (
        <div className="stat-grid">
            <StatCard label="ONLINE" value={formatNumber(stats.players)} />
            <StatCard label="MISSIONS" value={formatNumber(stats.successful_missions)} />
            <StatCard label="DEATHS" value={formatNumber(stats.deaths)} />
            <StatCard label="ACCIDENTALS" value={formatNumber(stats.accidentals)} />
        </div>
    );
}

function StatCard({ label, value }) {
    return (
        <div className="stat-card">
            <div className="stat-card-content">
                <span className="stat-card-label">{label}</span>
                <span className="stat-card-value">{value}</span>
            </div>
            <div className="stat-card-accent" />
        </div>
    );
}
```

- [ ] **Step 2: Create StatGrid CSS**

```css
/* src/components/h1/StatGrid/StatGrid.css */
.stat-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
}

.stat-card {
    display: grid;
    grid-template-columns: 1fr 4px;
    background: var(--color-surface-1);
    border: 1px solid var(--color-ghost-border);
}

.stat-card-content {
    padding: 0.5rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
}

.stat-card-label {
    font-family: var(--font-mono, monospace);
    font-size: 0.5625rem;
    color: var(--color-outline);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}

.stat-card-value {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 900;
    color: var(--color-primary);
    line-height: 1;
}

.stat-card-accent {
    background: var(--color-primary);
}
```

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/h1/StatGrid/
git commit -m "feat: add StatGrid 2×2 data card component"
```

---

## Task 4: Event Card Redesign

**Files:**

- Modify: `src/components/h1/Event/Event.jsx`
- Create: `src/components/h1/Event/Event.css` (new — move styles from Timeline.css)

- [ ] **Step 1: Rewrite Event component with data card format**

The new Event component uses the right-side accent pattern. Read the current file first, then rewrite preserving the data fields and schema function.

Key changes:

- Grid layout with 4px right-side accent
- Accent color based on event type (defend=danger, attack=primary)
- Status shown as text badge, not background color
- Progress bar inside the card
- Remove dependency on Timeline.css event classes

```jsx
// src/components/h1/Event/Event.jsx
import './Event.css';
import factions from '@/enums/factions.mjs';
import { evaluateProgress } from '@/utils/evaluateProgress.mjs';
import humanizeDuration from 'humanize-duration';

export default function Event({ event }) {
    const remaining = event.end_time - Math.floor(Date.now() / 1000);
    const percent = ((event.points / event.points_max) * 100).toFixed(2);
    const progress = evaluateProgress(event);
    const faction = factions[event.enemy];
    const isDefend = event.type === 'defend';

    const timeText =
        remaining > 0 ?
            `Due in ${humanizeDuration(remaining * 1000, { largest: 2, round: true })}`
        :   `Finished ${humanizeDuration(Math.abs(remaining) * 1000, { largest: 2, round: true })} ago`;

    const statusText =
        event.status === 'success' ? 'Won'
        : event.status === 'fail' ? 'Failed'
        : 'Active';

    return (
        <article
            className={`event-card ${isDefend ? 'event-card--defend' : 'event-card--attack'}`}
        >
            <div className="event-card-content">
                <div className="event-card-header">
                    <span className="event-card-meta">
                        {statusText} {event.type} Event
                    </span>
                    {faction && (
                        <img
                            src={faction.icon}
                            alt={faction.name}
                            className="event-card-faction-icon"
                        />
                    )}
                </div>
                <div className="event-card-time">{timeText}</div>
                {progress && <div className="event-card-progress-text">{progress}</div>}
                <div className="event-card-bar-track">
                    <div
                        className="event-card-bar-fill"
                        style={{ width: `${Math.min(100, percent)}%` }}
                    />
                </div>
                <div className="event-card-points">
                    {event.points} / {event.points_max} ({percent}%)
                </div>
            </div>
            <div className="event-card-accent" />
        </article>
    );
}
```

- [ ] **Step 2: Create Event.css**

```css
/* src/components/h1/Event/Event.css */
.event-card {
    display: grid;
    grid-template-columns: 1fr 4px;
    background: var(--color-surface-1);
    border: 1px solid var(--color-ghost-border);
}

.event-card-content {
    padding: 0.5rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.event-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.event-card-meta {
    font-family: var(--font-body);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-text);
}

.event-card-faction-icon {
    width: 20px;
    height: 20px;
}

.event-card-time {
    font-size: 0.6875rem;
    color: var(--color-text-muted);
}

.event-card-progress-text {
    font-size: 0.6875rem;
    color: var(--color-primary);
}

.event-card-bar-track {
    height: 6px;
    background: var(--color-danger);
    width: 100%;
}

.event-card-bar-fill {
    height: 100%;
    background: var(--color-primary);
}

.event-card-points {
    font-family: var(--font-mono, monospace);
    font-size: 0.5625rem;
    color: var(--color-text-muted);
}

/* Accent colors by event type */
.event-card--defend .event-card-accent {
    background: var(--color-danger);
}

.event-card--attack .event-card-accent {
    background: var(--color-primary);
}
```

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds. Note: Timeline.jsx still imports the old Event, so the old Timeline.css may have unused styles. That's fine — we'll clean up in the homepage rewrite.

- [ ] **Step 4: Commit**

```bash
git add src/components/h1/Event/
git commit -m "feat: redesign Event card with right-side accent and data card layout"
```

---

## Task 5: Alerts Banner Redesign

**Files:**

- Modify: `src/components/h1/Alerts/Alerts.jsx`
- Modify: `src/components/h1/Alerts/Alerts.css`

- [ ] **Step 1: Rewrite Alerts as full-width top banner**

Read the current file first. The new version renders a stacked list of active event alerts (not a horizontal carousel). Each alert is a full-width banner with red pulsing border.

```jsx
// src/components/h1/Alerts/Alerts.jsx
import './Alerts.css';
import factions from '@/enums/factions.mjs';
import { evaluateProgress } from '@/utils/evaluateProgress.mjs';
import humanizeDuration from 'humanize-duration';

export default function Alerts({ data }) {
    const active = data?.events
        ?.filter((e) => e.status === 'active')
        ?.sort((a, b) => a.end_time - b.end_time);

    if (!active?.length) return null;

    return (
        <div className="alerts">
            {active.map((event) => (
                <Alert key={event.event_id} event={event} />
            ))}
        </div>
    );
}

function Alert({ event }) {
    const remaining = event.end_time - Math.floor(Date.now() / 1000);
    const percent = ((event.points / event.points_max) * 100).toFixed(1);
    const faction = factions[event.enemy];
    const progress = evaluateProgress(event);
    const timeText =
        remaining > 0 ?
            `Due in ${humanizeDuration(remaining * 1000, { largest: 2, round: true })}`
        :   'Expired';

    return (
        <div className="alert-banner">
            <div className="alert-banner-header">
                <span className="alert-banner-type">Active {event.type} Event</span>
                {faction && (
                    <img
                        src={faction.icon}
                        alt={faction.name}
                        className="alert-banner-icon"
                    />
                )}
            </div>
            <div className="alert-banner-body">
                {faction?.name}: {event.points}/{event.points_max} ({percent}%)
                {progress && ` — ${progress}`}
            </div>
            <div className="alert-banner-time">{timeText}</div>
            <div className="alert-banner-bar">
                <div
                    className="alert-banner-bar-fill"
                    style={{ width: `${Math.min(100, percent)}%` }}
                />
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Rewrite Alerts.css**

```css
/* src/components/h1/Alerts/Alerts.css */
.alerts {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.alert-banner {
    background: rgba(119, 1, 1, 0.9);
    border: 2px solid var(--color-danger);
    padding: 0.5rem 0.75rem;
    animation: alert-pulse 2s infinite;
}

@keyframes alert-pulse {
    0%,
    100% {
        border-color: var(--color-danger);
    }
    50% {
        border-color: rgba(255, 0, 0, 0.3);
    }
}

.alert-banner-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.25rem;
}

.alert-banner-type {
    font-family: var(--font-body);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    color: white;
}

.alert-banner-icon {
    width: 20px;
    height: 20px;
}

.alert-banner-body {
    font-size: 0.8125rem;
    color: rgba(255, 255, 255, 0.85);
}

.alert-banner-time {
    font-size: 0.6875rem;
    color: rgba(255, 255, 255, 0.6);
    margin-top: 0.125rem;
}

.alert-banner-bar {
    height: 4px;
    background: rgba(255, 255, 255, 0.15);
    margin-top: 0.375rem;
}

.alert-banner-bar-fill {
    height: 100%;
    background: var(--color-primary);
}
```

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/h1/Alerts/
git commit -m "feat: redesign Alerts as full-width mobile banner"
```

---

## Task 6: Homepage Rewrite (Mobile-First)

**Files:**

- Modify: `src/app/page.jsx` (complete rewrite)

- [ ] **Step 1: Read the current homepage**

Read `src/app/page.jsx` fully to understand the data fetching and error handling patterns. Preserve: `getCampaign()` call, error/loading states, `computeMapState()`, `dynamic = 'force-dynamic'`.

- [ ] **Step 2: Rewrite homepage with mobile-first layout**

The new homepage is a client-server hybrid. The page itself is a server component that fetches data. It renders a client wrapper (`DashboardClient`) that manages the faction tab state.

```jsx
// src/app/page.jsx
import { getCampaign } from '@/db/queries/getCampaign';
import { computeMapState } from '@/utils/computeMapState';
import DashboardClient from '@/components/h1/Dashboard/DashboardClient';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
    const { data, error } = await getCampaign();

    if (error || !data) {
        return (
            <div className="gutters flex min-h-full w-full flex-col items-center justify-center py-12">
                <h1>Signal Lost</h1>
                <p>Unable to load campaign data. Please try again later.</p>
            </div>
        );
    }

    const mapState = computeMapState(data.live, data.events);

    return <DashboardClient data={data} mapState={mapState} />;
}
```

- [ ] **Step 3: Create DashboardClient component**

```jsx
// src/components/h1/Dashboard/DashboardClient.jsx
'use client';
import { useState } from 'react';
import Alerts from '@/components/h1/Alerts/Alerts';
import Galaxy from '@/components/h1/Galaxy/Galaxy';
import FactionTabs from '@/components/h1/FactionTabs/FactionTabs';
import StatGrid from '@/components/h1/StatGrid/StatGrid';
import Event from '@/components/h1/Event/Event';

export default function DashboardClient({ data, mapState }) {
    const [faction, setFaction] = useState('global');

    const events = data?.events?.sort((a, b) => b.start_time - a.start_time);

    return (
        <div className="gutters flex flex-col gap-4 pb-4">
            <Alerts data={data} />
            <Galaxy mapState={mapState} />
            <FactionTabs active={faction} onChange={setFaction} />
            <StatGrid live={data.live} faction={faction} />
            {events?.length > 0 && (
                <section>
                    <h2>Timeline</h2>
                    <div className="flex flex-col gap-2">
                        {events.map((event) => (
                            <Event key={event.event_id} event={event} />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
```

- [ ] **Step 4: Create DashboardClient directory**

```bash
mkdir -p src/components/h1/Dashboard
```

- [ ] **Step 5: Build and verify**

Run: `npm run build`
Expected: Build succeeds. Homepage renders with new mobile layout.

- [ ] **Step 6: Visual check**

Open Chrome DevTools, navigate to `localhost:3001`, set viewport to 390px width. Verify:

- Alert banner shows (if active events exist)
- Galaxy map renders full-width
- Faction tabs show Global/Bugs/Cyborgs/Illuminate
- Stats grid shows 2×2 cards
- Event timeline shows stacked event cards
- Bottom nav shows Live/History/About

- [ ] **Step 7: Commit**

```bash
git add src/app/page.jsx src/components/h1/Dashboard/
git commit -m "feat: rewrite homepage with mobile-first dashboard layout"
```

---

## Task 7: War History Mobile Layout

**Files:**

- Modify: `src/app/war/page.jsx`

- [ ] **Step 1: Read current war page**

Read `src/app/war/page.jsx` fully. Preserve: data fetching, season selector, WarOutcome, WarTimeline, URL params logic.

- [ ] **Step 2: Update layout classes for mobile**

The main changes are removing desktop-specific layout classes and ensuring single-column stacking. The key container class changes from `flex max-w-full flex-col gap-4` to include proper mobile padding.

Replace the main container class and adjust the season selector row. Keep all existing component rendering logic.

Key CSS class changes:

- Main container: `gutters flex flex-col gap-4 pb-4` (remove `overflow-hidden`)
- Season selector row: `flex flex-col gap-2` instead of `flex items-stretch gap-4`

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds. War history page renders with mobile-friendly layout.

- [ ] **Step 4: Commit**

```bash
git add src/app/war/page.jsx
git commit -m "feat: update war history page for mobile-first layout"
```

---

## Task 8: Header Slim-Down

**Files:**

- Modify: `src/components/layout/Header/Header.jsx`

- [ ] **Step 1: Read current header**

Read `src/components/layout/Header/Header.jsx` and `Navigation.jsx`. The goal is to slim the header on mobile — just logo + hamburger. The primary navigation is now handled by BottomNav.

- [ ] **Step 2: Hide primary nav links on mobile**

The Navigation component renders site links (Live, History, About) which are now redundant with BottomNav on mobile. Add `hidden sm:flex` to the site links container so they only show on tablet+.

This is a minimal change — just hide the duplicate nav on mobile, keep everything working on desktop.

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds. Header is slimmer on mobile, full nav shows on desktop.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Header/Header.jsx src/components/layout/Navigation/
git commit -m "feat: slim header on mobile, hide nav links (handled by BottomNav)"
```

---

## Task 9: Cleanup and Final Verification

**Files:**

- Possibly modify: old Timeline.jsx, old Stats component references

- [ ] **Step 1: Run full test suite**

Run: `npm run test:unit:run`
Expected: All 210+ tests pass.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds with no warnings.

- [ ] **Step 3: Visual verification at 390px viewport**

Using Chrome DevTools MCP, verify at 390px width:

1. Homepage: alerts → map → tabs → stats → events → bottom nav
2. War History: selector → badge → map → scrubber → event → bottom nav
3. About: content renders without overflow
4. Bottom nav highlights correct active tab on each page

- [ ] **Step 4: Run prettier**

Run: `npm run format`

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: Phase 6 cleanup and formatting"
```

---

## Verification Checklist

After all tasks are complete:

- [ ] `npm run build` passes
- [ ] `npm run test:unit:run` — all tests pass
- [ ] Homepage renders mobile-first layout at 390px
- [ ] Bottom nav shows on all pages with correct active state
- [ ] Faction tabs switch stats correctly (Global → Bugs → Cyborgs → Illuminate)
- [ ] Galaxy map renders full-width without overflow
- [ ] Alert banner shows when active events exist
- [ ] Event cards use right-side accent lines
- [ ] War history page works with season selector
- [ ] No horizontal scroll at any viewport width
