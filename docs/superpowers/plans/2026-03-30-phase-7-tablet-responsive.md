> **Note:** The Event Timeline section in DashboardClient (Task 7) was later moved to a standalone `TimelineSection` component in Phase 9. See Phase 9 timeline specs for current implementation.

# Phase 7: Tablet Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add portrait tablet (md: 768px) and landscape tablet (lg: 1024px) responsive layouts to the homepage dashboard.

**Architecture:** CSS-first approach — most changes are breakpoint additions to existing CSS files and Tailwind classes. The only structural JSX change is DashboardClient (sidebar layout at lg:) and Header/Navigation (nav links at lg:). No new components needed.

**Tech Stack:** Tailwind CSS v4, CSS custom properties, Next.js App Router

**Spec:** `docs/superpowers/specs/2026-03-30-phase-7-tablet-responsive-design.md`

---

### Task 1: Gutters — add md: breakpoint

**Files:**

- Modify: `src/app/layout.css:48-66`

- [ ] **Step 1: Add md: gutter value**

In `src/app/layout.css`, update all gutter utilities to include `md:mx-16` between `sm:mx-12` and `lg:mx-24`:

```css
.gutters {
    @apply mx-4 sm:mx-12 md:mx-16 lg:mx-24;
}
.gutters--left {
    @apply ml-4 sm:ml-12 md:ml-16 lg:ml-24;
}
.gutters--right {
    @apply mr-4 sm:mr-12 md:mr-16 lg:mr-24;
}

.p-gutters {
    @apply px-4 sm:px-12 md:px-16 lg:px-24;
}
.p-gutters--left {
    @apply pl-4 sm:pl-12 md:pl-16 lg:pl-24;
}
.p-gutters--right {
    @apply pr-4 sm:pr-12 md:pr-16 lg:pr-24;
}

.spacer {
    @apply w-4 sm:w-12 md:w-16 lg:w-24;
}
```

- [ ] **Step 2: Update main padding for lg:**

In `src/app/layout.jsx`, add `lg:pb-0` to the `<main>` element so padding is removed when BottomNav hides:

```jsx
<main id="main" className="flex min-h-screen w-screen flex-col pb-[48px] lg:pb-0">
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.css src/app/layout.jsx
git commit -m "feat: add md: gutter breakpoint and lg:pb-0 on main (#167)"
```

---

### Task 2: BottomNav — hide at lg:

**Files:**

- Modify: `src/components/layout/BottomNav/BottomNav.jsx:15`

- [ ] **Step 1: Add lg:hidden to nav**

In `src/components/layout/BottomNav/BottomNav.jsx`, add `lg:hidden` to the nav className:

```jsx
<nav className="bottom-nav lg:hidden">
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/BottomNav/BottomNav.jsx
git commit -m "feat: hide BottomNav at lg: breakpoint (#167)"
```

---

### Task 3: Header — add page navigation links at lg:

**Files:**

- Modify: `src/components/layout/Navigation/Navigation.jsx`
- Modify: `src/components/layout/BottomNav/BottomNav.css` (reuse `live-blink` keyframes)

The Header renders `<Logo />` and `<Navigation />`. The Navigation component currently has icon links (Status, GitHub) and user auth. We add page links (Live, History, About) that are hidden below lg:.

- [ ] **Step 1: Create HeaderNav component inside Navigation.jsx**

In `src/components/layout/Navigation/Navigation.jsx`, add a `HeaderNav` client component for the page links (needs `usePathname`). Add it to the existing Navigation component.

Replace the full file with:

```jsx
import './Navigation.css';
//auth
import { auth } from '@/auth';
//next
import Link from 'next/link';
import Image from 'next/image';
//
import { SignIn, SignOut } from '@/components/layout/Auth/Auth';
import HeaderNav from '@/components/layout/Navigation/HeaderNav';

export default async function Navigation() {
    const session = await auth();

    return (
        <nav className="z-50 flex items-center gap-3">
            <HeaderNav />
            <Link
                href="https://status.helldivers.bot"
                data-umami-event="header-status"
                title="Status"
                aria-label="Status"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="-4 -4 32 32"
                    style={{ width: '24px', height: '24px' }}
                >
                    <circle cx="12" cy="12" r="16" fill="#fff" />
                    <polyline
                        points="22 12 18 12 15 21 9 3 6 12 2 12"
                        fill="none"
                        stroke="#000"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </Link>
            <Link
                href="https://github.com/elfensky/helldivers1api"
                data-umami-event="header-github"
                aria-label="GitHub"
            >
                <svg
                    width="98"
                    height="96"
                    viewBox="0 0 98 96"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ width: '24px', height: '24px' }}
                >
                    <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"
                        fill="#fff"
                    />
                </svg>
            </Link>
            <div className="hidden sm:block">
                <User session={session} />
            </div>
        </nav>
    );
}

async function User({ session }) {
    if (!session || !session.user) {
        return <SignIn />;
    }

    let avatarUrl = '';
    if (session.user.image === null) {
        avatarUrl = getGravatarUrl(session.user.email);
    } else {
        avatarUrl = session.user.image;
    }

    return (
        <div className="flex items-center gap-4">
            <Link href="/dashboard" data-umami-event="header-dashboard">
                <Image
                    src={avatarUrl}
                    className="rounded-full"
                    alt={`${session.user.name ?? 'User'} avatar`}
                    width={32}
                    height={32}
                    priority={true}
                />
            </Link>
            <SignOut />
        </div>
    );
}
```

