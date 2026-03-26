# Dynamic OG Image Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a dynamic 1200x630 PNG showing the Galaxy map with current war progress for Discord embeds.

**Architecture:** Extract SVG path data from `Map.jsx` into a shared `mapPaths.mjs` file. Refactor `Map.jsx` to consume it. Rewrite the `/api/og` route to fetch live war data, compute map state, build the galaxy map as an SVG string (encoded as a base64 data URI `<img>`), and render an `ImageResponse` with faction stats sidebar.

**Tech Stack:** Next.js `ImageResponse` (Satori/`@vercel/og`), existing `getCampaign` query, existing `computeMapState` utility.

**Key constraint:** Satori does NOT support inline `<svg>`/`<path>`/`<circle>` elements. The map SVG must be built as a string, base64-encoded, and embedded via `<img src="data:image/svg+xml;base64,...">`.

---

### Task 1: Extract SVG path data into shared file

**Files:**
- Create: `src/enums/mapPaths.mjs`

This file contains ALL SVG path `d` attributes extracted from `Map.jsx`. Each faction has an array of `{ id, sector, d }` objects for sectors 1-11. Super Earth has a circle definition. The `sector` field is a number to avoid string parsing.

- [ ] **Step 1: Create `src/enums/mapPaths.mjs`**

```js
// src/enums/mapPaths.mjs
//
// Shared SVG path geometry for the Galaxy map.
// Consumed by both Map.jsx (CSS class styling) and the OG image route (inline styling).
// viewBox matches the original SVG exported from Illustrator.

export const viewBox = '0 0 806.93 868.81';

export const bugPaths = [
    { id: '0-1', sector: 1, d: 'M433.74,403.35l30.16,10.96c1.04-2.84,...' },
    // ... (all 11 bug paths — extract from Map.jsx <g id="bugs"> group)
    // The implementer MUST extract every path `d` value from the <g id="bugs"> group in Map.jsx.
    // There are exactly 11 paths (sectors 1-11). Copy each `d` attribute verbatim.
];

export const cyborgPaths = [
    // Extract all 11 paths from <g id="cyborgs"> group in Map.jsx
    // Same { id, sector, d } structure. IDs are '1-1' through '1-11'.
];

export const illuminatePaths = [
    // Extract all 11 paths from <g id="illuminate"> group in Map.jsx
    // Same { id, sector, d } structure. IDs are '2-1' through '2-11'.
];

export const superEarth = {
    circle: { id: '3-0', cx: 402.72, cy: 392.12, r: 27 },
};

// Faction icon positions (for Map.jsx, not used in OG route)
export const factionIcons = [
    { href: '/icons/faction0.webp', x: 710, y: 120, width: 100, height: 100 },
    { href: '/icons/faction1.webp', x: 0, y: 120, width: 100, height: 100 },
    { href: '/icons/faction2.webp', x: 354, y: 765, width: 100, height: 100 },
];

export const superEarthIcon = {
    href: '/icons/superearth.webp', x: 352, y: 334, width: 100, height: 100,
};
```

**Important:** The implementer must read the FULL `Map.jsx` file and extract every SVG `<path d="...">` attribute from each faction group. There are exactly 11 paths per faction (sectors 1-11) plus the Super Earth circle. Copy each `d` value character-for-character.

- [ ] **Step 2: Verify the file has correct counts**

Run: `node -e "import('./src/enums/mapPaths.mjs').then(m => console.log('bugs:', m.bugPaths.length, 'cyborgs:', m.cyborgPaths.length, 'illuminate:', m.illuminatePaths.length))"`

Expected: `bugs: 11 cyborgs: 11 illuminate: 11`

- [ ] **Step 3: Commit**

```bash
git add src/enums/mapPaths.mjs
git commit -m "feat: extract SVG path geometry into shared mapPaths.mjs"
```

---

### Task 2: Refactor Map.jsx to use shared paths

**Files:**
- Modify: `src/components/h1/Galaxy/Map.jsx`
- Reference: `src/enums/mapPaths.mjs` (created in Task 1)

Replace hardcoded `<path d="...">` elements with `.map()` over the imported arrays. Every visual detail must remain identical.

- [ ] **Step 1: Refactor Map.jsx**

