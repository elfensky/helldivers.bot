# Visual Regression Testing — Spec & Implementation Plan

> **For agentic workers:** steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Catch unintended visual changes in the dashboard UI by screenshotting client components mounted with fixed fixture data, comparing against committed baseline PNGs.

**Architecture:** Vitest 4 Browser Mode (chromium via Playwright) renders real client components — no Next server, no database, no SaaS. `DashboardClient` reads all its data from `LiveDataContext`, so wrapping it in a provider with a static payload gives a full dashboard render from one fixture. Baselines are generated and compared inside the official Playwright Docker image so the PNGs are reproducible across machines.

**Tech Stack:** Vitest 4 browser mode, `@vitest/browser` + `@vitest/browser-playwright`, `playwright` 1.62.1, `@testing-library/react` (already installed), Docker.

## Spec

### What this covers

| Target | Why | Screenshots |
| --- | --- | --- |
| `DashboardClient` | Composite: season heading, region cards, event cards, stat grid. The highest-value single render in the app. | desktop 1280×800, mobile 390×844 |
| `EventCard` | Densest leaf component (progress bar, frontier, pace, ETA variants). | desktop, 2 states (attack active, defend active) |
| `StatGrid` | Grid layout + stat card accent lines; layout regressions are invisible to RTL assertions. | desktop |

### What this does NOT cover (deliberate)

- **The RSC shell** — `layout.jsx`, `HeaderNav`, `BottomNav`, fonts loaded via `next/font`. Screenshotting those needs a running Next server plus a seeded database. Out of scope; that shell is static and rarely changes.
- **Galaxy map SVG** — rendered inside `HomeClient`, not `DashboardClient`. Can be added later as its own target once the pipeline is proven.
- **CI enforcement** — this branch ships local-only visual tests. Wiring a CI job comes as a follow-up issue (see § Follow-up).

### Determinism requirements

Every source of per-run variance must be pinned, or baselines flake:

1. **Clock** — `vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime(FIXED_NOW)`. Only `Date` is faked; `setTimeout`/`requestAnimationFrame` stay real so React renders normally. Fixes `formatTimeAgo`, countdowns, and every `Date.now()`-derived ETA.
2. **Animations** — a global stylesheet injected by the setup file sets `animation: none !important; transition: none !important; caret-color: transparent !important` on `*`, killing CSS transitions, pulse delays, and the `react-slot-counter` roll.
3. **Viewport** — set explicitly per test via `page.viewport(w, h)`; never inherited.
4. **Data** — fixtures are literal objects, never derived from the live API or the database.
5. **Platform** — baselines are generated in `mcr.microsoft.com/playwright:v1.62.1-noble`. Font rendering and antialiasing differ between macOS and Linux, so a macOS-generated baseline would fail everywhere else.

### Non-requirements

- No Percy, no Chromatic, no Storybook — Vitest ships the matcher, and this repo has no Storybook.
- No new component-level `data-testid` in production code. Visual tests wrap the component under test in their own `<div data-testid="visual-root">`.
- Visual tests do NOT run as part of `npm run test:unit`, `npm run lint`, or `npm run build`. They are a separate opt-in script (Docker is a hard dependency for them).

### Global Constraints

