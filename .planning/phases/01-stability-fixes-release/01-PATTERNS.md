# Phase 1: Stability Fixes & Release - Pattern Map

**Mapped:** 2026-08-31
**Files analyzed:** 10
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/app/opengraph-image.jsx` (modify) | route (image handler) | request-response | itself (existing `renderOrFallback`/`fallbackImage`) | exact — modify in place |
| `public/og-fallback.png` (new static asset) | config/asset | file-I/O | none — new asset class | no analog |
| `src/features/notifications/NotificationToggle.jsx` (modify) | component (state machine) | event-driven | itself (existing state machine) | exact — modify in place |
| `src/app/layout.jsx` (modify, add `Space_Mono`) | provider/layout | request-response | itself — existing `Space_Grotesk`/`Inter` font blocks | exact |
| `src/shared/utils/game/getWarOutcome.mjs` (modify) | utility (transform) | transform | itself — existing `.every` signal checks | exact — modify in place |
| Hydration divergence fixes (various dashboard components, TBD by sweep) | component | request-response (SSR/hydrate) | `src/features/galaxy/DefeatedCard.jsx` (already fixed `timeZone: 'UTC'` pattern) | exact |
| `src/__tests__/unit/features/galaxy/<Component>.hydration.test.jsx` (new, per divergence found) | test | transform | `src/__tests__/unit/features/galaxy/DefeatedCard.hydration.test.jsx` | exact |
| `src/__tests__/unit/features/notifications/NotificationToggle.test.jsx` (extend) | test | event-driven | itself — existing 10-case suite | exact |
| `src/__tests__/unit/app/opengraph-image.test.jsx` (extend) | test | request-response | itself — existing 2-case suite | exact |
| `src/__tests__/unit/shared/utils/game/getWarOutcome.test.mjs` (extend, null-slot + `buildPlayerBeats` zero-baseline case) | test | transform | itself (existing test, path per mirror rule) | exact |

## Pattern Assignments

### `src/app/opengraph-image.jsx` (route, request-response)

**Analog:** itself — `renderOrFallback()` / `fallbackImage()` / `revalidate` already present, this phase changes their *contents*, not the guard shape.

**Current guard structure** (lines 81-90):
```javascript
async function renderOrFallback(response) {
    const { data, error } = await tryCatch(response.arrayBuffer());

    if (error) {
        Sentry.captureException(error, { tags: { route: 'opengraph-image' } });
        return fallbackImage();
    }

    return new Response(data, { headers: response.headers });
}
```
Keep this shape. Per D-08, the fallback branch must add `Cache-Control: no-store` (or equivalent) to bypass the `revalidate = 300` ISR cache — currently `revalidate = 300` (line 23) applies uniformly, which is the "stuck fallback" bug. Per D-09, add a `sendUmamiEvent`/`umamiTrackEvent` call (see Shared Patterns below) for both the `rendered` and `fallback` outcomes, plus keep the existing `Sentry.captureException` call (already tagged `route: 'opengraph-image'`) on every failed render.

**Current fallback (to be replaced per D-07)** (lines 92-110):
```javascript
function fallbackImage() {
    return new ImageResponse(
        <div style={{ ... }}>
            {new URL(SITE_URL).host}
        </div>,
        { width: 1200, height: 630 },
    );
}
```
Per D-07, this Satori-rendered fallback (which itself goes through sharp and can fail the same way) is replaced by serving a static committed PNG (`public/og-fallback.png`) as raw bytes — no `ImageResponse`, no Satori, no sharp involved in the fallback path. A `fs.readFile`/`Response(buffer, { headers: { 'content-type': 'image/png' } })` pattern replaces the JSX-based fallback. This is the one genuinely new code shape in this phase (no existing analog for "serve a static asset instead of a generated one" — see `## No Analog Found`).

**Existing empty-data guard** (line 137, extend per D-11):
```javascript
if (error || !data || !data.status || data.status.length === 0) {
    return fallbackImage();
}
```
This is the `getCampaign()` failure-mode guard called out in D-11 — audit whether `error` here also needs to distinguish DB-timeout vs empty-season, but the existing shape (tryCatch + falsy-data check → fallback) is the pattern to extend, not replace.