Replace the contents of `Map.jsx` with a version that imports from `mapPaths.mjs` and maps over the arrays. The key pattern for each faction group:

```jsx
import { viewBox, bugPaths, cyborgPaths, illuminatePaths, superEarth, factionIcons, superEarthIcon } from '@/enums/mapPaths.mjs';

// Inside the <g id="bugs"> group, replace all 11 hardcoded <path> elements with:
{bugPaths.map((path) => (
    <path
        key={path.id}
        id={path.id}
        data-name={String(path.sector)}
        data-faction="bugs"
        className={
            path.sector === 11
                ? 'sector ' + map[bugs][11].status
                : 'sector ' + map[bugs][path.sector].status + ' ' + map[bugs][path.sector].event
        }
        d={path.d}
    />
))}
<image
    href={factionIcons[0].href}
    className="pointer-events-none"
    x={factionIcons[0].x}
    y={factionIcons[0].y}
    width={factionIcons[0].width}
    height={factionIcons[0].height}
/>
```

Apply the same pattern for cyborgs (faction index 1, `cyborgPaths`, `factionIcons[1]`) and illuminate (faction index 2, `illuminatePaths`, `factionIcons[2]`).

For Super Earth:
```jsx
<g id="superearth">
    <circle
        id={superEarth.circle.id}
        data-name="0"
        className={'sector captured ' + map[superearth][0].status}
        cx={superEarth.circle.cx}
        cy={superEarth.circle.cy}
        r={superEarth.circle.r}
    />
    <image
        className="pointer-events-none"
        href={superEarthIcon.href}
        x={superEarthIcon.x}
        y={superEarthIcon.y}
        width={superEarthIcon.width}
        height={superEarthIcon.height}
    />
</g>
```

Also update the `viewBox` on the `<svg>` element to use the imported constant.

Note: Keep the `<defs>` block (filters) and the `import './Map.css'` — those stay as-is. Delete the unused `generateScore` function at the bottom of the file.

- [ ] **Step 2: Visual verification**

Ask the user to start the dev server. Open `http://localhost:3000` and compare the Galaxy map. It must look identical to before the refactor. Check that:
- All 3 faction sectors render with correct colors
- Sector statuses (captured/lost/in_progress) display correctly
- Faction icons appear at correct positions
- Super Earth circle renders at center

- [ ] **Step 3: Run build and tests**

Run: `npm run build && npm run test:unit:run`

Expected: Both pass. No changes to behavior.

- [ ] **Step 4: Commit**

```bash
git add src/components/h1/Galaxy/Map.jsx
git commit -m "refactor: Map.jsx imports SVG paths from shared mapPaths.mjs"
```

---

### Task 3: Extract getWarOutcome into a shared utility

**Files:**
- Create: `src/utils/getWarOutcome.mjs`
- Modify: `src/components/h1/War/War.jsx` (import from new location)
- Test: `src/__tests__/unit/utils/getWarOutcome.test.mjs`

The `getWarOutcome` function is currently defined inside `War.jsx` (a client component). The OG route needs it too. Extract it into a shared utility. **Copy verbatim** — the decision tree has subtle branches that must be preserved exactly.

- [ ] **Step 1: Write the test**

