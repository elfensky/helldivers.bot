# Phase 9: Timeline Visual Redesign

> **PARTIALLY SUPERSEDED** — This spec was partially superseded by the timeline refinement. Specifically:
> - Snap scroll was removed -- now normal page flow with smooth-scroll button
> - WarSummary was deleted -- replaced by WON/LOST stat cards in StatGrid
> - Sidebar scroll and sticky map were removed -- sidebar and map are now static grid children in a unified layout
> - Map sizing changed from `max-h-[85vh]` to viewport-height-derived grid column (`minmax(0, calc((100dvh - 80px) * 806.93 / 868.81))`)
> - The TimelineSection, Event compact variant, date grouping, and vertical rail from this spec are still in use
>
> See `docs/superpowers/specs/2026-03-30-timeline-refinement-design.md` for the current design.

**Issue:** #165
**Date:** 2026-03-30
**Status:** Partially superseded -- see 2026-03-30-timeline-refinement-design.md

## Summary

Redesign the event timeline from a flat card list inside the sidebar to a full-width visual timeline section below the dashboard. Desktop uses snap scroll for clean screen transitions. Events are grouped by day with a vertical rail and color-coded markers. Active events show full detail; resolved events show a compact outcome card.

## Layout

### Desktop (lg:+): Snap Scroll

The page becomes two snap-scroll screens using `scroll-snap-type: y mandatory`:

- **Screen 1 — Dashboard**: Sidebar (campaigns, stats, war summary) + pinned map. Fills viewport height. Identical to the current desktop layout minus the timeline.
- **Screen 2 — Timeline**: Full-width event log with vertical rail, date grouping, and multi-column grid. Fills viewport height with internal scroll for overflow.

A subtle scroll hint ("↓ event log") appears at the bottom of screen 1.

### Mobile / Tablet (< lg:): Normal Scroll

No snap scroll — the timeline is a standard section below the dashboard content in the single-column flow. Users scroll past map → campaigns → stats → war summary → timeline.

## Sidebar Changes

The timeline moves out of the sidebar. A new **war summary row** replaces it at the bottom of the sidebar:

**Sidebar content order (lg:+):**

1. Campaigns (EventCards)
2. Stats (FactionTabs + StatGrid)
3. War Summary — compact win/loss counts for the current season (e.g., "3W / 2L")

**Mobile content order:**

1. Map
2. Campaigns
3. Stats
4. War Summary
5. Timeline section (below, normal scroll)

## Timeline Section

### Structure

```
<section class="timeline-section">         ← snap-scroll target at lg:
  <div class="timeline-content">           ← gutters, internal scroll if needed
    <h2>Event Log</h2>
    <div class="timeline-rail">            ← rail + event grid
      <div class="rail-line" />            ← vertical line with dot markers
      <div class="timeline-groups">        ← date-grouped events
        <div class="timeline-day">
          <h3>Today — March 30</h3>
          <div class="timeline-day-grid">  ← responsive multi-column
            <EventCard />
            <EventCard />
          </div>
        </div>
        <div class="timeline-day">
          <h3>Yesterday — March 29</h3>
          ...
        </div>
      </div>
    </div>
  </div>
</section>
```

### Vertical Rail

- Thin vertical line (1-2px) on the left side, spanning the full height of the timeline
- Square dot markers (matching 0px border-radius design system) at each event position
- Dot colors: green (`--color-success`) for won, red (`--color-danger`) for failed, primary (`--color-primary`) for active
- The rail connects to date group headers visually

### Date Grouping

- Events grouped by calendar day, sorted newest first
- Date headers: "TODAY", "YESTERDAY", or "MONTH DAY" (e.g., "MARCH 28")
- Headers are uppercase, muted color, small font — section dividers, not content

### Responsive Grid

| Breakpoint       | Columns     | Context                            |
| ---------------- | ----------- | ---------------------------------- |
| Mobile (< 640px) | 1 column    | Single column, full-width cards    |
| Tablet (640px+)  | 2 columns   | Side-by-side within each day group |
| Desktop (lg:+)   | 2-3 columns | Full-width section, more room      |

## Event Card Redesign

### Active Events (Full Detail)

Same content as current Event component:

- Status label + event type (e.g., "Active Defend Event")
- Faction icon
- Time remaining ("Due in 4h 23m")
- Progress bar (points / points_max)
- Point count with percentage
- Pace indicator if available
- Right-side accent line (6px), status background tinting

