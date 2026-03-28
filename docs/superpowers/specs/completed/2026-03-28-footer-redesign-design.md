# Footer Redesign — Design Spec

## Problem

The footer uses generic styling (hardcoded `--black` background, plain h4 headings, no design tokens) that doesn't match the Phase 6 brandkit aesthetic. Links are broken (empty hrefs) and there are no hover states.

## Solution

Rebuild the footer to use the same design language as StatGrid, EventCard, and BottomNav: surface tokens, monospace labels, ghost borders, and primary yellow accents.

## Layout

Four-column grid on desktop (brand / features / social / legal), single column on mobile.

```
┌─── 2px accent line (primary, fades at 40%) ────────────────────┐
│                                                                  │
│  HELLDIVERS BOT          FEATURES    SOCIAL         LEGAL        │
│  The best way to track   ─────────   ─────────     ─────────    │
│  progress in Helldivers  Campaign    HD Discord     Terms of Use │
│                          History     Github         Privacy...   │
│  Contact / © / Ko-fi     Discord Bot Twitter        Cookies      │
│                          Stats       Report Bugs                 │
│                          API                                     │
│                                                                  │
│  ─── ghost border ──────────────────────────────────────────     │
│  HELLDIVERS BOT              NOT AFFILIATED WITH ARROWHEAD...    │
└──────────────────────────────────────────────────────────────────┘
```

## Files to Change

| File | Action |
|------|--------|
| `src/components/layout/Footer/Footer.css` | **Create** — all footer styles |
| `src/components/layout/Footer/Footer.jsx` | **Rewrite** — new structure |
| `src/app/layout.css` (lines 181-183) | **Delete** — remove `footer { background-color: var(--black); }` |

## CSS Classes

### `.footer`
- `background: var(--color-surface-0)` — base layer (darker than cards)
- Top accent: `border-top: 2px solid` with `border-image: linear-gradient(90deg, var(--color-primary) 40%, transparent 40%) 1`
- `padding-top: var(--space-12)` (3rem)

### `.footer-inner`
- Uses `.p-gutters` for responsive horizontal padding
- Mobile: `grid-template-columns: 1fr` (single column)
- `sm` (640px+): `grid-template-columns: 1.5fr 1fr 1fr 1fr`
- `gap: var(--space-8)` (1.5rem)

### `.footer-brand-name`
- `font-family: var(--font-display)`
- `font-size: 1.25rem`, `font-weight: 900`
- `text-transform: uppercase`
- `color: var(--color-primary)`

### `.footer-section-label`
Matches `stat-card-label` pattern:
- `font-family: var(--font-mono, monospace)`
- `font-size: 0.5625rem`
- `color: var(--color-outline)` (#999077)
- `text-transform: uppercase`, `letter-spacing: 0.05em`
- `padding-bottom: var(--space-2)`, `border-bottom: 1px solid var(--color-ghost-border)`
- `margin-bottom: var(--space-3)`

### `.footer-link`
- `color: var(--color-text)`, `font-size: 0.8125rem`
- `transition: color 0.15s ease`
- Hover: `color: var(--color-primary)`

### `.footer-link--disabled`
- `color: var(--color-text-muted)`, `cursor: default`
- Hover: no change (stays muted)
- Rendered as `<span>` (no href at all)

### `.footer-separator`
- `border-top: 1px solid var(--color-ghost-border)`
- `margin-top: var(--space-8)`, `padding-top: var(--space-4)`
- `padding-bottom: calc(48px + 1rem)` — clears the fixed BottomNav
- Text: monospace, 0.5625rem, uppercase, muted
- Flex row: "Helldivers Bot" left, "Not affiliated with Arrowhead Game Studios" right

## Link Mapping

### Active Links (color: `--color-text`, hover: `--color-primary`)

| Label | URL | Type |
|-------|-----|------|
| Campaign | `/` | Internal (`Link`) |
| History | `/war` | Internal (`Link`) |
| Discord Bot | `/discord` | Internal (`Link`) |
| Stats | `/stats` | Internal (`Link`) |
| API | `/api` | Internal (`Link`) |
| Helldivers Discord | `https://discord.gg/fu3TJyufFd` | External (`a target="_blank"`) |
| Github | `https://github.com/elfensky/helldivers1api` | External (`a target="_blank"`) |
| Twitter | `https://x.com/elfensky` | External (`a target="_blank"`) |
| Report Bugs | `https://github.com/elfensky/helldivers1api/issues` | External (`a target="_blank"`) |
| Andrei Lavrenov | `https://lavrenov.io` | External (`a target="_blank"`) |
| Ko-fi | `https://ko-fi.com/H2H610Q1K` | External (`a target="_blank"`) |

### Disabled Links (color: `--color-text-muted`, `<span>`)

- Terms of Use
- Privacy Policy
- Cookies

## Semantic Notes

- Section labels use `<span>` not `<h4>` — they are UI labels, not document headings
- Disabled links use `<span>` not `<a href="">` — no navigation behavior
- Sitemap sections wrapped in `<nav>` for accessibility
- External links get `rel="noopener noreferrer"`
- Remove the `slide` class (unused/unclear origin)

## Responsive Behavior

- **Mobile (<640px):** Single column, all sections stack vertically
- **Desktop (640px+):** 4-column grid with brand column wider (1.5fr)
- Horizontal padding scales via `.p-gutters`: 1rem → 3rem → 6rem