**Imports pattern** (lines 1-20): `next/og` `ImageResponse`, `@sentry/nextjs` for direct `Sentry.captureException`, `tryCatch` from `@/shared/utils/tryCatch.mjs`. New telemetry calls should import `umamiTrackEvent` from `@/shared/utils/umami.mjs` and/or `reportError` from `@/shared/utils/observability.mjs` (see Shared Patterns) rather than calling `Sentry.captureException` directly a second time — but note the *existing* direct `Sentry.captureException` call at line 85 is already in place and tagged; don't duplicate reporting, extend it or route it through `reportError` for consistency if touched.

---

### `src/features/notifications/NotificationToggle.jsx` (component, event-driven)

**Analog:** itself — existing state machine (`loading | unsupported | denied | enabled | disabled`).

**State machine core** (lines 50-78):
```javascript
export default function NotificationToggle() {
    const [state, setState] = useState('loading'); // loading | unsupported | denied | enabled | disabled
    const [busy, setBusy] = useState(false);
    const track = useTrack();

    useEffect(() => {
        if (typeof Notification === 'undefined') {
            setState('unsupported');
            return;
        }
        if (Notification.permission === 'denied') {
            setState('denied');
            return;
        }
        if (Notification.permission === 'granted') {
            if ('serviceWorker' in navigator && 'PushManager' in window) {
                navigator.serviceWorker.ready.then((reg) => {
                    reg.pushManager.getSubscription().then((sub) => {
                        setState(sub ? 'enabled' : 'disabled');
                    });
                });
            } else {
                setState('enabled');
            }
        } else {
            setState('disabled');
        }
    }, []);

    if (state === 'loading') return null;
    ...
```
Per D-13/D-14, add a new `'error'` state (NOT folded into `disabled`/`unsupported`) plus a 5s timeout guard on the `navigator.serviceWorker.ready` promise inside the effect — pattern: `Promise.race([serviceWorker.ready, timeoutPromise])` or a `setTimeout` that calls `setState('error')` if the effect hasn't resolved. Add a "Retry" control that re-runs this same effect (e.g. bump a retry-counter dependency, or extract the effect body into a callable `init()` function invoked both by `useEffect` and by the Retry button's `onClick`).

**Unsupported/denied render branch** (lines 82-96) — copy this shape for the new `error` state's "Notifications unavailable" + Retry link/button:
```javascript
if (state === 'unsupported' || state === 'denied') {
    const label =
        state === 'denied' ? 'Notifications blocked' : 'Notifications unavailable';
    return (
        <Link
            href="/docs/faq"
            prefetch={false}
            data-umami-event="notification-faq"
            className="font-mono text-small text-[var(--color-text-muted)] opacity-50 hover:opacity-80"
            title="How to enable notifications"
        >
            {label}
        </Link>
    );
}
```

**`subscribeToPush()` VAPID guard** (lines 17-20, per D-15 must surface an error instead of silently bailing):
```javascript
async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;
    ...
```
Change the `if (!vapidKey) return;` early-return to throw or otherwise propagate an error the caller (`enable()`) can catch and route into the new `error` state.

**`track()` usage pattern** (throughout `enable()`/`disable()`, lines 98-119) — `useTrack()` from `@/shared/hooks/useTrack.mjs`, called as `track('event-name')`; follow the same `category-action` naming for any new error-path tracking (e.g. `notification-error`, `notification-retry`).

---

### `src/app/layout.jsx` (provider/layout, request-response)

**Analog:** itself — existing `Space_Grotesk` / `Inter` blocks (lines 5, 23-33, 87).

**Font import + config pattern** (lines 5, 23-33):
```javascript
import { Space_Grotesk, Inter } from 'next/font/google';

const spaceGrotesk = Space_Grotesk({
    subsets: ['latin'],
    variable: '--font-space-grotesk',
    display: 'swap',
});

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-inter',
    display: 'swap',
});
```
Per D-17, add:
```javascript
import { Space_Grotesk, Inter, Space_Mono } from 'next/font/google';

const spaceMono = Space_Mono({
    subsets: ['latin'],
    weight: ['400', '700'],
    variable: '--font-space-mono',
    display: 'swap',
});
```

**Variable wiring onto `<html>`** (line 87):
```javascript
<html dir="ltr" lang="en" className={`${spaceGrotesk.variable} ${inter.variable}`}>
```
Extend to `${spaceGrotesk.variable} ${inter.variable} ${spaceMono.variable}`.