### Resolved Events (Compact)

Reduced card for completed events:

- Outcome + type (e.g., "Won Defend Event" / "Failed Defend Event")
- Faction icon
- Time elapsed ("Finished 11 hours ago")
- Final score as text (e.g., "3020 / 3020 (100%)")
- No progress bar — the outcome is what matters
- Right-side accent line, status background tinting (green/red based on outcome)

Both variants use the existing design patterns: CSS Grid with right accent line, surface layers, faction colors, 0px border-radius.

## Scroll Hint

At desktop (lg:+), a subtle visual hint at the bottom of screen 1 indicates there's more content below:

- Small downward arrow or text: "↓ event log"
- Muted color, fades or hides after first scroll
- No hint on mobile (timeline is just part of the natural scroll flow)

## Snap Scroll CSS

```css
/* Only at desktop where dashboard fits in one viewport */
@media (min-width: 1024px) {
    .snap-container {
        scroll-snap-type: y mandatory;
        overflow-y: auto;
        height: 100dvh;
    }

    .snap-screen {
        scroll-snap-align: start;
        height: 100dvh;
    }
}
```

The snap container wraps both the dashboard and the timeline section. Each is a snap target. On mobile, these classes have no effect — normal document flow.

## Page Layout Changes

### Desktop (lg:+)

The snap scroll container needs to be **above** the current dashboard grid in the DOM hierarchy. The structure becomes:

```
<div class="snap-container">          ← scroll-snap at lg:
  <div class="snap-screen">           ← screen 1: dashboard
    <div class="dashboard gutters">   ← existing grid layout
      alerts, updated, sidebar, map
    </div>
  </div>
  <div class="snap-screen">           ← screen 2: timeline
    <TimelineSection events={events} />
  </div>
</div>
```

### Footer

- At lg:+, the footer sits below the snap container (below screen 2). Since the snap container is 100dvh, the footer is off-screen unless the user scrolls past the timeline.
- The current `footer { display: none }` in page.css at lg: should be changed to `footer { display: block }` — the footer returns now that the page scrolls.

## Files to Modify

### New Files

- `src/components/h1/Timeline/TimelineSection.jsx` — timeline section with rail, date grouping, grid
- `src/components/h1/Timeline/TimelineSection.css` — rail styles, responsive grid, snap targets
- `src/components/h1/Timeline/WarSummary.jsx` — compact win/loss row for sidebar

### Modified Files

- `src/components/h1/Dashboard/DashboardClient.jsx` — remove timeline from sidebar, add WarSummary, wrap in snap container
- `src/components/h1/Dashboard/DashboardClient.css` — snap scroll styles at lg:, remove timeline-related sidebar styles
- `src/components/h1/Event/Event.jsx` — add compact variant prop for resolved events
- `src/components/h1/Event/Event.css` — compact variant styles
- `src/app/page.jsx` — pass events to TimelineSection
- `src/app/page.css` — restore footer at lg:, adjust main styles for snap scroll

### No Changes To

- Galaxy, Map, EventCard, StatGrid, FactionTabs — unchanged
- WarTimeline (archives page) — separate component, unaffected
- tokens.css, layout.css — no new design tokens needed

## Design Decisions

1. **Snap scroll over normal scroll**: Prevents awkward halfway states between dashboard and timeline. Each screen is intentional. Only at desktop where the dashboard fits in one viewport.
2. **Timeline out of sidebar**: Full-width section gives room for multi-column grid, progress bars on active events, and date grouping. The sidebar was too narrow for a proper timeline.
3. **War summary replaces timeline in sidebar**: Keeps the sidebar's "at a glance" role without the timeline bulk. Win/loss counts give the quick overview.
4. **Compact resolved cards**: Past events don't need progress bars — the outcome is what matters. Saves vertical space and focuses attention on what's important.
5. **Vertical rail at all breakpoints**: Horizontal timelines fight mouse scroll direction and compress event detail. Vertical is natural for scanning a log.

## Deferred

- **#159** — Timeline mobile carousel scroll: may be superseded by this redesign. Review after implementation.
- **#119** — Timeline playback controls: separate concern (archives WarTimeline), not affected.
- **#157** — Faction introduction order visualization: can be layered on top of this timeline later.
- **#156** — Show defeat faction on war loss: can use the new compact card variant.
