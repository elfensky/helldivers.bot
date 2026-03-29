# OG Image File Convention Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the OG image conflict by migrating from a static PNG + API route to the Next.js `opengraph-image.jsx` file convention, producing a dynamic OG image with live war data.

**Architecture:** Delete the static `opengraph-image.png` that overrides the dynamic image. Convert the existing Satori-based API route (`/api/og`) into an `opengraph-image.jsx` file using Next.js's file-based metadata convention. Fix a pre-existing `events` variable bug and update caching from manual headers to ISR.

**Tech Stack:** Next.js file-based metadata, Satori/`ImageResponse`, ISR (`revalidate`)

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/app/opengraph-image.jsx` | Dynamic OG image (file convention) |
| Modify | `src/app/layout.jsx` | Metadata config (remove manual images, add og:type/url, fix metadataBase) |
| Modify | `src/__tests__/e2e/smoke.spec.mjs` | Update smoke test from `/api/og` to `/opengraph-image` |
| Modify | `docs/04-api-reference.md` | Remove `/api/og` section, add note about file convention |
| Delete | `src/app/opengraph-image.png` | Static PNG (conflict source) |
| Delete | `src/app/opengraph-image.alt.txt` | Alt text for static PNG |
| Delete | `src/app/api/og/route.js` | Old API route (replaced by file convention) |

---

### Task 1: Create `opengraph-image.jsx`

**Files:**
- Create: `src/app/opengraph-image.jsx`

- [ ] **Step 1: Create the new file with all content from route.js, adapted for file convention**

Create `src/app/opengraph-image.jsx` with the following content. This is the full file — it contains the complete Satori rendering logic from `src/app/api/og/route.js` with the required changes:

```jsx
import { ImageResponse } from 'next/og';
import { getCampaign } from '@/db/queries/getCampaign.mjs';
import { computeMapState } from '@/utils/computeMapState.mjs';
import { tryCatch } from '@/utils/tryCatch.mjs';
import {
    bugPaths,
    cyborgPaths,
    illuminatePaths,
    superEarthCircle,
    viewBox,
} from '@/enums/mapPaths.mjs';

// --- File convention exports ---
export const revalidate = 300;
export const alt = 'Helldivers 1 galactic war status map with faction progress';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// --- Constants ---
const COLORS = {
    bg: 'rgb(0, 9, 19)',
    border: 'rgba(255, 225, 0, 0.99)',
    captured: 'rgba(255, 213, 0, 0.33)',
    lost: 'rgba(255, 255, 255, 0.06)',
    lostStroke: 'rgba(255, 255, 255, 0.15)',
    bugs: 'rgba(232, 130, 42, 0.35)',
    bugsText: 'rgba(232, 130, 42, 0.9)',
    bugsBar: 'rgba(232, 130, 42, 0.7)',
    cyborgs: 'rgba(139, 45, 45, 0.35)',
    cyborgsText: 'rgba(139, 45, 45, 0.9)',
    cyborgsBar: 'rgba(139, 45, 45, 0.7)',
    illuminate: 'rgba(126, 200, 227, 0.35)',
    illuminateText: 'rgba(126, 200, 227, 0.9)',
    illuminateBar: 'rgba(126, 200, 227, 0.7)',
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
        <div
            style={{
                display: 'flex',
                width: '100%',
                height: '100%',
                background: COLORS.bg,
                color: 'white',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 32,
            }}
        >
            helldivers.bot
        </div>,
        { width: 1200, height: 630 },
    );
}