- `@vitest/browser` and `@vitest/browser-playwright` must be pinned to the same minor as the installed `vitest` (`^4.1.6` → 4.1.x).
- The `playwright` npm version and the Docker image tag must match exactly (`1.62.1` ↔ `v1.62.1-noble`). Mismatched versions produce a "browser not found" failure inside the container.
- Visual test files live in `src/__tests__/visual/` and are named `*.visual.test.jsx`. They sit outside `src/__tests__/unit/`, so `_meta/mirrorTree.test.mjs` does not apply to them (it only walks `unit/`).
- Baselines are committed. Failure artifacts (`*-actual.png`, `*-diff.png`) are gitignored.
- Comparator: `pixelmatch` with `allowedMismatchedPixelRatio: 0.01` — tolerates sub-pixel antialiasing noise, still catches a moved element.
- Follow repo conventions: 4-space indent, single quotes, Prettier via `npm run lint:fix`.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `vitest.visual.config.mjs` | Browser-mode config: chromium instance, `include` glob, screenshot path + comparator defaults, `@` alias. |
| `src/__tests__/visual/setup.mjs` | Per-file setup: imports `layout.css`, injects the animation-kill stylesheet, freezes `Date`, cleans up DOM between tests. |
| `src/__tests__/visual/fixtures.mjs` | The live-data fixture (`liveStore()`), map state, and event builders. Single source of fixture truth for all visual tests. |
| `src/__tests__/visual/renderVisual.jsx` | `renderVisual(ui)` — wraps children in `LiveDataContext.Provider` + `<div data-testid="visual-root">`, returns the locator to screenshot. |
| `src/__tests__/visual/stubs/nextImage.jsx` | Plain `<img>` stand-in for `next/image` (aliased in the visual config). Next's loader emits `/_next/image?url=…` URLs that only a Next server can serve. |
| `src/__tests__/visual/stubs/nextLink.jsx` | Plain `<a>` stand-in for `next/link`, which needs Next's router context. |
| `src/__tests__/visual/EventCard.visual.test.jsx` | EventCard baselines. |
| `src/__tests__/visual/StatGrid.visual.test.jsx` | StatGrid baseline. |
| `src/__tests__/visual/DashboardClient.visual.test.jsx` | Full-dashboard baselines (desktop + mobile). |
| `src/__tests__/visual/README.md` | How to run, how to update baselines, why Docker. |
| `package.json` | `test:visual`, `test:visual:update` scripts + 3 devDependencies. |
| `.gitignore` | Ignore `*-actual.png` / `*-diff.png`. |
| `CHANGELOG.md` | `## Unreleased` entry. |

---

### Task 1: Pipeline proof — config, setup, and one EventCard baseline

Ships the whole mechanism end to end with a single screenshot. If this task
works, the rest is repetition.

**Files:**

- Create: `vitest.visual.config.mjs`
- Create: `src/__tests__/visual/setup.mjs`
- Create: `src/__tests__/visual/fixtures.mjs`
- Create: `src/__tests__/visual/renderVisual.jsx`
- Create: `src/__tests__/visual/EventCard.visual.test.jsx`
- Modify: `package.json` (devDependencies + scripts)
- Modify: `.gitignore`

**Interfaces produced (later tasks depend on these exact names):**

- `fixtures.mjs` exports `FIXED_NOW` (number, unix ms), `makeEvent(overrides)`, `makeMapState()`, `liveStore(overrides)`.
- `renderVisual.jsx` exports `renderVisual(ui, { store } = {})` returning `{ root }` where `root` is a Vitest browser `Locator` for `[data-testid="visual-root"]`.

- [ ] **Step 1: Install dependencies**

```bash
npm install -D @vitest/browser@^4.1.6 @vitest/browser-playwright@^4.1.6 playwright@1.62.1
```

- [ ] **Step 2: Write `vitest.visual.config.mjs`**

```js
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        include: ['src/__tests__/visual/**/*.visual.{test,spec}.{js,jsx,mjs}'],
        setupFiles: ['./src/__tests__/visual/setup.mjs'],
        browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
            expect: {
                toMatchScreenshot: {
                    comparatorName: 'pixelmatch',
                    comparatorOptions: { allowedMismatchedPixelRatio: 0.01 },
                },
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(import.meta.dirname, './src'),
            '@test-utils': path.resolve(import.meta.dirname, './src/__tests__/utils'),
            // Vite is not a Next server: next/image emits /_next/image?url=…
            // srcSets nothing can serve, and next/link needs router context.
            'next/image': path.resolve(
                import.meta.dirname,
                './src/__tests__/visual/stubs/nextImage.jsx',
            ),
            'next/link': path.resolve(
                import.meta.dirname,
                './src/__tests__/visual/stubs/nextLink.jsx',
            ),
        },
    },
});
```

