# Loadout Builder — Design Spec

**Date:** 2026-03-28
**Phase:** Future (shelved until core phases complete)
**Status:** Design approved, not yet planned

---

## 1. Overview

A loadout builder for Helldivers 1 integrated into helldivers.bot. Players create, customize, and share full loadouts via URL-encoded links. No account required for building or sharing — the URL IS the data.

**Core value:** Build a loadout → get a shareable link. No server storage needed for sharing.

### What's In Scope

- Solo loadout builder (single player)
- Full equipment: 4 stratagems + primary weapon + secondary weapon + 1 perk
- Hash-based URL sharing (bidirectional encode/decode)
- localStorage favorites (no account required)
- Curated faction guides (static content, linked from page)
- Static JSON item catalog (HD1 gear is fixed, never changes)

### What's Out of Scope

- Squad builder (future Phase 2 — hash format extensible to `[player1, player2, ...]`)
- Account sync for favorites (future — use existing `Settings` JSON field per user)
- Community loadouts / upvoting (needs critical mass that HD1 doesn't have)
- Item stats, DPS, cooldowns (manual wiki transcription not worth the maintenance)
- Per-difficulty recommendations (per-faction guides are sufficient)

---

## 2. Data Model

### 2.1 Static Item Catalog

Files in `src/data/loadout/`:

```
stratagems.json   — ~60 items
weapons.json      — ~20 items (primary + secondary)
perks.json        — ~12 items
```

**Stratagem shape:**
```json
{
  "id": "railcannon_strike",
  "name": "Railcannon Strike",
  "icon": "/icons/stratagems/railcannon.webp",
  "category": "offensive"
}
```

Categories: `offensive`, `defensive`, `supply`, `special`. Used only for icon background color — no UI filtering.

**Weapon shape:**
```json
{
  "id": "las13_trident",
  "name": "LAS-13 'Trident'",
  "icon": "/icons/weapons/trident.webp",
  "type": "primary",
  "class": "Laser Rifle"
}
```

Type: `primary` | `secondary`. Class is display-only (e.g. "Assault Rifle", "Pistol").

**Perk shape:**
```json
{
  "id": "md99_autoinjector",
  "name": "MD-99 Autoinjector",
  "icon": "/icons/perks/autoinjector.webp",
  "description": "Auto-heal when critically wounded"
}
```

No stats on any items. Names, icons, and categories only.

### 2.2 Loadout Shape

```javascript
{
  name: string,                    // user-defined label, e.g. "Anti-Bug Rush"
  stratagems: [id, id, id, id],   // 4 stratagem IDs (order matters, nulls for empty)
  primary: id | null,              // primary weapon ID
  secondary: id | null,            // secondary weapon ID
  perk: id | null,                 // perk ID
}
```

### 2.3 Hash-Based URL Sharing

**Encoding:** Compact array → JSON → base64 → URL param.

```javascript
// Encode
const arr = [name, primary, secondary, perk, strat1, strat2, strat3, strat4];
const hash = btoa(JSON.stringify(arr));
// URL: /loadout?b=eyJuYW1l...

// Decode
const arr = JSON.parse(atob(hash));
const [name, primary, secondary, perk, ...stratagems] = arr;
```

Stores item IDs (strings), not indices — more resilient if catalog order changes.

**Extensibility for future squad mode:**
```javascript
// Solo: [name, primary, secondary, perk, s1, s2, s3, s4]
// Squad: [[player1...], [player2...], [player3...], [player4...]]
// Detect by checking if arr[0] is a string (solo) or array (squad)
```

### 2.4 localStorage Favorites

```javascript
// Key: 'hb_loadouts'
// Value: array of saved loadouts
[
  { hash: "eyJuYW1l...", name: "Anti-Bug Rush", createdAt: 1711000000 },
  { hash: "dGVzdA==...", name: "Cyborg Helldive", createdAt: 1711000100 }
]
```

No limit enforced. Users manage their own list (delete to clean up).

---

## 3. Page Structure

### 3.1 Route: `/loadout`

Single page with two modes based on URL:

- **Builder mode** (`/loadout`): empty loadout, edit everything
- **Shared mode** (`/loadout?b=...`): pre-filled from hash, read-only with "Edit Copy" option

### 3.2 Layout (Game-Faithful, Mobile-First)

Matches the in-game loadout screen's visual language: dark backgrounds, gold/amber accents, condensed uppercase labels, section-based vertical layout.

**Sections in order:**

1. **Loadout name** — editable text input with gold left accent border
2. **Stratagems** — 4 icon slots in a row. Tap empty slot → flat icon grid expands inline below
3. **Perk** — game-style block: perk name on dark bg, icon on gold/amber background. Tap → custom dropdown with icon + name + description per option
4. **Primary Weapon** — custom dropdown: icon + weapon name + class (e.g. "Laser Rifle"). Tap → dropdown list with all primary weapons
5. **Secondary Weapon** — same dropdown pattern, filtered to secondary weapons
6. **Actions** — Save (♥) + Share Link (🔗) buttons

**Below the builder (not inside the card):**
- Link to curated faction guides: `/loadout/guides`

### 3.3 Shared View Differences

When `?b=` param is present:
- Loadout name displayed as hero header (★ name) instead of editable input
- "Shared Loadout · helldivers.bot" subtitle
- No dropdown arrows or edit affordances
- Stratagems centered
- Actions: "Copy Link" + "Edit Copy" (Edit Copy creates a new builder with the same selections)

---

## 4. Selection UX

### 4.1 Stratagems: Flat Icon Grid

- Tap an empty slot → inline grid expands below the stratagem row
- Flat grid of all ~60 stratagems, 5 columns
- Each item shows icon + tiny name label
- Icon background colors differentiate categories (orange=offensive, blue=defensive, green=supply, purple=special) — no filter tabs needed
- Already-selected stratagems are dimmed (can't pick duplicates)
- Tap an item → fills the slot, grid collapses
- Tap a filled slot → clears it (or opens grid to replace)

### 4.2 Weapons & Perks: Custom Dropdown

- Tap the field → dropdown list opens below
- Each option shows: icon + name + type/description
- Currently selected item has a gold checkmark
- Tap to select, dropdown auto-closes
- Perk dropdown uses the game's gold styling for the icon area
- ~12-20 items per list, scrollable if needed

### 4.3 Interaction Pattern

All three types follow: **tap to open → browse → tap to select → auto-close**.

---

## 5. Curated Faction Guides

### 5.1 Route: `/loadout/guides`

Static content page with 3-4 recommended loadouts per enemy faction (9-12 total).

**Structure per guide:**
- Faction name + icon
- Loadout name + rationale (1-2 sentences: why this works against this faction)
- Pre-filled loadout card (same component as the builder, read-only)
- "Use This Loadout" button → opens builder with these selections pre-filled

### 5.2 Content Source

Hand-written by the project owner. Stored as static data (JSON or hardcoded). Not user-generated.

---

## 6. Architecture

### 6.1 Components

```
src/app/loadout/
  page.jsx              — main loadout builder page (server component, reads ?b= param)
  guides/page.jsx       — curated faction guides page

src/components/h1/Loadout/
  LoadoutBuilder.jsx    — client component, main builder logic + state
  LoadoutCard.jsx       — read-only loadout display (shared view + guides)
  StratagemPicker.jsx   — flat icon grid for stratagem selection
  ItemDropdown.jsx      — custom dropdown for weapons and perks
  PerkBlock.jsx         — game-style gold perk display + dropdown
  LoadoutActions.jsx    — Save/Share/Copy/Edit buttons

src/data/loadout/
  stratagems.json
  weapons.json
  perks.json

src/utils/
  loadoutHash.mjs       — encode/decode functions
```

### 6.2 State Management

All client-side. No server state for the builder.

```javascript
// LoadoutBuilder state
const [name, setName] = useState('');
const [stratagems, setStratagems] = useState([null, null, null, null]);
const [primary, setPrimary] = useState(null);
const [secondary, setSecondary] = useState(null);
const [perk, setPerk] = useState(null);
const [activeSlot, setActiveSlot] = useState(null); // which picker is open
```

### 6.3 No API Routes Needed

- Building and sharing are 100% client-side (hash in URL)
- Favorites are localStorage only (Phase 1)
- Static JSON imported at build time
- No database queries, no server actions

---

## 7. Design Tokens Integration

Uses existing design tokens from `src/styles/tokens.css`:

- **Gold accent:** Custom `#c8a832` for the loadout builder (matches game's gold, distinct from site's `--color-primary` yellow)
- **Surfaces:** `--color-surface-0` through `--color-surface-2` for card layering
- **Text:** `--color-text`, `--color-text-muted` for labels
- **Font:** `--font-display` (Insignia) for section labels, `--font-mono` for item metadata
- **Border radius:** 0px everywhere (consistent with site)
- **Ghost borders:** `--color-ghost-border` for card edges

### Stratagem Category Colors (from game)

```css
--loadout-cat-offensive: rgba(106, 80, 32, 0.25);   /* amber/orange tint */
--loadout-cat-defensive: rgba(58, 88, 104, 0.25);    /* blue/teal tint */
--loadout-cat-supply:    rgba(74, 90, 58, 0.25);     /* green tint */
--loadout-cat-special:   rgba(90, 74, 90, 0.25);     /* purple tint */
```

---

## 8. Future Extensions (Not In This Spec)

| Feature | Trigger | Approach |
|---------|---------|----------|
| Squad builder (4 players) | User demand | Extend hash format to array-of-arrays |
| Account sync for favorites | User demand | Store in existing `Settings` JSON field per user |
| OG image for shared loadouts | After core ships | Satori-based OG image showing the loadout card |
| Loadout in Discord embed | After OG image | Discord bot reads `?b=` param, renders loadout |

---

## 9. Mockups

Visual mockups created during brainstorming are saved in:
`.superpowers/brainstorm/82458-1774739259/content/full-builder-mockup.html`

Three views: builder with picker open, complete loadout, shared link view.