```js
// src/__tests__/unit/utils/getWarOutcome.test.mjs
import { getWarOutcome } from '@/utils/getWarOutcome.mjs';

describe('getWarOutcome', () => {
    test('returns null when no data', () => {
        expect(getWarOutcome({})).toBeNull();
        expect(getWarOutcome({ snapshots: [], events: [], live: [] })).toBeNull();
    });

    test('returns victory when all 3 live factions defeated (early return)', () => {
        const data = {
            live: [
                { status: 'defeated' },
                { status: 'defeated' },
                { status: 'defeated' },
            ],
            snapshots: [],
            events: [],
        };
        const result = getWarOutcome(data);
        expect(result.outcome).toBe('victory');
        expect(result.reason).toBe('All enemy factions have been defeated.');
    });

    test('returns victory when all 3 homeworlds captured via events (no defeat signal)', () => {
        const data = {
            live: [{ status: 'active' }, { status: 'active' }, { status: 'active' }],
            snapshots: [],
            events: [
                { type: 'attack', status: 'success', enemy: 0 },
                { type: 'attack', status: 'success', enemy: 1 },
                { type: 'attack', status: 'success', enemy: 2 },
            ],
        };
        const result = getWarOutcome(data);
        expect(result.outcome).toBe('victory');
    });

    test('returns victory when snapshot shows all 3 defeated', () => {
        const data = {
            live: [{ status: 'active' }, { status: 'active' }, { status: 'active' }],
            snapshots: [
                {
                    data: JSON.stringify([
                        { status: 'defeated' },
                        { status: 'defeated' },
                        { status: 'defeated' },
                    ]),
                },
            ],
            events: [],
        };
        const result = getWarOutcome(data);
        expect(result.outcome).toBe('victory');
    });

    test('returns defeat when last region-0 defend event failed', () => {
        const data = {
            live: [{ status: 'active' }, { status: 'active' }, { status: 'active' }],
            snapshots: [],
            events: [
                { type: 'defend', region: 0, status: 'fail', end_time: 100 },
            ],
        };
        const result = getWarOutcome(data);
        expect(result.outcome).toBe('defeat');
    });

    test('defeat signal overrides victory signal (conflicting signals)', () => {
        const data = {
            live: [{ status: 'active' }, { status: 'active' }, { status: 'active' }],
            snapshots: [],
            events: [
                { type: 'attack', status: 'success', enemy: 0 },
                { type: 'attack', status: 'success', enemy: 1 },
                { type: 'attack', status: 'success', enemy: 2 },
                { type: 'defend', region: 0, status: 'fail', end_time: 200 },
            ],
        };
        const result = getWarOutcome(data);
        expect(result.outcome).toBe('defeat');
    });

    test('returns defeat when no victory signal and data exists (war lost without homeworlds)', () => {
        const data = {
            live: [{ status: 'active' }, { status: 'active' }, { status: 'active' }],
            snapshots: [],
            events: [
                { type: 'attack', status: 'fail', enemy: 0 },
            ],
        };
        const result = getWarOutcome(data);
        expect(result.outcome).toBe('defeat');
    });

    test('returns null when only empty arrays (no signals, no data)', () => {
        const data = {
            snapshots: [],
            events: [],
            live: [],
        };
        expect(getWarOutcome(data)).toBeNull();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit:run`

Expected: FAIL — `getWarOutcome` module does not exist.

- [ ] **Step 3: Create `src/utils/getWarOutcome.mjs`**

Extract the function **verbatim** from `src/components/h1/War/War.jsx` (lines 29-84). The decision tree MUST preserve:
- The early return for all 3 live factions defeated (line 40)
- `victorySignal && !defeatSignal` → victory (line 73)
- `defeatSignal` → defeat (line 76)
- `!victorySignal` → defeat (line 79) — this is the "war lost" fallback
- Final `return null` (line 83) — unreachable but keep for safety

```js
// src/utils/getWarOutcome.mjs

/**
 * Determine war outcome from campaign data.
 * @param {object} data - Campaign data from getCampaign()
 * @returns {{ outcome: 'victory'|'defeat', reason: string } | null}
 */
export function getWarOutcome(data) {
    const snapshots = data?.snapshots || [];
    const events = data?.events || [];
    const live = data?.live || [];

    // No data at all — no banner
    if (snapshots.length === 0 && events.length === 0 && live.length === 0) {
        return null;
    }

    // Victory signal 1: live data shows all 3 factions defeated (current season)
    if (live.length === 3 && live.every((f) => f.status === 'defeated')) {
        return { outcome: 'victory', reason: 'All enemy factions have been defeated.' };
    }

    // Victory signal 2: ANY snapshot shows all 3 factions defeated
    const anySnapshotDefeated = snapshots.some((snap) => {
        const factionData =
            typeof snap.data === 'string' ? JSON.parse(snap.data) : snap.data;
        return (
            Array.isArray(factionData) &&
            factionData.length === 3 &&
            factionData.every((f) => f.status === 'defeated')
        );
    });

    // Victory signal 3: all 3 enemy homeworlds captured (successful attacks)
    const factionsDefeated = new Set(
        events
            .filter((e) => e.type === 'attack' && e.status === 'success')
            .map((e) => e.enemy),
    );
    const allHomeworldsCaptured = factionsDefeated.size === 3;

    const victorySignal = anySnapshotDefeated || allHomeworldsCaptured;

    // Defeat signal: last region-0 defend event failed (Super Earth fell)
    const r0Defends = events
        .filter((e) => e.type === 'defend' && e.region === 0)
        .sort((a, b) => a.end_time - b.end_time);
    const defeatSignal =
        r0Defends.length > 0 && r0Defends[r0Defends.length - 1].status === 'fail';

    // Decision
    if (victorySignal && !defeatSignal) {
        return { outcome: 'victory', reason: 'All enemy factions have been defeated.' };
    }
    if (defeatSignal) {
        return { outcome: 'defeat', reason: 'The war was lost.' };
    }
    if (!victorySignal) {
        return { outcome: 'defeat', reason: 'The war was lost.' };
    }

    return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit:run`