function buildMapSvg(mapState) {
    const paths = [];

    for (let fi = 0; fi < FACTION_PATHS.length; fi++) {
        for (const path of FACTION_PATHS[fi]) {
            const status = mapState[fi]?.[path.sector]?.status || 'lost';
            const fill = getSectorFill(status, fi);
            const stroke = getSectorStroke(status);
            paths.push(
                `<path d="${path.d}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`,
            );
        }
    }

    paths.push(
        `<circle cx="${superEarthCircle.cx}" cy="${superEarthCircle.cy}" r="${superEarthCircle.r}" fill="${COLORS.captured}" stroke="${COLORS.border}" stroke-width="2"/>`,
    );

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${paths.join('')}</svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

export default async function Image() {
    const { data, error } = await tryCatch(getCampaign());

    if (error || !data || !data.live || data.live.length === 0) {
        return fallbackImage();
    }

    // Two event lists:
    // - events: full list — needed for status text (includes completed events for WON/LOST display)
    // - activeEvents: filtered — only active events affect sector ownership on the map
    const events = data.events || [];
    const activeEvents = events.filter((e) => e.status === 'active');
    const mapState = computeMapState(data.live, activeEvents);
    const mapDataUri = buildMapSvg(mapState);

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

    // Determine status from live data and events
    let statusText = 'WAR IN PROGRESS';
    let statusColor = COLORS.yellow;

    const allDefeated =
        data.live.length === 3 && data.live.every((f) => f.status === 'defeated');
    if (allDefeated) {
        statusText = 'VICTORY';
    } else if (events.length > 0) {
        const activeEvent = events.find((e) => e.status === 'active');
        if (activeEvent) {
            statusText = 'ACTIVE EVENT';
        } else {
            const lastEvent = events.toSorted((a, b) => b.end_time - a.end_time)[0];
            const won = lastEvent.status === 'success';
            const verb = lastEvent.type === 'defend' ? 'DEFEND' : 'ATTACK';
            statusText = won ? `${verb} WON` : `${verb} LOST`;
            statusColor = won ? COLORS.yellow : COLORS.cyborgsText;
        }
    }

    return new ImageResponse(
        <div
            style={{
                display: 'flex',
                width: '100%',
                height: '100%',
                background: COLORS.bg,
            }}
        >
            <div
                style={{
                    display: 'flex',
                    width: '60%',
                    height: '100%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'absolute',
                        left: 24,
                        top: 24,
                    }}
                >
                    <span
                        style={{
                            fontSize: 18,
                            color: COLORS.textDim,
                            letterSpacing: 2,
                        }}
                    >
                        HELLDIVERS 1
                    </span>
                    <span
                        style={{
                            fontSize: 34,
                            color: COLORS.yellow,
                            fontWeight: 'bold',
                        }}
                    >
                        GALACTIC WAR
                    </span>
                </div>
                <img
                    src={mapDataUri}
                    width={600}
                    height={600}
                    style={{ objectFit: 'contain' }}
                />
            </div>
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '40%',
                    height: '100%',
                    padding: '40px 32px',
                    justifyContent: 'center',
                    gap: 16,
                }}
            >
                <span
                    style={{
                        fontSize: 24,
                        color: COLORS.yellow,
                        fontWeight: 'bold',
                        letterSpacing: 3,
                    }}
                >
                    SEASON {data.season ?? '?'}
                </span>
                <span
                    style={{
                        fontSize: 44,
                        color: statusColor,
                        fontWeight: 'bold',
                    }}
                >
                    {statusText}
                </span>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 20,
                        marginTop: 16,
                    }}
                >
                    {factionStats.map((f) => (
                        <div
                            key={f.enemy}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 4,
                            }}
                        >
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    fontSize: 20,
                                    fontWeight: 'bold',
                                    color: f.textColor,
                                }}
                            >
                                <span>{f.name}</span>
                                <span>{f.percent}%</span>
                            </div>
                            <div
                                style={{
                                    display: 'flex',
                                    height: 14,
                                    background: COLORS.barBg,
                                    borderRadius: 5,
                                    overflow: 'hidden',
                                }}
                            >
                                <div
                                    style={{
                                        width: `${f.percent}%`,
                                        height: '100%',
                                        background: f.barColor,
                                        borderRadius: 5,
                                    }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
                <span
                    style={{
                        fontSize: 16,
                        color: COLORS.textMuted,
                        marginTop: 'auto',
                    }}
                >
                    helldivers.bot
                </span>
            </div>
        </div>,
        { width: 1200, height: 630 },
    );
}
```

Key changes from `route.js`:
- `export default async function Image()` instead of `export async function GET()`
- Added `revalidate`, `alt`, `size`, `contentType` named exports
- Removed `CACHE_HEADERS` constant and `headers` option from both `ImageResponse` calls
- Fixed events bug: `const events = data.events || []` (full list) + `const activeEvents = events.filter(...)` (filtered for map)

- [ ] **Step 2: Verify the file was created correctly**

Run: `head -20 src/app/opengraph-image.jsx`
Expected: Imports and `export const revalidate = 300;` visible at top.

---

### Task 2: Delete old files

**Files:**
- Delete: `src/app/opengraph-image.png`
- Delete: `src/app/opengraph-image.alt.txt`
- Delete: `src/app/api/og/route.js`

- [ ] **Step 1: Delete the static PNG, alt text, and old route**

```bash
rm src/app/opengraph-image.png
rm src/app/opengraph-image.alt.txt
rm src/app/api/og/route.js
rmdir src/app/api/og
```

- [ ] **Step 2: Verify deletions**

```bash
ls src/app/opengraph-image* src/app/api/og/ 2>&1
```

Expected: Only `src/app/opengraph-image.jsx` exists. The `.png`, `.alt.txt`, and `api/og/` directory are gone.

- [ ] **Step 3: Commit deletions + new file**

```bash
git add src/app/opengraph-image.jsx src/app/opengraph-image.png src/app/opengraph-image.alt.txt src/app/api/og/route.js
git commit -m "feat: migrate OG image from static PNG + API route to file convention