Static assets resolve because Vite serves `public/` at the web root by default,
so `/icons/faction0.webp` and the local `@font-face` files load exactly as they
do in the app.

- [ ] **Step 3: Write `src/__tests__/visual/setup.mjs`**

```js
// Visual-test setup: everything that would otherwise make a screenshot
// differ between two runs of identical code.
import '@/app/layout.css';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { FIXED_NOW } from './fixtures.mjs';

// Animations and transitions are the main source of screenshot flake: a
// capture can land mid-transition. Killing them globally is cheaper and more
// reliable than waiting for each one to settle.
const style = document.createElement('style');
style.textContent = `*, *::before, *::after {
    animation: none !important;
    transition: none !important;
    caret-color: transparent !important;
}`;
document.head.appendChild(style);

beforeEach(() => {
    // Only Date is faked — setTimeout/rAF stay real so React can render.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
    cleanup();
    vi.useRealTimers();
});
```

- [ ] **Step 4: Write `src/__tests__/visual/fixtures.mjs`**

Fixture shapes are copied from the existing unit test
`src/__tests__/unit/features/dashboard/DashboardClient.test.jsx` — read it
first and mirror the `useLiveDataContext` return value it builds.

```js
/** Fixed wall clock for every visual test. Any Date-derived string renders
 *  identically on every run because "now" never moves. */
export const FIXED_NOW = Date.UTC(2026, 0, 15, 12, 0, 0);

const HOUR = 3600;
const NOW_S = Math.floor(FIXED_NOW / 1000);

export function makeEvent(overrides = {}) {
    return {
        type: 'attack',
        start_time: NOW_S - 6 * HOUR,
        end_time: NOW_S + 18 * HOUR,
        region: 3,
        enemy: 0,
        points: 1_800_000,
        points_max: 5_000_000,
        status: 'active',
        ...overrides,
    };
}

/** One faction's 0-11 region map, mirroring makeDashboardMap() in the unit test. */
function makeFactionMap(overrides = {}) {
    const map = {};
    for (let r = 0; r <= 11; r++) {
        map[r] = { region: `Region ${r}`, status: 'lost', event: 'idle', percent: 0 };
    }
    for (const [key, val] of Object.entries(overrides)) {
        map[Number(key)] = { ...map[Number(key)], ...val };
    }
    return map;
}

/** mapState keyed 0-2 by faction, 3 = Super Earth. */
export function makeMapState() {
    return {
        0: makeFactionMap({ 3: { status: 'active', event: 'attack', percent: 36 } }),
        1: makeFactionMap(),
        2: makeFactionMap(),
        3: makeFactionMap(),
    };
}

/** One h1_statistic row as StatGrid reads it. */
export function makeStatRow(enemy, overrides = {}) {
    return {
        enemy,
        players: 4_000 + enemy * 137,
        kills: 300_000_000 + enemy * 11_000_000,
        deaths: 9_000_000 + enemy * 250_000,
        accidentals: 700_000 + enemy * 30_000,
        successful_missions: 2_400_000 + enemy * 90_000,
        missions: 3_000_000 + enemy * 100_000,
        first_seen: NOW_S - 30 * 24 * HOUR,
        ...overrides,
    };
}

export function liveStore(overrides = {}) {
    return {
        data: {
            status: [
                { enemy: 0, points: 1_000_000, points_max: 5_000_000, status: 'active' },
                { enemy: 1, points: 0, points_max: 5_000_000, status: 'active' },
                { enemy: 2, points: 0, points_max: 5_000_000, status: 'active' },
            ],
            events: [],
            last_updated: '2026-01-15',
            season: 42,
        },
        mapState: makeMapState(),
        status: 'live',
        prevData: null,
        isLeader: true,
        ...overrides,
    };
}
```

- [ ] **Step 5: Write `src/__tests__/visual/renderVisual.jsx`**