- [ ] **Step 2: Create HeaderNav client component**

Create `src/components/layout/Navigation/HeaderNav.jsx`:

```jsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
    { href: '/', label: 'Live', live: true },
    { href: '/war', label: 'History' },
    { href: '/about', label: 'About' },
];

export default function HeaderNav() {
    const pathname = usePathname();

    return (
        <div className="hidden items-center gap-4 lg:flex">
            {tabs.map(({ href, label, live }) => {
                const isActive =
                    href === '/' ? pathname === '/' : pathname.startsWith(href);
                return (
                    <Link
                        key={href}
                        href={href}
                        className={`header-nav-link ${isActive ? 'header-nav-link--active' : ''}`}
                    >
                        {live && <span className="bottom-nav-live">●</span>}
                        {label}
                    </Link>
                );
            })}
            <span className="header-nav-divider" />
        </div>
    );
}
```

- [ ] **Step 3: Add HeaderNav CSS**

Create `src/components/layout/Navigation/Navigation.css` (currently doesn't exist):

```css
.header-nav-link {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-family: var(--font-body);
    font-size: 0.8125rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
    text-decoration: none;
    padding-bottom: 2px;
    border-bottom: 2px solid transparent;
    transition: color 0.15s ease;
}

.header-nav-link:hover {
    color: var(--color-text);
}

.header-nav-link--active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
}

.header-nav-divider {
    width: 1px;
    height: 1rem;
    background: var(--color-surface-4);
}
```

Note: The `bottom-nav-live` class (red pulsing dot) is already defined in `BottomNav.css` and uses the `live-blink` keyframe. Since both BottomNav.css and this CSS are loaded globally, the class is available here without duplication.

- [ ] **Step 4: Add CSS import to Navigation.jsx**

Add `import './Navigation.css';` at the top of `Navigation.jsx` (it's already there from the existing file).

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/Navigation/
git commit -m "feat: add header page navigation links at lg: (#167)"
```

---

### Task 4: Alerts — horizontal scroll at md:

**Files:**

- Modify: `src/components/h1/Alerts/Alerts.css:1-5`

- [ ] **Step 1: Add md: horizontal scroll**

In `src/components/h1/Alerts/Alerts.css`, update the `.alerts` rule:

```css
.alerts {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

@media (min-width: 768px) {
    .alerts {
        flex-direction: row;
        overflow-x: auto;
    }
    .alert-banner {
        min-width: 220px;
        flex-shrink: 0;
    }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/h1/Alerts/Alerts.css
git commit -m "feat: alerts horizontal scroll at md: (#167)"
```

---

### Task 5: StatGrid — 4 columns at md:

**Files:**

- Modify: `src/components/h1/StatGrid/StatGrid.css:1-5`

- [ ] **Step 1: Add md: 4-column grid**

In `src/components/h1/StatGrid/StatGrid.css`, add a media query after the base `.stat-grid` rule:

```css
.stat-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
}

@media (min-width: 768px) {
    .stat-grid {
        grid-template-columns: 1fr 1fr 1fr 1fr;
    }
}
```

Note: At lg: when inside the sidebar, the sidebar's constrained width will naturally make 4 columns too narrow. Task 7 handles this by adding a `sidebar` context class that resets to 2 columns.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/h1/StatGrid/StatGrid.css
git commit -m "feat: StatGrid 4 columns at md: (#167)"
```

---

### Task 6: Galaxy Map — max-width at md:

**Files:**

- Modify: `src/components/h1/Galaxy/Galaxy.jsx:10-13`

- [ ] **Step 1: Add md: max-width and lg: reset**

In `src/components/h1/Galaxy/Galaxy.jsx`, update the section className to add max-width at md: and remove it at lg: (where the map fills the left column):

```jsx
<section
    id="galaxy"
    className="mx-4 mb-4 flex flex-grow-[4] flex-col items-center gap-4 sm:mx-0 md:mx-auto md:max-w-[480px] lg:mx-0 lg:max-w-none"
>
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/h1/Galaxy/Galaxy.jsx
git commit -m "feat: Galaxy map max-width at md:, reset at lg: (#167)"
```

---

### Task 7: DashboardClient — sidebar layout at lg:

This is the largest task. At lg:, the dashboard switches from single column to map+sidebar.

**Files:**

- Modify: `src/components/h1/Dashboard/DashboardClient.jsx`
- Modify: `src/components/h1/Dashboard/DashboardClient.css`
- Modify: `src/components/h1/StatGrid/StatGrid.css`

- [ ] **Step 1: Add sidebar CSS**

In `src/components/h1/Dashboard/DashboardClient.css`, add the lg: sidebar layout after existing rules:

```css
.sector-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
    width: 100%;
}

@media (min-width: 480px) {
    .sector-grid {
        grid-template-columns: 1fr 1fr 1fr;
    }
}

@media (min-width: 1024px) {
    .dashboard-main {
        display: flex;
        gap: 1rem;
    }
    .dashboard-map {
        flex: 1;
        min-width: 0;
    }
    .dashboard-sidebar {
        flex: 0 0 260px;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .sector-grid {
        grid-template-columns: 1fr;
    }
}
```

- [ ] **Step 2: Add sidebar StatGrid override**

In `src/components/h1/StatGrid/StatGrid.css`, add a rule so StatGrid inside the sidebar stays at 2 columns:

```css
@media (min-width: 1024px) {
    .dashboard-sidebar .stat-grid {
        grid-template-columns: 1fr 1fr;
    }
}
```

- [ ] **Step 3: Restructure DashboardClient JSX**

Update `src/components/h1/Dashboard/DashboardClient.jsx` to wrap map and sidebar content in layout divs. The key: at mobile/md the divs stack normally (no CSS effect), at lg: they become flex row.

Replace the return statement (keep all the logic above unchanged):

```jsx
return (
    <div className="gutters flex flex-col gap-4 pb-4">
        <h1 className="sr-only">Live Campaign</h1>
        <Alerts data={data} />
        {timeAgo && (
            <p
                className="font-mono text-xs"
                style={{ color: 'var(--color-text-muted)' }}
                suppressHydrationWarning
            >
                {timeAgo}
            </p>
        )}
        <div className="dashboard-main">
            <div className="dashboard-map">
                <Galaxy mapState={mapState} />
            </div>
            <div className="dashboard-sidebar">
                <ul className="sector-grid list-none p-0">
                    {factionIndices.map((index) => {
                        const campaignData = data.live?.find((l) => l.enemy === index);
                        const frontier = computeFrontier(campaignData, mapState[index]);
                        if (!frontier) return null;

                        const isDefending = frontier.event === 'active';
                        const label = isDefending ? 'DEFENDING' : 'CAPTURING';
                        const activeEvent =
                            isDefending ?
                                events?.find(
                                    (e) =>
                                        e.enemy === index &&
                                        e.type === 'defend' &&
                                        e.status === 'active',
                                )
                            :   null;

                        return (
                            <li key={`frontier-${index}`}>
                                <EventCard
                                    label={label}
                                    region={frontier.region}
                                    percent={frontier.percent}
                                    points={frontier.points}
                                    pointsMax={frontier.pointsMax}
                                    factionIndex={index}
                                    pace={
                                        activeEvent ? evaluateProgress(activeEvent) : null
                                    }
                                />
                            </li>
                        );
                    })}
                    {factionIndices.map((index) => {
                        const homeworld = mapState[index]?.[11];
                        if (homeworld?.event !== 'active') return null;
                        const attackEvent = events?.find(
                            (e) =>
                                e.enemy === index &&
                                e.type === 'attack' &&
                                e.status === 'active',
                        );

                        return (
                            <li key={`attack-${index}`}>
                                <EventCard
                                    label="ATTACKING"
                                    region={homeworld.region}
                                    percent={homeworld.percent}
                                    points={homeworld.points}
                                    pointsMax={homeworld.points_max}
                                    factionIndex={index}
                                    pace={
                                        attackEvent ? evaluateProgress(attackEvent) : null
                                    }
                                />
                            </li>
                        );
                    })}
                </ul>
                <section className="flex flex-col gap-2">
                    <h2>Stats</h2>
                    <FactionTabs active={faction} onChange={setFaction} />
                    <StatGrid live={data.live} faction={faction} />
                </section>
            </div>
        </div>
        {events?.length > 0 && (
            <section className="flex flex-col gap-2">
                <h2>Event Timeline</h2>
                <ul className="flex list-none flex-col gap-2 p-0">
                    {events.map((event) => (
                        <li key={event.event_id}>
                            <Event event={event} />
                        </li>
                    ))}
                </ul>
            </section>
        )}
    </div>
);
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Run unit tests**

Run: `npm run test:unit:run`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/h1/Dashboard/DashboardClient.jsx src/components/h1/Dashboard/DashboardClient.css src/components/h1/StatGrid/StatGrid.css
git commit -m "feat: dashboard sidebar layout at lg: breakpoint (#167)"
```

---

### Task 8: Final verification and format

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Run unit tests**

Run: `npm run test:unit:run`
Expected: All 222+ tests pass.

- [ ] **Step 3: Run formatter**

Run: `npm run format`

- [ ] **Step 4: Commit formatting if changed**

```bash
git add -A
git commit -m "style: format after Phase 7 tablet responsive (#167)"
```