Expected: All tests pass.

- [ ] **Step 5: Update War.jsx to import from the new location**

In `src/components/h1/War/War.jsx`, replace the local `function getWarOutcome(data)` definition with:

```js
import { getWarOutcome } from '@/utils/getWarOutcome.mjs';
```

Delete the function body from War.jsx (lines 29-84 approximately).

- [ ] **Step 6: Run build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/utils/getWarOutcome.mjs src/__tests__/unit/utils/getWarOutcome.test.mjs src/components/h1/War/War.jsx
git commit -m "refactor: extract getWarOutcome into shared utility with tests"
```

---

### Task 4: Rewrite the OG image route

**Files:**
- Rewrite: `src/app/api/og/route.js`
- Reference: `src/enums/mapPaths.mjs`, `src/utils/computeMapState.mjs`, `src/utils/getWarOutcome.mjs`, `src/db/queries/getCampaign.mjs`

This is the main feature. The route fetches live war data, computes map state, builds the galaxy map as an SVG string (base64-encoded for Satori), and renders a 1200x630 PNG with stats sidebar.

**Key design decisions:**
- SVG is built as a string and embedded as `<img src="data:image/svg+xml;base64,...">` because Satori does not support inline SVG elements
- Uses `tryCatch` wrapper per project convention
- Sets `Cache-Control` headers to prevent crawler-driven DB load
- Uses `points / points_max` (not `points_taken`) to align with `computeMapState`
- Defensive fallbacks for all faction-indexed array lookups

- [ ] **Step 1: Rewrite `src/app/api/og/route.js`**

```js
import { ImageResponse } from 'next/og';
import { getCampaign } from '@/db/queries/getCampaign.mjs';
import { computeMapState } from '@/utils/computeMapState.mjs';
import { getWarOutcome } from '@/utils/getWarOutcome.mjs';
import { tryCatch } from '@/utils/tryCatch.mjs';
import { bugPaths, cyborgPaths, illuminatePaths, superEarth, viewBox } from '@/enums/mapPaths.mjs';

// Color constants (from Map.css, hardcoded for Satori)
const COLORS = {
    bg: 'rgb(0, 9, 19)',
    border: 'rgba(255, 225, 0, 0.99)',
    captured: 'rgba(255, 213, 0, 0.33)',
    lost: 'rgba(0, 0, 0, 0.55)',
    lostStroke: 'rgba(0, 0, 0, 0.99)',
    bugs: 'rgba(25, 218, 12, 0.35)',
    bugsText: 'rgba(25, 218, 12, 0.9)',
    bugsBar: 'rgba(25, 218, 12, 0.7)',
    cyborgs: 'rgba(213, 15, 15, 0.35)',
    cyborgsText: 'rgba(213, 15, 15, 0.9)',
    cyborgsBar: 'rgba(213, 15, 15, 0.7)',
    illuminate: 'rgba(12, 122, 218, 0.35)',
    illuminateText: 'rgba(12, 122, 218, 0.9)',
    illuminateBar: 'rgba(12, 122, 218, 0.7)',
    yellow: 'rgba(255, 225, 0, 0.99)',
    textDim: 'rgba(255, 255, 255, 0.5)',
    textMuted: 'rgba(255, 255, 255, 0.4)',
    barBg: 'rgba(255, 255, 255, 0.1)',
};