```jsx
import { render } from '@testing-library/react';
import { page } from 'vitest/browser';
import { LiveDataContext } from '@/shared/providers/LiveDataContext.mjs';
import { liveStore } from './fixtures.mjs';

/**
 * Mount `ui` inside a live-data provider and a stable wrapper element.
 * The wrapper — not the component — is what gets screenshotted, so no
 * production component needs a test id.
 */
export function renderVisual(ui, { store = liveStore() } = {}) {
    render(
        <LiveDataContext.Provider value={store}>
            <div data-testid="visual-root">{ui}</div>
        </LiveDataContext.Provider>,
    );
    return { root: page.getByTestId('visual-root') };
}
```

- [ ] **Step 6: Write the two `next/*` stubs**

```jsx
// src/__tests__/visual/stubs/nextImage.jsx
export default function Image({ src, alt = '', width, height, ...rest }) {
    return <img src={src} alt={alt} width={width} height={height} {...rest} />;
}
```

```jsx
// src/__tests__/visual/stubs/nextLink.jsx
export default function Link({ href, children, ...rest }) {
    return (
        <a href={href} {...rest}>
            {children}
        </a>
    );
}
```

Drop non-DOM Next props (`priority`, `fill`, `quality`, `unoptimized`,
`prefetch`) if React warns about unknown attributes.

- [ ] **Step 7: Write the EventCard visual test**

Props come from `EventCard`'s destructure in
`src/features/galaxy/EventCard.jsx`: `action`, `region`, `percent`, `points`,
`pointsMax`, `factionIndex`, `pace`, `endTime`, `barLabel`, `pulseDelay`,
`view`, `factionMap`, `etaForecast`, `eventEta`.

```jsx
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';
import EventCard from '@/features/galaxy/EventCard';
import { renderVisual } from './renderVisual.jsx';
import { FIXED_NOW, makeMapState } from './fixtures.mjs';

const NOW_S = Math.floor(FIXED_NOW / 1000);

test('attack event card', async () => {
    await page.viewport(420, 640);
    const { root } = renderVisual(
        <EventCard
            action="attacking"
            region="Region 3"
            percent={36}
            points={1_800_000}
            pointsMax={5_000_000}
            factionIndex={0}
            pace={{ status: 'ahead', delta: 12 }}
            endTime={NOW_S + 18 * 3600}
            barLabel="Liberation"
            view="sector"
            factionMap={makeMapState()[0]}
            eventEta={{
                mode: 'verdict',
                etaHours: 9,
                remainingHours: 18,
                onTrack: true,
                stalled: false,
            }}
        />,
    );
    await expect.element(root).toMatchScreenshot('event-card-attack');
});

test('defend event card', async () => {
    await page.viewport(420, 640);
    const { root } = renderVisual(
        <EventCard
            action="defending"
            region="Region 7"
            percent={72}
            points={3_600_000}
            pointsMax={5_000_000}
            factionIndex={2}
            pace={{ status: 'behind', delta: -8 }}
            endTime={NOW_S + 4 * 3600}
            barLabel="Defense"
            view="sector"
            factionMap={makeMapState()[2]}
            eventEta={{
                mode: 'verdict',
                etaHours: null,
                remainingHours: 4,
                onTrack: false,
                stalled: true,
            }}
        />,
    );
    await expect.element(root).toMatchScreenshot('event-card-defend');
});
```

- [ ] **Step 8: Add scripts to `package.json`**

```json
"test:visual": "docker run --rm -v \"$PWD\":/work -w /work -v hd1-visual-modules:/work/node_modules mcr.microsoft.com/playwright:v1.62.1-noble sh -c '[ -d node_modules/vitest ] || npm ci; npx vitest run --config vitest.visual.config.mjs'",
"test:visual:update": "npm run test:visual -- --update"
```

`node_modules` lives in a named Docker volume, not the bind mount — the host's
macOS binaries (esbuild, rollup, lightningcss) cannot execute inside a Linux
container. The `[ -d node_modules/vitest ]` guard keeps `npm ci` to first run
only.

