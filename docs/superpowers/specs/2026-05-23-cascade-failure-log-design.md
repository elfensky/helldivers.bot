# Cascade Failure Log — Cross-season Storytelling

**Status:** Design (approved in brainstorming)
**Author:** Andrei
**Date:** 2026-05-23
**Issue:** [#272 — Phase 09: Cascade failure detection and display](https://github.com/elfensky/helldivers.bot/issues/272)

## Summary

Promote the existing per-season `WORST_CASCADE` stat into a first-class cross-season feature. Replace the current single-result `findWorstCascade` helper with `findAllCascades`, render every cascade across every war as an `EventLog`-style section on `/stats` (grouped by season, sortable), and reuse the same component on `/archives` filtered to the current season. No new visual primitives — the implementation borrows the existing `EventLog` layout (`day group → header + summary → grid of cards`) and the `EventLogSortToggle` hook. The cascade chain (e.g. `8 → 7 → 6 → 5 → 4 → 3 → 2 → 1 → 0`) is the only genuinely new visual element.

## Goals

- Surface the worst cascade failures across all of Helldivers war history as a meaningful, scannable section on `/stats`.
- Make cascade detection rigorous: same faction, strictly decreasing region numbers, back-to-back in time (≤1h gap between events).
- Reuse the existing `EventLog` pattern wholesale — same section shape, same sort toggle, same card layout idiom.
- Tell the per-season story on `/archives` using the same component, no duplication.
- Add zero new top-level UI patterns to the project.

## Non-goals

- A separate `/stats/cascades` subpage. Everything lives on the existing `/stats` page.
- Per-cascade narratives, AI-generated copy, or templated headlines beyond the single section lede.
- Highlight reels, hero cards, pill timelines, or any other "leaderboard" treatment that doesn't already exist in the codebase.
- Real-time cascade detection (notifications, toasts). Cascades are a historical/post-hoc concept.
- A `WORST_CASCADE` stat card on `/archives` — replaced by the dedicated section below the StatGrid.
- Tracking cascades for ongoing seasons. The `/archives` log shows cascades only for archived (completed) seasons; the live `/` dashboard does not need to surface them.

## User-visible behavior

### `/stats` — new "Cascade Failures" section

Inserted between **War Outcomes & Streaks** and **All-Time Records**. Contains:

1. `<h2>Cascade Failures</h2>` heading.
2. A single auto-generated lede sentence, e.g. *"19 cascades across 200 wars. Worst: season 155, where the Illuminate pushed all the way home."*
3. A two-state sort toggle: **Worst first** (default) / **Recent first**. Persisted via a new `useCascadeLogSort` hook (independent of the dashboard event log's sort preference).
4. A sequence of **season groups**. Each group:
   - **Header row:** `SEASON 155` label + summary text (`1 cascade · Defeat`).
   - **Card grid:** one card per cascade in that season. Card content:
     - Title row: faction icon + `Defend cascade · N regions`.
     - Duration pill on the right: `14h 32m`.
     - Start/end line: `Started Mar 4, 14:32 — Ended Mar 5, 04:48`.
     - Chain line: `8 → 7 → 6 → 5 → 4 → 3 → 2 → 1 → 0` (rendered in the faction's color).
5. Each cascade card is a `<Link href="/archives?season=N#cascade">` — clicking it navigates to the archives view for that season scrolled to the cascade section.

When `cascades.length === 0`, the entire section is skipped (no placeholder, no "no cascades yet" copy). At launch with backfilled data this will always be non-empty.

### `/archives?season=N` — cascade log below the StatGrid

Same `CascadeLog` component, with `cascades` pre-filtered to the season being viewed. Mounted below the existing StatGrid + faction tabs section, with `id="cascade"` so deep-links from `/stats` land on it.

When the season has zero cascades, the section is skipped. When it has 1+ cascades, exactly one season group renders, containing one or more cards.

The existing `WORST_CASCADE` StatCard in `ArchiveStats.jsx` is removed — the dedicated section below replaces it.

### Sort behavior

| Sort | Group order | Cascade order within a group |
|---|---|---|
| Worst first (default) | By the group's longest cascade, length DESC, then speed DESC, then season DESC | Length DESC, then speed DESC, then `end_time` DESC |
| Recent first | Season DESC | `end_time` DESC |

`useCascadeLogSort` (new, mirroring `useEventLogSort`) persists the choice via `usePersistedState` under its own preference key (`CASCADE_SORT_ORDER_KEY`), so the cascade log's sort is independent of the dashboard event log's.

## Architecture

### Definition of a cascade

A cascade is a sequence of `h1_event` rows that satisfy ALL of:

1. **`type === 'defend'`** and **`status === 'fail'`** — only failed defends are eligible.
2. **Same `enemy`** (same faction across the whole sequence).
3. **Strictly decreasing `region`** — `event(N+1).region < event(N).region`. No plateau or increase.
4. **Back-to-back in time** — `event(N+1).start_time - event(N).end_time ≤ 3600` seconds (1-hour gap tolerance). Any gap longer than that breaks the cascade.
5. **Minimum length 3** — sequences of length 2 are not cascades for any purpose in the feature.

A "cascade" is also the data object derived from such a sequence:

```js
{
  length: number,           // event count in the cascade
  faction: string,          // human-readable faction name from factions enum
  factionIndex: number,     // 0=Bugs, 1=Cyborgs, 2=Illuminate
  season: number,           // attached by getCascadeLeaderboard
  regions: number[],        // region numbers in cascade order
  startTime: number,        // first event's start_time (Unix seconds)
  endTime: number,          // last event's end_time
  durationSec: number,      // endTime - startTime
  firstEvent: object,       // full event object
  lastEvent: object,        // full event object
  events: object[],         // full event objects in cascade order
}
```

### File layout

| File | Role |
|---|---|
| `src/shared/utils/game/seasonAnalytics.mjs` | **Modified.** Replace `findWorstCascade` with `findAllCascades(events, { minLength = 3 } = {})`. |
| `src/db/queries/getCascadeLeaderboard.mjs` | **New.** Server-side cross-season aggregation. React-cached. |
| `src/features/timeline/groupCascadesBySeason.mjs` | **New.** Mirror of `groupEventsByDay.mjs`. Groups + sorts. |
| `src/features/timeline/CascadeLog.jsx` | **New.** `'use client'`. Shell mirroring `EventLog.jsx`. Renders nothing when `cascades.length === 0`. Takes optional `lede` prop. |
| `src/features/timeline/CascadeLogCard.jsx` | **New.** Single-cascade card. Chain rendering is its only unique element. |
| `src/features/timeline/CascadeLogSortToggle.jsx` | **New.** Mirror of `EventLogSortToggle`. Same `Button` primitive; values `'worst' \| 'recent'`; icon and aria-label adapt to current state. |
| `src/features/timeline/useCascadeLogSort.mjs` | **New.** Mirror of `useEventLogSort`. Persists `'worst' \| 'recent'` via `usePersistedState` under `CASCADE_SORT_ORDER_KEY`. |
| `src/shared/preferences/sortOrder.mjs` | **Modified.** Export new `CASCADE_SORT_ORDER_KEY` constant alongside the existing `SORT_ORDER_KEY`. |
| `src/features/stats/generateCascadeLede.mjs` | **New.** Pure function. Builds the lede sentence for the `/stats` page. |
| `src/features/timeline/EventLog.css` | **Modified.** Add `.event-log-card-chain` class. Existing classes (`event-log-day`, `event-log-day-header`, etc.) reused unchanged. |
| `src/features/archives/ArchiveStats.jsx` | **Modified.** Remove `WORST_CASCADE` card + `findWorstCascade` import. |
| `src/app/stats/page.jsx` | **Modified.** Insert `<section>` between War Outcomes and All-Time Records. |
| `src/app/archives/page.jsx` | **Modified.** Render `<CascadeLog cascades={cascadesForSeason} />` below the StatGrid. |

### Algorithm — `findAllCascades`

```js
import { EVENT_TYPE, EVENT_STATUS } from '@/shared/enums/events.mjs';
import factions from '@/shared/enums/factions.mjs';

const MAX_GAP_SEC = 3600; // 1 hour

/**
 * Return every cascade in the event set, sorted by length DESC,
 * then speed (regions/hour) DESC, then end_time DESC.
 *
 * @param {Array} events - h1_event records (any types, any statuses)
 * @param {object} [opts]
 * @param {number} [opts.minLength=3] - Minimum cascade length to qualify
 * @returns {Array<object>}
 */
export function findAllCascades(events, { minLength = 3 } = {}) {
  if (!events?.length) return [];

  const failedDefends = events
    .filter((e) => e.type === EVENT_TYPE.DEFEND && e.status === EVENT_STATUS.FAIL)
    .sort((a, b) => a.end_time - b.end_time);

  if (failedDefends.length < minLength) return [];

  // Walk each faction independently. A break (region not strictly less,
  // or gap > MAX_GAP_SEC) closes the current cascade. Closed cascades of
  // length >= minLength are emitted.
  const cascades = [];
  const open = new Map(); // factionIndex -> { events: [] }

  for (const e of failedDefends) {
    const cur = open.get(e.enemy);
    if (cur) {
      const last = cur.events[cur.events.length - 1];
      const sameFaction = true; // grouping enforces this
      const decreasing = e.region < last.region;
      const inWindow = e.start_time - last.end_time <= MAX_GAP_SEC;
      if (sameFaction && decreasing && inWindow) {
        cur.events.push(e);
        continue;
      }
      if (cur.events.length >= minLength) cascades.push(emit(cur));
      open.set(e.enemy, { events: [e] });
    } else {
      open.set(e.enemy, { events: [e] });
    }
  }
  for (const cur of open.values()) {
    if (cur.events.length >= minLength) cascades.push(emit(cur));
  }

  cascades.sort(compareCascades);
  return cascades;
}

function emit({ events }) {
  const first = events[0];
  const last = events[events.length - 1];
  return {
    length: events.length,
    factionIndex: first.enemy,
    faction: factions[first.enemy]?.name ?? 'Unknown',
    regions: events.map((e) => e.region),
    startTime: first.start_time,
    endTime: last.end_time,
    durationSec: last.end_time - first.start_time,
    firstEvent: first,
    lastEvent: last,
    events,
  };
}

function compareCascades(a, b) {
  if (b.length !== a.length) return b.length - a.length;
  // Speed = regions / hour. Higher speed first.
  const aSpeed = a.length / (a.durationSec / 3600);
  const bSpeed = b.length / (b.durationSec / 3600);
  if (bSpeed !== aSpeed) return bSpeed - aSpeed;
  return b.endTime - a.endTime;
}
```

`findWorstCascade` is removed. The single existing call site (`ArchiveStats.jsx`) is also removed in the same change. The previous unit tests are rewritten against the new function.

### Server query — `getCascadeLeaderboard`

```js
import { cache } from 'react';
import prisma from '@/db/prisma.mjs';
import { findAllCascades } from '@/shared/utils/game/seasonAnalytics.mjs';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';

export const getCascadeLeaderboard = cache(async () => {
  const { data: events, error } = await tryCatch(
    prisma.h1_event.findMany({
      where: { type: 'defend', status: 'fail' },
      select: {
        season: true, type: true, status: true, enemy: true,
        region: true, start_time: true, end_time: true, event_id: true,
      },
      orderBy: [{ season: 'asc' }, { end_time: 'asc' }],
    }),
  );
  if (error || !events) return [];

  const bySeason = Map.groupBy(events, (e) => e.season);
  const all = [];
  for (const [season, seasonEvents] of bySeason) {
    for (const cascade of findAllCascades(seasonEvents, { minLength: 3 })) {
      all.push({ season, ...cascade });
    }
  }
  all.sort(compareCascadesForLeaderboard); // length DESC, speed DESC, season DESC
  return all;
});
```

Indexes used: `h1_event @@index([season, status])` matches the `type + status` filter shape closely enough that Postgres picks the index plan. With ~10k failed defends across the dataset (200 seasons × ~50 defend events × ~50% failure rate), the query is well within latency budget.

`/archives` does not need a new server query — its existing data fetch already loads the season's events. It calls `findAllCascades(events)` directly to produce the cascade list for `<CascadeLog>`.

### Components

#### `<CascadeLog cascades={Cascade[]} lede?={string} title?={string} id?={string} initialSortOrder?={'worst' | 'recent'}>`

Mirror of `EventLog.jsx`. Required prop: `cascades` (already includes `season` per item — output of `getCascadeLeaderboard` or `findAllCascades(events)` mapped through `{season, ...c}`). Optional `lede` is rendered only when provided — `/stats` passes a generated sentence; `/archives` omits the prop because a single-season lede would be redundant.

The component renders its own `<section>` (matching `EventLog`), so the parent page does NOT wrap it in another `<section>` element. This is a slight visual inconsistency with the sibling sections on `/stats` (which the page wraps in `<section className="flex flex-col gap-2">`), but it keeps the cascade log internally identical to the dashboard event log.

```jsx
'use client';

export default function CascadeLog({
  cascades,
  lede,
  title = 'Cascade Failures',
  id = 'cascade',
  initialSortOrder,
}) {
  const [sortOrder, toggleSortOrder] = useCascadeLogSort(initialSortOrder);
  if (!cascades?.length) return null;
  const groups = groupCascadesBySeason(cascades, { sortOrder });

  return (
    <section id={id} className="event-log-section">
      <div className="event-log-content">
        <div className="event-log-header">
          <h2 className="event-log-heading">{title}</h2>
          <CascadeLogSortToggle sortOrder={sortOrder} onToggle={toggleSortOrder} />
        </div>
        {lede && <p className="event-log-lede text-text-muted">{lede}</p>}
        <div className="event-log-days">
          {groups.map((group) => (
            <Fragment key={group.season}>
              <div className="event-log-day">
                <div className="event-log-day-header">
                  <span className="event-log-day-label">Season {group.season}</span>
                  <span className="event-log-day-summary">
                    {group.cascades.length} cascade{group.cascades.length === 1 ? '' : 's'}
                    {group.outcome ? ` · ${group.outcome}` : ''}
                  </span>
                </div>
                <div className="event-log-day-grid">
                  {group.cascades.map((c, i) => (
                    <CascadeLogCard key={`${group.season}-${c.startTime}-${i}`} cascade={c} />
                  ))}
                </div>
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
```

#### `<CascadeLogCard cascade={Cascade}>`

Renders one cascade. Composition:

- **Title row:** faction icon (existing `factions[i].icon` via `next/image`) + `Defend cascade · N regions` + duration pill on the right.
- **Time line:** `Started <abs date> — Ended <abs date>` — reuses `timeFormat='absolute'` semantics from `EventLogCard`.
- **Chain line:** `regions.join(' → ')` colored by faction. Renders inside `.event-log-card-chain`.

The card is wrapped in `<Link href={`/archives?season=${season}#cascade`} data-umami-event="cascade-card-click">` for navigation + analytics.

#### `groupCascadesBySeason(cascades, { sortOrder })`

```js
/**
 * Group cascades by season.
 *
 * @param {Cascade[]} cascades - Cascades from getCascadeLeaderboard or findAllCascades
 * @param {object} [opts]
 * @param {'worst' | 'recent'} [opts.sortOrder='worst']
 * @returns {Array<{ season: number, cascades: Cascade[], outcome?: string }>}
 */
```

For `sortOrder='worst'`: group order keyed by each group's worst cascade's rank (length DESC, speed DESC). Cascades within a group share the same order.

For `sortOrder='recent'`: group order by `season` DESC. Cascades within a group by `endTime` DESC.

If a per-season `outcome` string (`'Victory'` / `'Defeat'` / `null`) is desired in the header, the group helper can take a `getSeasonOutcome(season)` lookup — but for v1 we can compute outcome up front and attach it via a prop on each cascade (cheaper than threading a callback). Decision deferred to implementation; see Open Questions.

### Lede generation

Lives in `src/features/stats/generateCascadeLede.mjs`. Pure, deterministic, server-callable. The lede is built by the `/stats` page and passed to `CascadeLog` as a `lede` prop; `/archives` does not call this helper (single-season view doesn't need a cross-season summary).

```js
import { formatCompactDuration } from '@/shared/utils/format/formatCompactDuration.mjs';

export function generateCascadeLede(cascades, seasonsCount) {
  if (!cascades?.length) return null;
  const worst = cascades[0];
  const reachedHome = worst.regions.at(-1) === 0 || worst.regions.at(-1) === 11;
  const verb = reachedHome
    ? 'pushed all the way home'
    : `swept ${worst.length} regions in ${formatCompactDuration(worst.durationSec)}`;
  return (
    `${cascades.length} cascade${cascades.length === 1 ? '' : 's'} ` +
    `across ${seasonsCount} war${seasonsCount === 1 ? '' : 's'}. ` +
    `Worst: season ${worst.season}, where the ${worst.faction} ${verb}.`
  );
}
```

### Lifecycle and analytics

- `CascadeLog` is `'use client'` because of the sort toggle. Initial render is server-side; the parent page reads the persisted preference and passes it as `initialSortOrder` to avoid hydration mismatch (same pattern `EventLog` uses for `initialSortOrder`).
- `CascadeLogCard` is server-rendered (passed as children of the client `CascadeLog`).
- Sort toggle click: `data-umami-event="cascade-log-sort-toggle"` on the new `CascadeLogSortToggle` button.
- Card click (anchor navigation): `data-umami-event="cascade-card-click"`. No payload.

## Data flow

```
/stats page (server)
  │
  ├── await getCascadeLeaderboard()           ─► Cascade[]  (all cascades, ranked)
  ├── await getCrossSeasonStats()             ─► used for seasonsCount
  ├── const lede = generateCascadeLede(cascades, seasons.length)
  ├── const initialSortOrder = readCookie(CASCADE_SORT_ORDER_KEY) ?? 'worst'
  │
  └── <CascadeLog
         cascades={cascades}
         lede={lede}
         initialSortOrder={initialSortOrder}
      />
          │
          ├── useCascadeLogSort(initialSortOrder) ── persisted sort state
          ├── groupCascadesBySeason(cascades, { sortOrder }) ─► group[]
          │
          └── For each group, render header + grid of <CascadeLogCard /> per cascade

/archives?season=N page (server)
  │
  ├── await getArchiveData(season)            ─► includes events
  ├── const cascades = findAllCascades(events).map(c => ({ season, ...c }))
  ├── const initialSortOrder = readCookie(CASCADE_SORT_ORDER_KEY) ?? 'worst'
  │
  └── <CascadeLog
         cascades={cascades}
         initialSortOrder={initialSortOrder}
      />   // no `lede` prop — single-season view skips the cross-season summary
```

## Error handling

- `getCascadeLeaderboard` wraps the Prisma call in `tryCatch`. On DB error, returns `[]` — the section skips itself, page still renders.
- `findAllCascades` returns `[]` for any falsy/empty input. Never throws.
- `generateLede` returns `null` for empty input. `CascadeLog` skips rendering the `<p>` when null.
- `CascadeLogCard` receives a fully-resolved `cascade` object; no defensive nulls beyond optional chaining for the faction icon.

No `try/catch` blocks. All async paths go through `tryCatch`.

## Performance

- **One DB query** for the entire leaderboard. ~10k rows, indexed.
- **React cache()** dedupes within a single request — multiple components on `/stats` calling `getCascadeLeaderboard` only hit Postgres once.
- **`findAllCascades` is O(n log n)** on the failed-defend subset per season. Worst-case ~50 events/season, so the per-season cost is negligible.
- **`CascadeLog` render cost** is proportional to the number of season groups + cards. Even with 50 groups × 2 cards = 100 cards rendered, this is well below any meaningful frame budget.
- Bundle impact: ~3-5 KB minified (one new client component shell, one card component, one grouping helper, lede helper). No new libraries.

## Removed / changed files

| File | Action | Detail |
|---|---|---|
| `src/shared/utils/game/seasonAnalytics.mjs` | Modified | `findWorstCascade` deleted, `findAllCascades` added. Test file rewritten. |
| `src/features/archives/ArchiveStats.jsx` | Modified | `WORST_CASCADE` `<StatCard>` removed. `findWorstCascade` import removed. `factions` import stays (used by other cards). |
| `src/db/queries/getCascadeLeaderboard.mjs` | Added | New server query. |
| `src/features/timeline/groupCascadesBySeason.mjs` | Added | New grouping helper. |
| `src/features/timeline/CascadeLog.jsx` | Added | New client component. |
| `src/features/timeline/CascadeLogCard.jsx` | Added | New server component (rendered as child of CascadeLog). |
| `src/features/timeline/CascadeLogSortToggle.jsx` | Added | New toggle (mirror of `EventLogSortToggle`). |
| `src/features/timeline/useCascadeLogSort.mjs` | Added | New persisted-sort hook (mirror of `useEventLogSort`). |
| `src/shared/preferences/sortOrder.mjs` | Modified | New `CASCADE_SORT_ORDER_KEY` constant. |
| `src/features/stats/generateCascadeLede.mjs` | Added | New lede helper. |
| `src/features/timeline/EventLog.css` | Modified | New `.event-log-card-chain` and `.event-log-lede` classes added; existing classes untouched. |
| `src/app/stats/page.jsx` | Modified | New `<section>` inserted between War Outcomes and All-Time Records. |
| `src/app/archives/page.jsx` | Modified | `<CascadeLog>` rendered below the StatGrid when cascades exist for the season. |
| `src/__tests__/unit/shared/utils/game/seasonAnalytics.test.mjs` | Modified | Replaces `findWorstCascade` cases with `findAllCascades` cases. |
| `src/__tests__/unit/features/archives/ArchiveStats.test.jsx` | Modified | `WORST_CASCADE` assertions removed. |
| `src/__tests__/unit/features/timeline/groupCascadesBySeason.test.mjs` | Added | New. |
| `src/__tests__/unit/features/timeline/CascadeLog.test.jsx` | Added | New. |
| `src/__tests__/unit/features/timeline/CascadeLogCard.test.jsx` | Added | New. |

## Testing strategy

### Unit tests (Vitest)

1. **`seasonAnalytics.test.mjs`** — rewritten:
   - Empty input → `[]`.
   - No failed defends → `[]`.
   - Single failed defend → `[]` (below minLength).
   - Two failed defends, strictly decreasing region, in window → `[]` (below minLength=3).
   - Three failed defends, strictly decreasing region, in window → 1 cascade of length 3.
   - Three failed defends with a 2h gap → `[]` (gap exceeds 1h, cascade resets to length 1).
   - Three failed defends, region plateau (e.g. 5,5,4) → `[]` (plateau breaks cascade).
   - Two factions interleaved → independent cascades, both returned if qualifying.
   - Sort tiebreaker: length tie → faster cascade ranks higher.
   - Sort tiebreaker: length+speed tie → later `endTime` ranks higher.
   - Custom `minLength` parameter respected.

2. **`getCascadeLeaderboard.test.mjs`** (new):
   - Mock Prisma `findMany`. Verify `where: { type: 'defend', status: 'fail' }` filter.
   - Multiple seasons → cascades from each are merged and globally sorted.
   - DB throws → returns `[]` (tryCatch swallows).
   - Empty DB → returns `[]`.

3. **`groupCascadesBySeason.test.mjs`** (new):
   - Empty input → `[]`.
   - `sortOrder='worst'`: groups ordered by worst cascade.
   - `sortOrder='recent'`: groups ordered by season DESC, cascades within by endTime DESC.
   - Multi-cascade season: cascades stay grouped together.

4. **`CascadeLog.test.jsx`** (new) — RTL:
   - `cascades=[]` → returns null.
   - Renders heading and sort toggle.
   - Renders lede when present.
   - Renders one group per season.
   - Sort toggle click flips group order (uses real `useEventLogSort` with localStorage stub).

5. **`CascadeLogCard.test.jsx`** (new) — RTL:
   - Renders title, duration pill, time line, chain.
   - Anchor href is `/archives?season=N#cascade`.
   - `data-umami-event="cascade-card-click"` present.
   - Faction-colored chain (asserts class).

6. **`ArchiveStats.test.jsx`** (modified):
   - Remove all `WORST_CASCADE` assertions.

### Integration

No new Playwright tests. The existing `/stats` and `/archives` e2e smoke tests will catch render regressions.

### Manual QA checklist (PR review only)

- `/stats` shows the section between War Outcomes and All-Time Records.
- Sort toggle persists across reload.
- A multi-cascade season renders multiple cards in one group.
- A season with no cascades does not render a group.
- Clicking a card navigates to `/archives?season=N`, scrolled to the cascade section.
- `/archives?season=N` renders the cascade section only when cascades exist.
- Cards' chain lines wrap gracefully at narrow widths (overflow-x or wrap, not clipped).
- `WORST_CASCADE` StatCard is gone from `/archives`.

## Risks accepted

- **Behavior change for `findWorstCascade` callers.** The function is removed entirely. Existing test cases that assumed length-2 cascades with arbitrary time gaps are rewritten — some seasons that previously showed a cascade may no longer have one. This is intentional (rigorous detection > back-compat), but it is a user-visible change for any frequent `/archives` visitor.
- **Lede sentence template is fixed.** Two variants (reached-home vs swept-N-in-X) cover the cases I expect, but a user inspecting the lede on every page load may notice the pattern. Acceptable for v1.
- **The cascade log renders its own `<section>` (matching `EventLog`)**, while sibling sections on `/stats` are wrapped in `<section className="flex flex-col gap-2">` by the page itself. This is a small structural inconsistency vs. the rest of `/stats`. Trade-off chosen to keep `CascadeLog` internally identical to `EventLog` for maximum reuse — if it grates in practice, a future refactor can normalize either direction.

## Open questions

- **Per-season outcome in the group header summary** ("1 cascade · Defeat"). The cleanest implementation is to attach `outcome` (from `getWarOutcome` or equivalent) to each cascade in `getCascadeLeaderboard` so the grouping helper can read it directly. For `/archives` we already have the data via the page's existing fetch. To be confirmed in writing-plans; design assumes the cleanest option (attach in the server query).
