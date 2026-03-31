# Timeline Visual Polish — Design Spec

**Issues:** #165, #186
**Date:** 2026-03-31
**Status:** Design approved

## Summary

Redesign the timeline rail to fix the rail-dot alignment problem and add visual polish. The rail becomes responsive: on mobile, event card left borders form the rail (no separate column); on desktop, a dedicated rail column with circles, colored blocks, and a continuous line sits beside a multi-column card grid. Day labels gain visual hierarchy with W/L summaries. Spacing is refined for better day-group separation.

## Problem

The current rail has per-event dots in a column that doesn't align with per-day groups in the content column. The dots and days are visually disconnected — two independent lists that happen to sit beside each other.

## Design

### Mobile (< lg:): Per-Segment Colored Rail

Each event card's left border IS the rail. No separate rail column.

**Structure per day:**
```
<div class="timeline-day">
  <div class="timeline-day-header">    ← 4px grey left border
    <span>TODAY</span>
    <hr />                             ← 1px line extending right
    <span>1W / 1L</span>
  </div>
  <div class="timeline-day-events">
    <EventCard />                      ← 4px green/red left border
    <EventCard />                      ← 4px green/red left border
  </div>
</div>
```

- **Event cards:** Full width, single column. `border-left: 4px solid` colored by status (green/red/yellow). Cards keep existing right-side 4px accent line.
- **Day header:** `border-left: 4px solid var(--color-surface-3)` — grey border continues the rail through the header. Label is monospace, small, muted. W/L count right-aligned. A 1px horizontal rule spans between label and count.
- **Between events:** 2px gap (page background shows through — the "notch" between rail segments).
- **Between days:** Larger gap (1rem). The day header's grey border bridges it visually.
- **Rail reads as:** Colored segments (events) interrupted by grey segments (day headers). The stacked left borders form a continuous vertical rail.

### Desktop (lg:+): Circle + Side Line with Grid

A dedicated rail column sits to the left of the content.

**Structure per day:**
```
<div class="timeline-day">
  <div class="timeline-day-rail">      ← rail column (18px)
    <div class="rail-circle" />        ← 12px circle, on the line
    <div class="rail-block --success" /> ← 6x14px colored block
    <div class="rail-block --fail" />
    <div class="rail-connector" />     ← 2px line to next day
  </div>
  <div class="timeline-day-content">   ← content column (flex:1)
    <div class="timeline-day-header">
      <span>TODAY</span>
      <span>1W / 1L</span>
    </div>
    <div class="timeline-day-grid">    ← 2-3 column responsive grid
      <EventCard compact />
      <EventCard compact />
    </div>
  </div>
</div>
```

- **Continuous line:** 2px vertical line on the left edge, running top to bottom through all days. Color: `rgba(255,255,255,0.08)`.
- **Day circle:** 12px, `border: 2px solid rgba(255,255,255,0.35)`, `border-radius: 50%`, `background: #0d1117`. Sits centered on the line (overlaps it). Aligned vertically with the day label. **Note:** The circle intentionally breaks the 0px border-radius system — it marks temporal boundaries, not data elements.
- **Event blocks:** 6px wide × 14px tall, colored by status. Stacked vertically with 2px gaps, offset to the right of the line (~5px margin-left). One block per event.
- **Rail connector:** The 2px line continues between the last event block and the next day's circle.
- **Day label:** Monospace, 0.75rem, bold, `rgba(255,255,255,0.65)`. W/L summary in muted text beside it.
- **Event grid:** Responsive — 2 columns at lg:, 3 columns at xl:.

### Day Label Visual Hierarchy

Both mobile and desktop:
- Label text: `font-family: monospace`, `font-size: 0.75rem`, `font-weight: 700`, `color: rgba(255,255,255,0.65)`, `letter-spacing: 0.05em`, `text-transform: uppercase`
- W/L summary: `font-size: 0.6rem`, `color: rgba(255,255,255,0.25)`, monospace
- Labels: "TODAY", "YESTERDAY", or "MARCH 28" (existing `formatDayLabel` utility)

### Spacing

- Between events within a day: 2px gap (mobile border segments), 0.35rem gap (desktop card grid)
- Between day groups: 1.5rem (mobile), 2rem (desktop)
- Rail gap to content: 1rem (desktop)

### Desktop Grid Scaling

| Breakpoint | Card columns | Context |
|-----------|-------------|---------|
| lg: (1024px) | 2 columns | Standard desktop |
| xl: (1280px) | 3 columns | Wide desktop |

### Empty State

When no events exist, show a muted message: "No events recorded yet." Centered, monospace, small.

## W/L Summary Computation

Per day group, count wins and losses from resolved events:

```js
const wins = group.events.filter(e => e.status === 'success').length;
const losses = group.events.filter(e => e.status === 'fail').length;
// Display: "2W / 1L" or "0W / 3L"
```

Uses existing `groupEventsByDay` utility. No new utility needed.

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/h1/Timeline/TimelineSection.jsx` | Restructure: per-day flex rows with rail column (desktop) and card-border rail (mobile). Add day W/L summary. Add empty state. |
| `src/components/h1/Timeline/TimelineSection.css` | New rail styles (circle, blocks, connector, per-segment borders). Responsive switch at lg:. Day header styles. Spacing refinements. |
| `src/components/h1/Event/Event.css` | Add `border-left` for mobile rail (4px, colored by status). Only at < lg:. |

### No Changes To

- `Event.jsx` — no prop changes needed, border is CSS-only
- `groupEventsByDay.mjs` — already provides the groups we need
- `StatGrid`, `DashboardClient`, `Galaxy` — unaffected

## Verification

1. `npm run build` — must succeed
2. `npm run test:unit:run` — must pass
3. Mobile (< 1024px): Card left borders form continuous colored rail. Day headers have grey borders. Single column cards.
4. Desktop (1024px+): Dedicated rail column with circles, colored blocks, continuous line. 2-column card grid.
5. Day labels show W/L summary (e.g., "TODAY 1W / 1L")
6. Empty state shows message when no events
7. Chrome DevTools: Verify rail alignment — circles align with day labels, blocks count matches event count per day