- [ ] **Step 9: Add failure artifacts to `.gitignore`**

```gitignore
# Visual regression failure artifacts (baselines ARE committed)
**/__screenshots__/**/*-actual.png
**/__screenshots__/**/*-diff.png
```

- [ ] **Step 10: Generate the baselines and verify they are stable**

```bash
npm run test:visual:update   # writes src/__tests__/visual/__screenshots__/...
npm run test:visual          # must PASS against the baseline just written
npm run test:visual          # run twice — a flaky setup fails on the second run
```

Expected: first run writes PNG(s), the two following runs both report pass.
If run 2 or 3 fails, the cause is un-pinned nondeterminism — fix the setup
file, do not raise the pixel tolerance.

- [ ] **Step 11: Commit**

```bash
npm run lint:fix
git add -A
git commit -m "test(visual): vitest browser-mode visual regression pipeline + EventCard baselines"
```

---

### Task 2: StatGrid and full-dashboard baselines

**Files:**

- Create: `src/__tests__/visual/StatGrid.visual.test.jsx`
- Create: `src/__tests__/visual/DashboardClient.visual.test.jsx`

**Interfaces consumed:** `renderVisual(ui, { store })`, `liveStore(overrides)`, `makeEvent(overrides)`, `makeMapState()` from Task 1.

- [ ] **Step 1: Write the StatGrid visual test**

`StatGrid` reads these fields off each `live` row: `enemy`, `players`, `kills`,
`deaths`, `accidentals`, `successful_missions`, `missions`, `first_seen`. Add
`makeStatRow(enemy, overrides)` to `fixtures.mjs`, then:

```jsx
import { expect, test } from 'vitest';
import { page } from 'vitest/browser';
import StatGrid from '@/features/stats/StatGrid';
import { renderVisual } from './renderVisual.jsx';
import { FIXED_NOW, makeEvent, makeStatRow } from './fixtures.mjs';

const NOW_S = Math.floor(FIXED_NOW / 1000);
const WAR_START = NOW_S - 30 * 24 * 3600;

const live = [makeStatRow(0), makeStatRow(1), makeStatRow(2)];
const events = [
    makeEvent({ status: 'success', enemy: 0 }),
    makeEvent({ status: 'fail', enemy: 1 }),
];

test('stat grid — global', async () => {
    await page.viewport(1280, 800);
    const { root } = renderVisual(
        <StatGrid
            live={live}
            faction="global"
            events={events}
            playersAvg24h={{ global: 12_000 }}
            killsTrend={{ global: { last24h: 900_000_000, prev24h: 850_000_000 } }}
            seasonDuration={30 * 24 * 3600}
            warStart={WAR_START}
        />,
    );
    await expect.element(root).toMatchScreenshot('stat-grid-global');
});
```

`playersAvg24h` and `killsTrend` shapes must match what
`playersDeltaSubtitle` / `killsTrendSubtitle` in `StatGrid.jsx` destructure —
read those two helpers and adjust the fixture if they differ from the guess
above.

- [ ] **Step 2: Write the DashboardClient visual tests**

Two screenshots from one fixture, differing only in viewport.

All four `DashboardClient` props are optional (`initialFaction`,
`initialRegionsView`, `playersAvg24h`, `killsTrend`); pass the first two
explicitly so the render does not depend on `localStorage` state.

```jsx
import { beforeEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import DashboardClient from '@/features/dashboard/DashboardClient';
import { renderVisual } from './renderVisual.jsx';
import { liveStore, makeEvent } from './fixtures.mjs';

const store = liveStore({
    data: {
        ...liveStore().data,
        events: [makeEvent(), makeEvent({ type: 'defend', enemy: 2, region: 7 })],
    },
});

beforeEach(() => localStorage.clear());

test('dashboard — desktop', async () => {
    await page.viewport(1280, 800);
    const { root } = renderVisual(
        <DashboardClient initialFaction="global" initialRegionsView="sector" />,
        { store },
    );
    await expect.element(root).toMatchScreenshot('dashboard-desktop');
});

test('dashboard — mobile', async () => {
    await page.viewport(390, 844);
    const { root } = renderVisual(
        <DashboardClient initialFaction="global" initialRegionsView="sector" />,
        { store },
    );
    await expect.element(root).toMatchScreenshot('dashboard-mobile');
});
```