**CSS token indirection** — `src/app/layout.css` lines 47-50 and 99-102 currently hardcode the bare string:
```css
--font-mono: 'Space Mono', monospace;
```
(appears twice — light/dark or two `@theme`-adjacent blocks; both must be updated). Per D-17, repoint to the generated CSS variable, following how `--font-body`/`--font-display` presumably ultimately resolve through `var(--font-inter)`/`var(--font-space-grotesk)` once `next/font` variables are wired — i.e. `--font-mono: var(--font-space-mono), monospace;`. Verify against how `spaceGrotesk`/`inter` variables are actually consumed elsewhere in `layout.css` (only `font-family: var(--font-body)` was directly observed at line 248 — confirm the `--font-display`/`--font-body` → `--font-space-grotesk`/`--font-inter` chain before writing the equivalent `--font-mono` chain).

---

### `src/shared/utils/game/getWarOutcome.mjs` (utility, transform)

**Analog:** itself — unguarded `.every` calls at lines 55 and 69.

**Unguarded checks to fix** (lines 55, 64-71):
```javascript
if (live.length === 3 && live.every((f) => f.status === CAMPAIGN_STATUS.DEFEATED)) {
    ...
}

const anySnapshotDefeated = snapshots.some((snap) => {
    const factionData = snap.data;
    return (
        Array.isArray(factionData) &&
        factionData.length === 3 &&
        factionData.every((f) => f.status === CAMPAIGN_STATUS.DEFEATED)
    );
});
```
Per D-19, add a null guard in the `.every` callback (e.g. `f?.status === CAMPAIGN_STATUS.DEFEATED`) or an early `some((f) => !f)` bail before the `.every` call, for both call sites — a `null` slot in `live` or `factionData` currently throws on `f.status` access. `data.status.every(...)` in `src/app/opengraph-image.jsx` (line 165, `allDefeated`) has the identical unguarded shape and is an example already in the codebase of the same bug class — useful cross-reference, not necessarily in scope to fix unless the sweep flags it.

**JSDoc-documented signal algorithm** (lines 1-35) — preserve the existing algorithm doc-comment; extend it with a line noting the null-guard behavior once added, so the "verified against 137 wiki-confirmed seasons" comment stays accurate about what inputs are handled.

Also per D-19, `buildPlayerBeats`' untested zero-baseline guard needs a fixture test in the same pass — locate via `grep -rn "buildPlayerBeats" src` (not found in this scan; confirm exact file path during planning, likely co-located under `src/shared/utils/game/` or `src/features/` near `getWarOutcome.mjs`'s consumers).

---

### Hydration divergence fixes (dashboard components, TBD by sweep)