Replace static opengraph-image.png and /api/og route with
opengraph-image.jsx using Next.js file-based metadata convention.
Fix events variable bug and switch caching from manual headers to ISR."
```

---

### Task 3: Update layout.jsx metadata

**Files:**
- Modify: `src/app/layout.jsx:35-47`

- [ ] **Step 1: Update the metadata export**

Replace the existing `metadata` export in `src/app/layout.jsx` (lines 35-47) with:

```js
export const metadata = {
    metadataBase: new URL('https://helldivers.bot'),
    title: 'Helldivers Bot - Live war dashboard for the original Helldivers',
    description:
        'Live Helldivers 1 war dashboard showing campaign progress, faction stats, active events, and an interactive galaxy map.',
    openGraph: {
        type: 'website',
        url: 'https://helldivers.bot',
    },
    twitter: {
        card: 'summary_large_image',
    },
};
```

Changes:
- `metadataBase`: `'https://helldivers.bot'` → `new URL('https://helldivers.bot')`
- `openGraph`: removed `images: ['/api/og']`, added `type: 'website'` and `url`
- `twitter`: removed `images: ['/api/og']`

- [ ] **Step 2: Commit**

```bash
git add src/app/layout.jsx
git commit -m "fix: update metadata config for OG file convention

Remove manual openGraph/twitter image references (now auto-generated).
Add og:type and og:url. Fix metadataBase to use URL instance."
```

---

### Task 4: Update smoke test

**Files:**
- Modify: `src/__tests__/e2e/smoke.spec.mjs:53-57`

- [ ] **Step 1: Update the OG image smoke test**

In `src/__tests__/e2e/smoke.spec.mjs`, replace the existing test (lines 53-57):

```js
    test('GET /api/og returns a PNG image', async ({ request }) => {
        const response = await request.get('/api/og');
        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toContain('image/png');
    });
```

With:

```js
    test('GET /opengraph-image returns a PNG image', async ({ request }) => {
        const response = await request.get('/opengraph-image');
        expect(response.status()).toBe(200);
        expect(response.headers()['content-type']).toContain('image/png');
    });
```

- [ ] **Step 2: Commit**

```bash
git add src/__tests__/e2e/smoke.spec.mjs
git commit -m "test: update OG image smoke test for file convention URL"
```

---

### Task 5: Update docs

**Files:**
- Modify: `docs/04-api-reference.md`

- [ ] **Step 1: Update the API reference**

In `docs/04-api-reference.md`, find the `## 6. GET /api/og` section and replace it with:

```markdown
## 6. OG Image (File Convention)

**Source:** `src/app/opengraph-image.jsx`

**URL:** `/opengraph-image` (auto-generated by Next.js file convention)

**Auth:** None.

Dynamically generates a 1200×630 PNG Open Graph image using Satori. Shows the galaxy map with sector ownership, faction progress bars, season number, and war status. Cached via ISR (`revalidate = 300`, 5 minutes).

Previously served from `/api/og` as a manual route. Migrated to the file convention so Next.js auto-generates the `<meta og:image>` tags with correct dimensions, content-type, and alt text.
```

Also update the note at the bottom of the doc that mentions `/api/og` — change:

```
`/api/healthcheck` and `/api/og` are not registered in the OpenAPI spec. `/api/og` returns a PNG image, not JSON.
```

To:

```
`/api/healthcheck` is not registered in the OpenAPI spec. The OG image is served via the Next.js file convention at `/opengraph-image`, not as an API route.
```

- [ ] **Step 2: Commit**

```bash
git add docs/04-api-reference.md
git commit -m "docs: update API reference for OG image file convention migration"
```

---

### Task 6: Clean build and verify

- [ ] **Step 1: Clean the Next.js cache**

```bash
rm -rf .next
```

This prevents the old static PNG metadata from persisting in the build cache.

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: Build succeeds with no errors. The build output should show `/opengraph-image` in the routes list as a dynamic route (marked with `ƒ` or `λ`).

- [ ] **Step 3: Run unit tests**

```bash
npm run test:unit:run
```

Expected: All tests pass. No regressions.

- [ ] **Step 4: Commit any formatting changes**

```bash
npm run format
git add -A
git commit -m "chore: format after OG image migration"
```

(Skip this step if `npm run format` produces no changes.)