`DashboardClient` calls `attackForecast` / `sectorForecast` / `eventForecast`,
which need `data.snapshots` and a calibrated model. With these fixtures they
return their `{mode:'hidden'}` no-data result — that is a legitimate UI state
and does not need mocking. Do NOT copy the sentinel `vi.mock` stubs from the
unit test: a visual baseline should capture real rendering, not a mock's
output.

`DashboardClient` persists faction/regions-view choices through
`usePersistedState` → `localStorage`. Clear it in a `beforeEach` in this file
so a previous test's tab selection cannot leak into the screenshot:

```js
beforeEach(() => localStorage.clear());
```

- [ ] **Step 3: Generate baselines, then verify stability**

```bash
npm run test:visual:update
npm run test:visual
npm run test:visual
```

Expected: 5 baselines total (2 EventCard, 1 StatGrid, 2 dashboard), two clean
consecutive passes.

- [ ] **Step 4: Deliberately break a style and confirm the test catches it**

Temporarily change a padding value in `src/features/stats/StatGrid.jsx` (or its
CSS), run `npm run test:visual`, confirm FAIL with a diff PNG, then revert.
A visual test that has never failed is not known to work.

- [ ] **Step 5: Commit**

```bash
npm run lint:fix
git add -A
git commit -m "test(visual): StatGrid and full-dashboard baselines"
```

---

### Task 3: Documentation and changelog

**Files:**

- Create: `src/__tests__/visual/README.md`
- Modify: `src/app/docs/testing/page.mdx` (add a "Visual regression" section)
- Modify: `CHANGELOG.md`
- Modify: `CLAUDE.md` (one line under § Working Style listing the new script)

- [ ] **Step 1: Write `src/__tests__/visual/README.md`**

Cover: what runs (`npm run test:visual`), how to update a baseline
(`npm run test:visual:update`), why Docker is mandatory (platform-dependent
font rendering), that baselines are committed and failure artifacts are not,
and what is out of scope (RSC shell, galaxy map, CI).

- [ ] **Step 2: Add a section to the testing docs page**

Read the existing page first and match its component/heading conventions.
Three or four sentences plus the two commands — this page is user-facing.

- [ ] **Step 3: Add the CHANGELOG entry under `## Unreleased`**

```markdown
### Added

- Visual regression tests: Vitest browser-mode screenshots of `DashboardClient`, `EventCard`, and `StatGrid`, compared against committed baselines generated in the Playwright Docker image (`npm run test:visual`).
```

- [ ] **Step 4: Run the full verification chain**

```bash
npm run lint && npm run typecheck && npm run test:unit && npm run build
```

All four must pass. `test:unit` must be unaffected — the visual glob is not in
`vitest.config.mjs`'s `include`, and `src/__tests__/visual/` is outside
`unit/`, so `_meta/mirrorTree.test.mjs` ignores it.

- [ ] **Step 5: Commit**

```bash
npm run lint:fix
git add -A
git commit -m "docs(visual): document visual regression workflow"
```

---

## Follow-up (not this branch)

- **CI job** — run `vitest --config vitest.visual.config.mjs` in a GitHub Actions job whose `container:` is the same `mcr.microsoft.com/playwright:v1.62.1-noble` image, so rendering matches the local baselines exactly. A different base image (e.g. bare `ubuntu-latest` + `playwright install`) will render fonts differently and fail against these baselines.
- **Galaxy map SVG** — add `HomeClient`/`Galaxy` once the map's mapState fixture is worth maintaining.
- **More states per component** — defeated faction, won/lost events, offline connection status.