**Analog:** `src/features/galaxy/DefeatedCard.jsx` (already-fixed reference; read it directly when planning, not excerpted here since exact fix content is unknown until D-04's sweep runs) plus the established pattern list from CONTEXT.md: DefeatedCard, EventLogCard, CascadeLogCard, StatGrid, `groupEventsByDay` all use `timeZone: 'UTC'` pinning as "the canonical fix shape for date-format hydration divergences." Any new divergence found by the sweep should follow the same fix shape: pin `timeZone: 'UTC'` in every `toLocaleDateString`/`toLocaleTimeString`/`Intl.DateTimeFormat` call that runs at render time, rather than masking with a mounted-flag (per D-05, explicitly forbidden).

---

### `src/__tests__/unit/features/galaxy/<Component>.hydration.test.jsx` (test, per divergence)

**Analog:** `src/__tests__/unit/features/galaxy/DefeatedCard.hydration.test.jsx` (full file read — 87 lines, copy verbatim structure per new component).

**Harness pattern** (lines 1-58):
```javascript
// @vitest-environment jsdom
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { act } from 'react';
import DefeatedCard from '@/features/galaxy/DefeatedCard';

async function hydrateAcrossTimezones(serverTz, clientTz) {
    const element = (<DefeatedCard ... />);

    const original = process.env.TZ;
    process.env.TZ = serverTz;
    const html = renderToString(element);

    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);

    process.env.TZ = clientTz;
    const recoverable = [];
    await act(async () => {
        hydrateRoot(container, element, {
            onRecoverableError: (e) => recoverable.push(e),
        });
    });
    process.env.TZ = original;

    return recoverable.filter((e) => /hydrat/i.test(e.message));
}
```

**Control test that fails if the harness can't observe a mismatch** (lines 61-75):
```javascript
it('guard: the chosen instant really does straddle a date boundary', () => {
    const original = process.env.TZ;
    const fmt = () => new Date(END_TIME * 1000).toLocaleDateString('en-US', { ... });
    process.env.TZ = 'UTC';
    const utc = fmt();
    process.env.TZ = 'Europe/Warsaw';
    const warsaw = fmt();
    process.env.TZ = original;
    expect(utc).not.toBe(warsaw);
});
```
Per D-04, use `Europe/Warsaw` as the reporter-profile client timezone against a `UTC` server render for every new hydration test, and choose an instant (`END_TIME`) that provably straddles a date boundary in that pair — reuse this exact "guard" test shape to prove each new fixture is meaningful before asserting `errors` is empty post-fix.

---

### `src/__tests__/unit/features/notifications/NotificationToggle.test.jsx` (extend)

**Analog:** itself — existing 10-case suite, full file read (318 lines).

**Mock scaffolding to extend, not rebuild** (lines 12-96): `useTrack` mock (`trackMock`), `installBrowserAPIs({ permission, requestPermissionResult, hasSubscription, fetchOk })` helper that stubs `Notification`, `navigator.serviceWorker.ready`, `PushManager`, `fetch`, and `NEXT_PUBLIC_VAPID_PUBLIC_KEY` via `vi.stubEnv`. `afterEach` tears all of it down.

Per D-16, add:
- A scenario where `navigator.serviceWorker.ready` never resolves (already partially exercised at lines 100-113 for the loading-state test) — extend to advance fake timers past 5s and assert `state → 'error'`. Use `vi.useFakeTimers()` / `vi.advanceTimersByTimeAsync(5000)`.
- A scenario where `pushManager.getSubscription()` rejects (`installBrowserAPIs` currently only supports resolving `getSubscription` — extend the helper to accept a rejection).
- A Retry-button test: from `error` state, click Retry, re-run init, reach a healthy state (mirror the existing enable-flow assertions at lines 171-219).
- A missing-VAPID-key test: omit `vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', ...)`, click Enable, assert the new error surfacing (not a silent no-op) per the `subscribeToPush()` change above.

---

### `src/__tests__/unit/app/opengraph-image.test.jsx` (extend)

**Analog:** itself — existing 2-case suite, full file read (78 lines).

**Mock scaffolding to extend, not rebuild** (lines 1-44): `vi.mock('next/og', ...)` with a fake `ImageResponse` class that tracks `constructed` instances and can be made to reject `arrayBuffer()` via module-level `bodyFails` flag; `vi.mock('@sentry/nextjs', ...)` capturing `captureException` calls; `vi.mock('@/db/queries/getCampaign.mjs', ...)`; `vi.mock('@/shared/utils/game/computeMapState.mjs', ...)`.

**Existing assertions to preserve** (lines 54-77) — "returns the rendered card when rasterisation succeeds" and "falls back instead of throwing when the rasteriser rejects" (checks `constructed` length, `captureException` call args tagged `route: 'opengraph-image'`).

Per D-12, extend with map-state fixture coverage — feed each of: null slots, no active events, homeworld-only — through the actual route (via the existing `getCampaign` mock returning shaped `CAMPAIGN` fixtures, following the `CAMPAIGN` constant pattern at lines 41-44) and assert a real PNG comes back (`constructed` length 1, not the fallback). Per D-08/D-09, also add assertions for: fallback response headers include `Cache-Control: no-store` (or equivalent no-cache signal); a telemetry call fires on both `rendered` and `fallback` outcomes — mock `sendUmamiEvent`/`umamiTrackEvent` the same way `captureException` is mocked (module-level `vi.mock` + spy).

---

### `src/shared/utils/game/getWarOutcome.mjs` test (extend)

**Analog:** existing test file at the mirrored path `src/__tests__/unit/shared/utils/game/getWarOutcome.test.mjs` (not read in this pass — locate and follow its existing fixture-based assertion style; add a null-slot fixture case per D-19, plus a `buildPlayerBeats` zero-baseline fixture case once that function's actual file is located).

---

## Shared Patterns

### Error handling — `tryCatch`
**Source:** `src/shared/utils/tryCatch.mjs`
**Apply to:** All modified files with async I/O (`opengraph-image.jsx` already uses it; any new OG fallback file-read should too — `const { data, error } = await tryCatch(fs.readFile(...))`)
```javascript
const { data, error } = await tryCatch(someAsyncOperation());
if (error) { /* handle */ }
```
**Hard rule:** no `try/catch` blocks anywhere in application code (CLAUDE.md).

### GlitchTip error reporting
**Source:** `src/shared/utils/observability.mjs`
**Apply to:** `opengraph-image.jsx` (already has a direct `Sentry.captureException` call — consider routing through `reportError` for consistency with the rest of the codebase), `NotificationToggle.jsx` (new `error` state's underlying failure should be reported)
```javascript
export function reportError(error, context = {}) {
    if (!error) return;
    const { level, ...extra } = context;
    Sentry.captureException(error, { level, extra });
}
```

### Server-side Umami telemetry
**Source:** `src/shared/utils/umami.mjs`
**Apply to:** `opengraph-image.jsx` render-outcome tracking (D-09)
```javascript
export async function umamiTrackEvent(title, url, name, data = {}) {
    await sendUmamiEvent({ title, url, name, data });
}
```
Naming convention: `category-action`, e.g. `api-og-rendered` / `api-og-fallback` (category `api` fits server-side per CONTEXT.md's discretion note). Call from inside `after()` where the route supports it — verify `opengraph-image.jsx`'s route type supports `after()` (Next.js image-generation route handlers may differ from standard route handlers; confirm during planning).

### Client-side Umami tracking
**Source:** `src/shared/hooks/useTrack.mjs`, used in `NotificationToggle.jsx` lines 4, 53, 102/104/107/115/116
**Apply to:** New `NotificationToggle.jsx` error/retry tracking
```javascript
const track = useTrack();
track('notification-enable');
```

### Font loading (`next/font/google`)
**Source:** `src/app/layout.jsx` lines 5, 23-33, 87 + `src/app/layout.css` lines 47-50/99-102
**Apply to:** `Space_Mono` addition (STAB-04)
- Import from `next/font/google`, instantiate with `subsets`, `variable`, `display: 'swap'` (add `weight: ['400','700']` since Space Mono isn't variable-weight).
- Wire `.variable` class onto `<html className={...}>`.
- Repoint the CSS custom property (`--font-mono`) at the generated `var(--font-space-mono)` instead of the bare string, mirroring however `--font-body`/`--font-display` already resolve through their `next/font` variables.

### `timeZone: 'UTC'` pinning
**Source:** `src/features/galaxy/DefeatedCard.jsx` and siblings (EventLogCard, CascadeLogCard, StatGrid, `groupEventsByDay`) — read directly during planning
**Apply to:** Every hydration divergence found by the STAB-01 sweep
Canonical fix: add `timeZone: 'UTC'` to the options object of every render-time `toLocaleDateString`/`toLocaleTimeString`/`Intl.DateTimeFormat` call. Never mask with a mounted-flag (D-05).

### Mirrored test tree
**Source:** `src/__tests__/unit/` structure, enforced by `src/__tests__/unit/_meta/mirrorTree.test.mjs`
**Apply to:** All new/extended test files in this phase
A test at `unit/<dir>/<Base>[.<qualifier>].test.*` must have a source file at `<root>/<dir>/<Base>.*`. Add tests at CURRENT mirrored paths — Phase 3 (not this phase) moves the tree.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `public/og-fallback.png` (static asset) | config/asset | file-I/O | No prior "serve a static binary asset instead of a generated one" pattern exists in the codebase — closest conceptual precedent is `public/splash/*.png` (static PWA assets served directly by Next's static file serving), but there is no existing *route handler* that reads and returns a static PNG as a `Response` body; this is new code shape for the fallback branch of `opengraph-image.jsx`. |

## Metadata

**Analog search scope:** `src/app/opengraph-image.jsx`, `src/features/notifications/NotificationToggle.jsx`, `src/app/layout.jsx`, `src/app/layout.css`, `src/shared/utils/game/getWarOutcome.mjs`, `src/features/galaxy/DefeatedCard.jsx` (referenced), `src/__tests__/unit/**` (targeted files), `src/shared/utils/umami.mjs`, `src/shared/utils/observability.mjs`, `Dockerfile.app`
**Files scanned:** 10 read in full, 2 grepped
**Pattern extraction date:** 2026-08-31
