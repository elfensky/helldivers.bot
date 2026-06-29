# Cascade → Event Log deep-linking — Design Spec

- **Date:** 2026-06-27
- **Status:** Approved design (pre-implementation)
- **Area:** Archives (`/archives`) — cascade cards + event log
- **Verification:** Design corrected by a 5-way model debate and grounded against the code by a 4-agent investigation. Every file:line below is code-verified.

## Problem

The archives page shows a **Cascade Log** (runs of 4+ consecutive failed *defend* events for one faction) above a scroll-synced **Event Log**. Today a cascade card is a `<Link href="/archives?season=N#cascade">` ([CascadeLogCard.jsx:20-21](../../../src/features/timeline/CascadeLogCard.jsx#L20-L21)) that only scrolls to the cascade *section* — it does not connect a cascade to its events in the log. A user reading "Bugs took regions 6→5→4→3" has no way to jump to those specific events.

## Goal / user-facing behavior

Clicking a cascade card:

1. **Scrolls** the event log to that cascade.
2. **Persistently highlights every event in the cascade** (the whole collapse), visually distinct from the existing scroll-selection. The highlight stays until the user clicks another cascade or scrolls away.
3. Is **shareable** — the URL carries a hash so the view can be linked/bookmarked and reached from another page or a direct load.

These three behaviors were chosen with the user during brainstorming (highlight the *whole range*; *persistent* until next interaction; *hash-based* for shareability).

## Why the obvious approach does not work

The naive plan — "add `id` attributes, point the href at the event, let the browser scroll natively, read `hashchange` to highlight" — fails on four independently-verified counts. A 5-way debate (Gemini, Codex, Copilot, Sonnet, Opus) caught all four:

| # | Constraint (code-verified) | Consequence |
|---|---|---|
| B | CascadeLogCard is a `next/link` `<Link>` ([:20](../../../src/features/timeline/CascadeLogCard.jsx#L20)); the App Router intercepts the click and commits via `history.pushState`. | The native **`hashchange` event never fires** on same-page Link navigation — a `hashchange`-only highlight trigger silently no-ops on the most common path. |
| C | `useScrollEvent` updates `selectedEvent` on every scroll frame to the card nearest a 38–62% viewport anchor ([useScrollEvent.mjs:23-111](../../../src/shared/hooks/useScrollEvent.mjs)). | A single-selection highlight would be overwritten the instant the page scrolls. The fix is to make the cascade highlight a **separate layer**, decoupled from `isSelected`. |
| D | The event sort comparator is on `start_time` ([groupEventsByDay.mjs:21-24](../../../src/features/timeline/groupEventsByDay.mjs#L21-L24)); default is `desc` ([sortOrder.mjs:2](../../../src/shared/preferences/sortOrder.mjs#L2)); **`sortOrder` is local state inside EventLog** ([EventLog.jsx:46](../../../src/features/timeline/EventLog.jsx#L46)), not visible to siblings or the href. | A *static* href cannot know which cascade event is topmost — and it flips when the user toggles sort. The topmost event must be found at click time by **querying the DOM**, which is sort-agnostic. |
| A | Native cross-page hash scroll is unreliable (hydration timing + Next scroll-restoration). | Scrolling must be an explicit JS `scrollIntoView`, run from a mount effect on direct/external loads. |

**Conclusion:** scrolling and highlighting must be JS-driven. The hash is kept purely for shareability and as the trigger for direct/external loads — not for native scroll.

## Architecture

All logic lives client-side in `ArchivesClient` ([:1 `'use client'`](../../../src/features/archives/ArchivesClient.jsx#L1)), which already owns both the `cascades` array (computed at [:84-87](../../../src/features/archives/ArchivesClient.jsx#L84-L87)) and the `<EventLog>` render ([:178-195](../../../src/features/archives/ArchivesClient.jsx#L178-L195)). CascadeLog and EventLog are on the **same page**, so a cascade click is an in-page interaction.

There are two entry points that funnel into one `pinCascade(cascade)`:

- **Same-page click** → the card's `onClick` calls `onSelectCascade(cascade)` (threaded ArchivesClient → CascadeLog → CascadeLogCard). It already holds the full cascade object incl. `events[]`, so no hash parsing is needed.
- **Direct / external / back-forward load** → a mount `useEffect` that (a) **synchronously** reads `location.hash`, strips the leading `#` (`location.hash.slice(1)`), resolves it via `findCascadeByEventKey(cascades, key)`, and calls `pinCascade` if found; and (b) registers `hashchange` (manual/external hash edits) and `popstate` (browser back/forward) listeners doing the same, with a cleanup that removes both. Effect deps: `[cascades]`. A Next `<Link>` same-page click fires *neither* event — that path is the `onClick` above, so the two together cover every case.

```
                     ┌─────────────── ArchivesClient (use client) ───────────────┐
 cascade card click ─┤ onSelectCascade(cascade) ─┐                                │
                     │                            ├─► pinCascade(cascade):        │
 mount / hashchange ─┤ findCascadeByEventKey ─────┘   1. setHighlightedKeys(Set)  │
   (location.hash)   │                                2. scroll topmost-in-DOM    │
                     │                                                            │
                     │ highlightedKeys ─► <EventLog highlightedKeys> ─► EventLogCard isHighlighted (faction tint)
                     │ wheel/touchmove (one-shot) ─► clear highlightedKeys (scroll-away dismiss)
                     └────────────────────────────────────────────────────────────┘
```

### `pinCascade(cascade)`

1. `const keys = new Set(cascade.events.map(eventKey))` — the highlight set. (`cascade.events` confirmed present; `eventKey` = `` `${event.type}-${event.event_id}` `` from [eventKey.mjs](../../../src/shared/utils/game/eventKey.mjs).)
2. `setHighlightedKeys(keys)` — drives the tint.
3. Scroll to the topmost highlighted card in the current DOM order: within `railRef.current`, query every `[data-event-key]` whose key is in `keys`, choose the element with the smallest `getBoundingClientRect().top`, and call `el.scrollIntoView({ block: 'start', behavior: 'smooth' })` on it. **Sort-agnostic** — reads actual DOM order, so it is correct under both `desc` and `asc` without knowing EventLog's local sort. Wrap the query+scroll in a **double `requestAnimationFrame`** so layout has settled (the `.event-log-day` children use `content-visibility: auto`, [EventLog.css:43-46](../../../src/features/timeline/EventLog.css#L43-L46); `scrollIntoView` handles that natively, but the mount-load path needs a painted frame before measuring).

### Highlight is decoupled (resolves C)

The cascade highlight is a **new `highlightedKeys: Set<string>` prop** on EventLog, independent of `selectedEventKey`. `useScrollEvent` keeps syncing the map/`isSelected` by scroll position as it always has — after a pin it lands on some event *within* the highlighted cascade, which reads as "you are here inside this collapse." No guard ref needed.

### Dismiss (scroll-away)

On pin, arm a **self-removing** `wheel`+`touchmove` listener — but attach it *after* the smooth scroll has started (on a short `setTimeout`/`scrollend`, not synchronously) so the programmatic scroll and macOS inertial fling don't dismiss the highlight before the user sees it. The first such event calls `setHighlightedKeys(null)` and removes both listeners. Programmatic `scrollIntoView({behavior:'smooth'})` emits `scroll` but **not** `wheel`/`touch`, so it never self-dismisses. Each `pinCascade` re-arms the listener; clicking another cascade replaces the set.

## Component-by-component changes

1. **[ArchivesClient.jsx](../../../src/features/archives/ArchivesClient.jsx)** — add `highlightedKeys` state (`Set<string> | null`); `pinCascade(cascade)`; the mount `useEffect` (sync hash read via `location.hash.slice(1)` + `hashchange`/`popstate` listeners with cleanup, deps `[cascades]`); the self-removing scroll-away listener. Import `findCascadeByEventKey` from `@/shared/utils/game/findCascadeByEventKey.mjs`. Pass `onSelectCascade={pinCascade}` to CascadeLog and `highlightedKeys={highlightedKeys}` to EventLog ([:171-173](../../../src/features/archives/ArchivesClient.jsx#L171-L173), [:178-195](../../../src/features/archives/ArchivesClient.jsx#L178-L195)).
2. **[CascadeLog.jsx](../../../src/features/timeline/CascadeLog.jsx)** — thread `onSelectCascade` through to each `<CascadeLogCard>` ([:66-71](../../../src/features/timeline/CascadeLog.jsx#L66-L71)).
3. **[CascadeLogCard.jsx](../../../src/features/timeline/CascadeLogCard.jsx)** — accept a new `onSelectCascade` prop; change the href hash from `#cascade` to `` `#${eventKey(cascade.lastEvent)}` ``  (a stable, shareable anchor); add `onClick={() => onSelectCascade(cascade)}` directly on the existing `<Link>` (don't wrap in a second anchor). Keep the existing `data-umami-event="cascade-card-click"` ([:22](../../../src/features/timeline/CascadeLogCard.jsx#L22)) — it already tracks the click; no new event needed.
4. **[EventLog.jsx](../../../src/features/timeline/EventLog.jsx)** — accept `highlightedKeys = null`; on the per-event wrapper ([:98-101](../../../src/features/timeline/EventLog.jsx#L98-L101)) add `data-faction={String(event.enemy)}` (the faction index, already in scope) and pass `isHighlighted={highlightedKeys?.has(key) ?? false}` to EventLogCard. **No `id` attribute needed** — the existing `data-event-key` is the scroll query target.
5. **[EventLogCard.jsx](../../../src/features/timeline/EventLogCard.jsx)** — add an independent `isHighlighted = false` prop; apply the faction-tint class **in addition to** (not replacing) the existing `isSelected` style at [:52](../../../src/features/timeline/EventLogCard.jsx#L52), so a card can be both selected (yellow `border-l-primary`) and highlighted (faction underlay) at once. Compose the classes (template literal / array-join), not a single either/or ternary.
6. **CSS** ([EventLog.css](../../../src/features/timeline/EventLog.css)) — add `scroll-margin-top` on the per-event wrapper (`.event-log-day-grid > div`) to clear the fixed site header (header is `50px` on mobile / `80px` at `sm:`, i.e. `h-[50px] sm:h-[80px]`, so use `80px`, optionally a mobile `@media` override), and a faction-tint highlight rule gated on the highlighted wrapper, reusing the `--color-faction-*-fill` (rgba 0.35) tokens keyed by `data-faction`, following the convention at [EventLog.css:192-194](../../../src/features/timeline/EventLog.css#L192-L194).
7. **New helper** `src/shared/utils/game/findCascadeByEventKey.mjs` — `findCascadeByEventKey(cascades, key)` returns the cascade whose `events` contains an event with matching `eventKey`, else `null`.

## Data contracts

- **Cascade object** (verified, [seasonAnalytics.mjs:63-78](../../../src/shared/utils/game/seasonAnalytics.mjs#L63-L78) + season merge at [ArchivesClient.jsx:85](../../../src/features/archives/ArchivesClient.jsx#L85)): `{ length, factionIndex, faction, regions[], startTime, endTime, durationSec, firstEvent, lastEvent, events[], season }`. Each entry in `events` (and `firstEvent`/`lastEvent`) is a **full `h1_event` record** — same shape as the main `events[]` — so `type`, `event_id`, `enemy` (faction index), `start_time`, `status`, etc. are all present. `eventKey` uses `type`+`event_id`; EventLog reads `event.enemy` for the tint.
- **`findCascadeByEventKey(cascades, key) → cascade | null`** — pure; matches against each cascade's `events`.

## Styling

- Highlight tint: faction-fill at 35% alpha (`--color-faction-bugs-fill` `rgba(232,130,42,.35)`, `-cyborgs-fill` `rgba(139,45,45,.35)`, `-illuminate-fill` `rgba(126,200,227,.35)`) keyed off `data-faction` on the highlighted wrapper — matching the cascade card's own faction convention.
- Must remain distinct from `isSelected` (yellow `border-l-primary` + `!bg-primary-tint`). A highlighted *and* selected card shows both (faction underlay + yellow left border) — intended "this cascade, and here's your position in it."

## Edge cases

- **Re-clicking the same cascade** — `onClick` re-pins and re-scrolls every time (the hash-only approach could not; `onClick` can).
- **Cascade with one off-screen tail** — `scrollIntoView` on the topmost member brings the start into view; the rest flows below in `desc` (or is already above in `asc`).
- **Sort toggled after pin** — highlight set is by key, so it survives a re-sort; only DOM positions change.
- **Hash points at a season with no such cascade** — `findCascadeByEventKey` returns `null`; no-op.
- **No cascades on the page** — CascadeLog is not rendered ([conditional :171](../../../src/features/archives/ArchivesClient.jsx#L171)); the mount hash path simply finds nothing.

## Implementation gotchas (must-not-miss)

1. **Strip the `#`.** `location.hash` is `"#defend-123"`; match with `findCascadeByEventKey(cascades, location.hash.slice(1))`. Forgetting `.slice(1)` makes every hash lookup silently miss.
2. **A Next `<Link>` same-page click fires neither `hashchange` nor `popstate`.** Same-page highlighting comes from the card's `onClick`; the listeners only cover direct loads, manual hash edits, and back/forward.
3. **Measure after paint.** Double-`requestAnimationFrame` before reading `getBoundingClientRect()` / calling `scrollIntoView`, especially on the mount-load path (`content-visibility: auto` on day groups).
4. **Don't dismiss too early.** Arm the `wheel`/`touchmove` dismiss *after* the scroll settles, and make it self-removing — otherwise inertial or programmatic scrolling clears the highlight before it's seen.
5. **Faction tint source is `event.enemy`**, surfaced as `data-faction` on the wrapper; values `0/1/2` match the existing cascade-card convention.

## Testing

- **Unit (pure):** `findCascadeByEventKey` — match by middle/first/last event, no-match returns `null`. Mirror [seasonAnalytics.test.mjs](../../../src/__tests__/unit/shared/utils/game/seasonAnalytics.test.mjs).
- **Component (RTL/jsdom):** EventLog passes `isHighlighted` to the correct cards given a `highlightedKeys` Set; EventLogCard renders the faction-tint class when `isHighlighted`. CascadeLogCard href ends with `#${eventKey(cascade.lastEvent)}` and fires `onSelectCascade` on click. Mirror [EventLogCard.test.jsx](../../../src/__tests__/unit/features/timeline/EventLogCard.test.jsx).
- **DevTools (required by CLAUDE.md):** after building, verify via Chrome DevTools MCP that a click pins the tint on all cascade events, scrolls correctly under both sort directions, the header doesn't cover the target (`scroll-margin-top`), and a wheel-scroll clears the tint.

## Out of scope / deliberate simplifications (ponytail)

- **No `isProgrammaticScroll` guard ref.** Decoupling the highlight from `isSelected` makes the map-follows-scroll behavior acceptable. If DevTools verification shows the map landing mid-cascade feels wrong, add the guard ref in a follow-up to suppress scroll-sync until the smooth scroll completes.
- **No `id` attributes** on event wrappers — reuse `data-event-key`.
- **No new Umami event** — the existing `cascade-card-click` already fires.
- **No change to how cascades are computed or sorted.**

## Open risks to verify during implementation

1. **Next scroll-restoration vs. our mount-effect scroll** on direct hash loads — if Next resets to top after our scroll, defer with a double-`requestAnimationFrame`. Verify in DevTools.
2. **`scroll-margin-top` value** — depends on the actual sticky-header height at the breakpoint; measure, don't guess.

## Scope

~6 files touched (ArchivesClient, CascadeLog, CascadeLogCard, EventLog, EventLogCard) + 1 CSS block + 1 new pure helper + tests. A feature-sized change → feature branch + worktree per the project Git workflow.