const FACTION_NAMES = ['BUGS', 'CYBORGS', 'ILLUMINATE'];
const FACTION_FILL = [COLORS.bugs, COLORS.cyborgs, COLORS.illuminate];
const FACTION_TEXT = [COLORS.bugsText, COLORS.cyborgsText, COLORS.illuminateText];
const FACTION_BAR = [COLORS.bugsBar, COLORS.cyborgsBar, COLORS.illuminateBar];
const FACTION_PATHS = [bugPaths, cyborgPaths, illuminatePaths];

const CACHE_HEADERS = {
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
};

function getSectorFill(status, factionIndex) {
    if (status === 'captured') return COLORS.captured;
    if (status === 'lost') return COLORS.lost;
    return FACTION_FILL[factionIndex] || COLORS.lost;
}

function getSectorStroke(status) {
    return status === 'lost' ? COLORS.lostStroke : COLORS.border;
}

function fallbackImage() {
    return new ImageResponse(
        <div style={{ display: 'flex', width: '100%', height: '100%', background: COLORS.bg, color: 'white', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
            helldivers.bot
        </div>,
        { width: 1200, height: 630, headers: CACHE_HEADERS },
    );
}

/**
 * Build the galaxy map as an SVG string with inline fill/stroke colors,
 * then base64-encode it for use as an <img> src in Satori.
 */
function buildMapSvg(mapState) {
    const paths = [];

    for (let fi = 0; fi < FACTION_PATHS.length; fi++) {
        for (const path of FACTION_PATHS[fi]) {
            const status = mapState[fi]?.[path.sector]?.status || 'lost';
            const fill = getSectorFill(status, fi);
            const stroke = getSectorStroke(status);
            paths.push(`<path d="${path.d}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`);
        }
    }

    // Super Earth
    paths.push(
        `<circle cx="${superEarth.circle.cx}" cy="${superEarth.circle.cy}" r="${superEarth.circle.r}" fill="${COLORS.captured}" stroke="${COLORS.border}" stroke-width="2"/>`
    );

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${paths.join('')}</svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

export async function GET() {
    const { data, error } = await tryCatch(getCampaign());

    if (error || !data || !data.live || data.live.length === 0) {
        return fallbackImage();
    }

    const mapState = computeMapState(data.live, data.events || []);
    const warOutcome = getWarOutcome(data);
    const mapDataUri = buildMapSvg(mapState);

    // Calculate faction progress percentages (uses `points` to align with computeMapState)
    const factionStats = data.live.map((f) => {
        const idx = f.enemy;
        return {
            name: FACTION_NAMES[idx] || `FACTION ${idx}`,
            percent: f.points_max > 0 ? Math.round((f.points / f.points_max) * 100) : 0,
            textColor: FACTION_TEXT[idx] || COLORS.textDim,
            barColor: FACTION_BAR[idx] || COLORS.textDim,
            enemy: idx,
        };
    });

    // War status text
    let statusText = 'WAR IN PROGRESS';
    let statusColor = COLORS.yellow;
    if (warOutcome?.outcome === 'victory') {
        statusText = 'VICTORY';
        statusColor = COLORS.yellow;
    } else if (warOutcome?.outcome === 'defeat') {
        statusText = 'DEFEAT';
        statusColor = COLORS.cyborgsText;
    }

    return new ImageResponse(
        <div style={{ display: 'flex', width: '100%', height: '100%', background: COLORS.bg }}>
            {/* Left: Galaxy Map (60%) */}
            <div style={{ display: 'flex', width: '60%', height: '100%', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                {/* Title overlay */}
                <div style={{ display: 'flex', flexDirection: 'column', position: 'absolute', left: 24, top: 24 }}>
                    <span style={{ fontSize: 14, color: COLORS.textDim, letterSpacing: 2 }}>HELLDIVERS 1</span>
                    <span style={{ fontSize: 24, color: COLORS.yellow, fontWeight: 'bold' }}>GALACTIC WAR</span>
                </div>
                {/* Map as base64 SVG image */}
                <img src={mapDataUri} width={600} height={600} style={{ objectFit: 'contain' }} />
            </div>
            {/* Right: Stats (40%) */}
            <div style={{ display: 'flex', flexDirection: 'column', width: '40%', height: '100%', padding: '40px 32px', justifyContent: 'center', gap: 16 }}>
                <span style={{ fontSize: 16, color: COLORS.yellow, fontWeight: 'bold', letterSpacing: 3 }}>
                    SEASON {data.season ?? '?'}
                </span>
                <span style={{ fontSize: 28, color: statusColor, fontWeight: 'bold' }}>{statusText}</span>
                {/* Faction progress bars */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 16 }}>
                    {factionStats.map((f) => (
                        <div key={f.enemy} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: f.textColor }}>
                                <span>{f.name}</span>
                                <span>{f.percent}%</span>
                            </div>
                            <div style={{ display: 'flex', height: 10, background: COLORS.barBg, borderRadius: 5, overflow: 'hidden' }}>
                                <div style={{ width: `${f.percent}%`, height: '100%', background: f.barColor, borderRadius: 5 }} />
                            </div>
                        </div>
                    ))}
                </div>
                {/* Branding */}
                <span style={{ fontSize: 14, color: COLORS.textMuted, marginTop: 'auto' }}>helldivers.bot</span>
            </div>
        </div>,
        { width: 1200, height: 630, headers: CACHE_HEADERS },
    );
}
```

- [ ] **Step 2: Test locally**

Ask user to start dev server. Visit `http://localhost:3000/api/og` in browser.

Expected: A 1200x630 PNG image with the galaxy map on the left and faction stats on the right. Colors match the game theme.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/og/route.js
git commit -m "feat: dynamic OG image with galaxy map and war stats"
```

---

### Task 5: Update layout metadata and add smoke test

**Files:**
- Modify: `src/app/layout.jsx`
- Modify: `src/__tests__/e2e/smoke.spec.mjs`

- [ ] **Step 1: Update layout metadata**

In `src/app/layout.jsx`, update the `metadata` export to include the dynamic OG image:

```js
export const metadata = {
    metadataBase: 'https://helldivers.bot',
    title: 'Helldivers Bot - Live war dashboard for the original Helldivers',
    description:
        'Live Helldivers 1 war dashboard showing campaign progress, faction stats, active events, and an interactive galaxy map.',
    openGraph: {
        images: ['/api/og'],
    },
    twitter: {
        card: 'summary_large_image',
        images: ['/api/og'],
    },
};
```

- [ ] **Step 2: Add OG route to smoke tests**

Add this test inside the `test.describe('Smoke tests')` block in `src/__tests__/e2e/smoke.spec.mjs`:

```js
test('GET /api/og returns a PNG image', async ({ request }) => {
    const response = await request.get('/api/og');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');
});
```

- [ ] **Step 3: Run build and unit tests**

Run: `npm run build && npm run test:unit:run`

Expected: Both pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.jsx src/__tests__/e2e/smoke.spec.mjs
git commit -m "feat: wire OG image into layout metadata, add smoke test"
```

---

### Task 6: Final verification

- [ ] **Step 1: Run full build**

Run: `npm run build`

Expected: Build succeeds.

- [ ] **Step 2: Run unit tests**

Run: `npm run test:unit:run`

Expected: All tests pass (tryCatch + getWarOutcome).

- [ ] **Step 3: Run smoke tests**

Ask user to start dev server. Run: `npm run test:smoke`

Expected: All smoke tests pass, including the new OG route test.

- [ ] **Step 4: Visual check**

Visit `http://localhost:3000/api/og` — verify the image looks correct with real war data.

- [ ] **Step 5: Bump version and update changelog**

Update `package.json` version to `0.13.0`. Add changelog entry:

```
## 0.13.0 (YYYY-MM-DD)

- Dynamic OG image generation showing galaxy map with live war progress
- Extract SVG path geometry into shared `src/enums/mapPaths.mjs`
- Extract `getWarOutcome` into shared utility with unit tests
- Refactor `Map.jsx` to consume shared path data
- Add OG route smoke test
```

- [ ] **Step 6: Commit**

```bash
git add package.json CHANGELOG.md
git commit -m "chore: bump version to 0.13.0, update changelog"
```
