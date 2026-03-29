# Loadout Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a game-faithful HD1 loadout builder with hash-based URL sharing, localStorage favorites, and curated faction guides.

**Architecture:** Fully client-side feature — no API routes, no database. Static JSON item catalogs in `src/enums/`. Hash encode/decode in a utility. Single `/loadout` page with builder and shared modes. Client component manages all state via `useState`.

**Tech Stack:** Next.js 16 (App Router), React 19, Vitest, CSS custom properties from `src/styles/tokens.css`

**Spec:** `docs/superpowers/specs/2026-03-28-loadout-builder-design.md`

---

## File Map

```
CREATE  src/enums/stratagems.mjs          — ~60 stratagem items { id, name, icon, category }
CREATE  src/enums/loadoutWeapons.mjs      — ~20 weapons { id, name, icon, type, class }
CREATE  src/enums/loadoutPerks.mjs        — ~12 perks { id, name, icon, description }
CREATE  src/utils/loadoutHash.mjs         — encodeLoadout() / decodeLoadout()
CREATE  src/utils/loadoutFavorites.mjs    — getFavorites() / saveFavorite() / removeFavorite()
CREATE  src/app/loadout/page.jsx          — server component, reads ?b= param
CREATE  src/app/loadout/loadout.css       — page-level styles
CREATE  src/components/h1/Loadout/LoadoutBuilder.jsx   — main client component
CREATE  src/components/h1/Loadout/LoadoutBuilder.css    — builder styles
CREATE  src/components/h1/Loadout/StratagemPicker.jsx   — flat icon grid
CREATE  src/components/h1/Loadout/ItemDropdown.jsx      — custom dropdown for weapons/perks
CREATE  src/components/h1/Loadout/PerkBlock.jsx         — game-style gold perk display + dropdown
CREATE  src/components/h1/Loadout/LoadoutCard.jsx       — read-only shared view
CREATE  src/components/h1/Loadout/LoadoutCard.css       — shared view styles
CREATE  src/app/loadout/guides/page.jsx                 — curated faction guides
CREATE  src/__tests__/unit/utils/loadoutHash.test.mjs   — hash encode/decode tests
CREATE  src/__tests__/unit/utils/loadoutFavorites.test.mjs — favorites tests
MODIFY  src/app/sitemap.js                — add /loadout and /loadout/guides
MODIFY  src/styles/tokens.css             — add loadout-specific tokens
```

---

## Task 1: Design Tokens for Loadout Builder

**Files:**
- Modify: `src/styles/tokens.css`

- [ ] **Step 1: Add loadout-specific CSS custom properties**

Add to the `:root` block in `src/styles/tokens.css`, after the faction colors:

```css
/* === LOADOUT BUILDER (game-canonical gold) === */
--color-loadout-gold: #c8a832;
--color-loadout-gold-dark: #a8882a;
--color-loadout-cat-offensive: rgba(106, 80, 32, 0.25);
--color-loadout-cat-defensive: rgba(58, 88, 104, 0.25);
--color-loadout-cat-supply: rgba(74, 90, 58, 0.25);
--color-loadout-cat-special: rgba(90, 74, 90, 0.25);
--color-loadout-cat-offensive-border: #8a6830;
--color-loadout-cat-defensive-border: #4a6878;
--color-loadout-cat-supply-border: #5a6a4a;
--color-loadout-cat-special-border: #6a5a6a;
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/styles/tokens.css
git commit -m "feat(loadout): add loadout builder design tokens"
```

---

## Task 2: Static Item Catalogs

**Files:**
- Create: `src/enums/stratagems.mjs`
- Create: `src/enums/loadoutWeapons.mjs`
- Create: `src/enums/loadoutPerks.mjs`

- [ ] **Step 1: Create stratagems catalog**

Create `src/enums/stratagems.mjs`. Start with a representative subset (~15 items). The full ~60 can be populated later from the Helldivers wiki — the structure matters, not the completeness right now.

```javascript
/**
 * Helldivers 1 stratagem catalog.
 * Categories: offensive, defensive, supply, special.
 * Used for loadout builder item selection.
 */

const stratagems = [
    // Offensive
    { id: 'railcannon_strike', name: 'Railcannon Strike', icon: '/icons/stratagems/railcannon.webp', category: 'offensive' },
    { id: 'airstrike', name: 'Strafing Run', icon: '/icons/stratagems/strafing.webp', category: 'offensive' },
    { id: 'thunderer_barrage', name: 'Thunderer Barrage', icon: '/icons/stratagems/thunderer.webp', category: 'offensive' },
    { id: 'incendiary_bombs', name: 'Incendiary Bombs', icon: '/icons/stratagems/incendiary.webp', category: 'offensive' },
    { id: 'close_air_support', name: 'Close Air Support', icon: '/icons/stratagems/cas.webp', category: 'offensive' },

    // Defensive
    { id: 'mg_turret', name: 'MG Turret', icon: '/icons/stratagems/mg-turret.webp', category: 'defensive' },
    { id: 'at_turret', name: 'Anti-Tank Turret', icon: '/icons/stratagems/at-turret.webp', category: 'defensive' },
    { id: 'tesla_tower', name: 'Tesla Tower', icon: '/icons/stratagems/tesla.webp', category: 'defensive' },

    // Supply
    { id: 'resupply', name: 'Resupply', icon: '/icons/stratagems/resupply.webp', category: 'supply' },
    { id: 'reinforce', name: 'Reinforce', icon: '/icons/stratagems/reinforce.webp', category: 'supply' },
    { id: 'rep_80', name: 'REP-80', icon: '/icons/stratagems/rep80.webp', category: 'supply' },
    { id: 'uav_recon', name: 'UAV Recon', icon: '/icons/stratagems/uav.webp', category: 'supply' },

    // Special
    { id: 'exo_suit', name: 'EXO-44 Walker Exosuit', icon: '/icons/stratagems/exosuit.webp', category: 'special' },
    { id: 'distortion_field', name: 'Distortion Field', icon: '/icons/stratagems/distortion.webp', category: 'special' },
    { id: 'nux_223_hellbomb', name: 'NUX-223 Hellbomb', icon: '/icons/stratagems/hellbomb.webp', category: 'special' },
];

export default stratagems;
```

- [ ] **Step 2: Create weapons catalog**

Create `src/enums/loadoutWeapons.mjs`:

```javascript
/**
 * Helldivers 1 weapon catalog.
 * type: 'primary' | 'secondary'. class is display-only.
 */

const weapons = [
    // Primary
    { id: 'ar19_liberator', name: "AR-19 'Liberator'", icon: '/icons/weapons/liberator.webp', type: 'primary', class: 'Assault Rifle' },
    { id: 'ar20l_justice', name: "AR-20L 'Justice'", icon: '/icons/weapons/justice.webp', type: 'primary', class: 'Assault Rifle' },
    { id: 'las13_trident', name: "LAS-13 'Trident'", icon: '/icons/weapons/trident.webp', type: 'primary', class: 'Laser Rifle' },
    { id: 'sg225_breaker', name: "SG-225 'Breaker'", icon: '/icons/weapons/breaker.webp', type: 'primary', class: 'Shotgun' },
    { id: 'smg45_defender', name: "SMG-45 'Defender'", icon: '/icons/weapons/defender.webp', type: 'primary', class: 'Submachine Gun' },
    { id: 'rx1_railgun', name: 'RX-1 Rail Gun', icon: '/icons/weapons/railgun.webp', type: 'primary', class: 'Sniper' },
    { id: 'mg105_stalwart', name: "MG-105 'Stalwart'", icon: '/icons/weapons/stalwart.webp', type: 'primary', class: 'Machine Gun' },
    { id: 'las16_sickle', name: "LAS-16 'Sickle'", icon: '/icons/weapons/sickle.webp', type: 'primary', class: 'Laser Rifle' },

    // Secondary
    { id: 'p2_peacemaker', name: 'P-2 Peacemaker', icon: '/icons/weapons/peacemaker.webp', type: 'secondary', class: 'Pistol' },
    { id: 'p6_gunslinger', name: 'P-6 Gunslinger', icon: '/icons/weapons/gunslinger.webp', type: 'secondary', class: 'Revolver' },
];

export const primaryWeapons = weapons.filter((w) => w.type === 'primary');
export const secondaryWeapons = weapons.filter((w) => w.type === 'secondary');
export default weapons;
```

- [ ] **Step 3: Create perks catalog**

Create `src/enums/loadoutPerks.mjs`:

```javascript
/**
 * Helldivers 1 perk catalog.
 */

const perks = [
    { id: 'md99_autoinjector', name: 'MD-99 Autoinjector', icon: '/icons/perks/autoinjector.webp', description: 'Auto-heal when critically wounded' },
    { id: 'laser_aim_module', name: 'Laser Aim Module', icon: '/icons/perks/laser-aim.webp', description: 'Improved weapon accuracy' },
    { id: 'heavy_armor', name: 'Heavy Armor', icon: '/icons/perks/heavy-armor.webp', description: 'Increased damage resistance, reduced speed' },
    { id: 'cardio_accelerator', name: 'Cardio Accelerator', icon: '/icons/perks/cardio.webp', description: 'Increased sprint speed' },
    { id: 'stratagem_priority', name: 'Stratagem Priority', icon: '/icons/perks/strat-priority.webp', description: 'Reduced stratagem cooldowns' },
    { id: 'all_terrain_boots', name: 'All Terrain Boots', icon: '/icons/perks/terrain-boots.webp', description: 'Move faster over difficult terrain' },
    { id: 'displacement_field', name: 'Displacement Field', icon: '/icons/perks/displacement.webp', description: 'Chance to deflect projectiles' },
    { id: 'p2w_contact', name: 'P2W Contact', icon: '/icons/perks/p2w.webp', description: 'Start with upgraded weapon' },
];

export default perks;
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds (files are importable but not yet imported anywhere).

- [ ] **Step 5: Commit**

```bash
git add src/enums/stratagems.mjs src/enums/loadoutWeapons.mjs src/enums/loadoutPerks.mjs
git commit -m "feat(loadout): add static item catalogs (stratagems, weapons, perks)"
```

---

## Task 3: Hash Encode/Decode Utility + Tests

**Files:**
- Create: `src/utils/loadoutHash.mjs`
- Create: `src/__tests__/unit/utils/loadoutHash.test.mjs`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/unit/utils/loadoutHash.test.mjs`:

```javascript
import { encodeLoadout, decodeLoadout } from '@/utils/loadoutHash.mjs';

describe('encodeLoadout', () => {
    test('encodes a full loadout to a base64 string', () => {
        const loadout = {
            name: 'Bug Slayer',
            stratagems: ['railcannon_strike', 'mg_turret', 'resupply', 'exo_suit'],
            primary: 'las13_trident',
            secondary: 'p2_peacemaker',
            perk: 'md99_autoinjector',
        };
        const hash = encodeLoadout(loadout);
        expect(typeof hash).toBe('string');
        expect(hash.length).toBeGreaterThan(0);
        // Base64 should not contain URL-unsafe characters after encoding
        expect(hash).not.toContain(' ');
    });

    test('encodes a partial loadout (empty slots)', () => {
        const loadout = {
            name: 'Minimal',
            stratagems: ['resupply', null, null, null],
            primary: 'ar19_liberator',
            secondary: null,
            perk: null,
        };
        const hash = encodeLoadout(loadout);
        expect(typeof hash).toBe('string');
    });

    test('returns empty string for null input', () => {
        expect(encodeLoadout(null)).toBe('');
    });
});

describe('decodeLoadout', () => {
    test('decodes a hash back to the original loadout', () => {
        const original = {
            name: 'Bug Slayer',
            stratagems: ['railcannon_strike', 'mg_turret', 'resupply', 'exo_suit'],
            primary: 'las13_trident',
            secondary: 'p2_peacemaker',
            perk: 'md99_autoinjector',
        };
        const hash = encodeLoadout(original);
        const decoded = decodeLoadout(hash);
        expect(decoded).toEqual(original);
    });

    test('roundtrips a partial loadout with nulls', () => {
        const original = {
            name: 'Minimal',
            stratagems: ['resupply', null, null, null],
            primary: 'ar19_liberator',
            secondary: null,
            perk: null,
        };
        const hash = encodeLoadout(original);
        const decoded = decodeLoadout(hash);
        expect(decoded).toEqual(original);
    });

    test('returns null for invalid hash', () => {
        expect(decodeLoadout('not-valid-base64!!!')).toBeNull();
        expect(decodeLoadout('')).toBeNull();
        expect(decodeLoadout(null)).toBeNull();
    });

    test('returns null for valid base64 but wrong structure', () => {
        const badHash = btoa(JSON.stringify({ wrong: 'shape' }));
        expect(decodeLoadout(badHash)).toBeNull();
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit:run -- --reporter=verbose 2>&1 | grep -E "FAIL|PASS|loadoutHash"`
Expected: All tests FAIL (module not found).

- [ ] **Step 3: Implement encode/decode**

Create `src/utils/loadoutHash.mjs`:

```javascript
/**
 * Encode a loadout object to a URL-safe base64 hash.
 *
 * Format: [name, primary, secondary, perk, strat1, strat2, strat3, strat4]
 * Future squad mode: [[player1...], [player2...]] — detected by arr[0] type.
 *
 * @param {{ name: string, stratagems: (string|null)[], primary: string|null, secondary: string|null, perk: string|null }} loadout
 * @returns {string} base64-encoded hash, or empty string if input is null
 */
export function encodeLoadout(loadout) {
    if (!loadout) return '';

    const arr = [
        loadout.name || '',
        loadout.primary,
        loadout.secondary,
        loadout.perk,
        ...loadout.stratagems,
    ];

    return btoa(JSON.stringify(arr));
}

/**
 * Decode a base64 hash back to a loadout object.
 *
 * @param {string} hash
 * @returns {{ name: string, stratagems: (string|null)[], primary: string|null, secondary: string|null, perk: string|null } | null}
 */
export function decodeLoadout(hash) {
    if (!hash || typeof hash !== 'string') return null;

    try {
        const arr = JSON.parse(atob(hash));
        if (!Array.isArray(arr) || arr.length < 8) return null;
        // Guard against squad format (future): arr[0] would be an array
        if (typeof arr[0] !== 'string') return null;

        const [name, primary, secondary, perk, ...stratagems] = arr;

        return {
            name,
            stratagems: stratagems.slice(0, 4),
            primary,
            secondary,
            perk,
        };
    } catch {
        return null;
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit:run`
Expected: All 7 loadoutHash tests PASS. All other tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/loadoutHash.mjs src/__tests__/unit/utils/loadoutHash.test.mjs
git commit -m "feat(loadout): add hash encode/decode utility with tests"
```

---

## Task 4: localStorage Favorites Utility + Tests

**Files:**
- Create: `src/utils/loadoutFavorites.mjs`
- Create: `src/__tests__/unit/utils/loadoutFavorites.test.mjs`

- [ ] **Step 1: Write failing tests**

Create `src/__tests__/unit/utils/loadoutFavorites.test.mjs`:

```javascript
import { getFavorites, saveFavorite, removeFavorite } from '@/utils/loadoutFavorites.mjs';

// Mock localStorage for Node test environment
const store = {};
const localStorageMock = {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = value; },
    removeItem: (key) => { delete store[key]; },
};

beforeEach(() => {
    Object.keys(store).forEach((key) => delete store[key]);
    globalThis.localStorage = localStorageMock;
});

describe('getFavorites', () => {
    test('returns empty array when no favorites saved', () => {
        expect(getFavorites()).toEqual([]);
    });

    test('returns saved favorites', () => {
        const favs = [{ hash: 'abc', name: 'Test', createdAt: 1000 }];
        store['hb_loadouts'] = JSON.stringify(favs);
        expect(getFavorites()).toEqual(favs);
    });

    test('returns empty array for corrupted data', () => {
        store['hb_loadouts'] = 'not-json!!!';
        expect(getFavorites()).toEqual([]);
    });
});

describe('saveFavorite', () => {
    test('adds a favorite to empty list', () => {
        saveFavorite('hashA', 'Build A');
        const favs = getFavorites();
        expect(favs).toHaveLength(1);
        expect(favs[0].hash).toBe('hashA');
        expect(favs[0].name).toBe('Build A');
        expect(typeof favs[0].createdAt).toBe('number');
    });

    test('does not add duplicate hash', () => {
        saveFavorite('hashA', 'Build A');
        saveFavorite('hashA', 'Build A again');
        expect(getFavorites()).toHaveLength(1);
    });
});

describe('removeFavorite', () => {
    test('removes a favorite by hash', () => {
        saveFavorite('hashA', 'Build A');
        saveFavorite('hashB', 'Build B');
        removeFavorite('hashA');
        const favs = getFavorites();
        expect(favs).toHaveLength(1);
        expect(favs[0].hash).toBe('hashB');
    });

    test('no-op when hash not found', () => {
        saveFavorite('hashA', 'Build A');
        removeFavorite('nonexistent');
        expect(getFavorites()).toHaveLength(1);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit:run`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement favorites**

Create `src/utils/loadoutFavorites.mjs`:

```javascript
const STORAGE_KEY = 'hb_loadouts';

/**
 * Get all saved loadout favorites from localStorage.
 * @returns {{ hash: string, name: string, createdAt: number }[]}
 */
export function getFavorites() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

/**
 * Save a loadout to favorites. Skips if hash already exists.
 * @param {string} hash — base64 encoded loadout
 * @param {string} name — loadout display name
 */
export function saveFavorite(hash, name) {
    const favs = getFavorites();
    if (favs.some((f) => f.hash === hash)) return;
    favs.push({ hash, name, createdAt: Math.floor(Date.now() / 1000) });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
}

/**
 * Remove a loadout from favorites by hash.
 * @param {string} hash
 */
export function removeFavorite(hash) {
    const favs = getFavorites().filter((f) => f.hash !== hash);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit:run`
Expected: All loadoutFavorites tests PASS. All other tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/loadoutFavorites.mjs src/__tests__/unit/utils/loadoutFavorites.test.mjs
git commit -m "feat(loadout): add localStorage favorites utility with tests"
```

---

## Task 5: Loadout Page Route + Server Component

**Files:**
- Create: `src/app/loadout/page.jsx`
- Create: `src/app/loadout/loadout.css`
- Modify: `src/app/sitemap.js`

- [ ] **Step 1: Create page**

Create `src/app/loadout/page.jsx`:

```jsx
import './loadout.css';
import LoadoutBuilder from '@/components/h1/Loadout/LoadoutBuilder';
import { decodeLoadout } from '@/utils/loadoutHash.mjs';

export const metadata = {
    title: 'Loadout Builder | Helldivers Bot',
    description:
        'Create and share Helldivers 1 loadouts. Pick stratagems, weapons, and perks — get a shareable link.',
};

export default async function LoadoutPage({ searchParams }) {
    const params = await searchParams;
    const hash = params?.b || null;
    const sharedLoadout = hash ? decodeLoadout(hash) : null;

    return (
        <div className="gutters flex flex-col gap-4 py-4">
            <h1>Loadout Builder</h1>
            <LoadoutBuilder sharedLoadout={sharedLoadout} sharedHash={hash} />
            <a href="/loadout/guides" className="loadout-guides-link">
                📋 Curated Faction Guides →
            </a>
        </div>
    );
}
```

- [ ] **Step 2: Create page CSS**

Create `src/app/loadout/loadout.css`:

```css
.loadout-guides-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: var(--color-surface-1);
    border: 1px solid var(--color-ghost-border);
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    text-decoration: none;
    transition: border-color 0.15s;
}

.loadout-guides-link:hover {
    border-color: var(--color-loadout-gold);
    color: var(--color-text);
}
```

- [ ] **Step 3: Update sitemap**

In `src/app/sitemap.js`, add entries to the returned array:

```javascript
{
    url: 'https://helldivers.bot/loadout',
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.7,
},
{
    url: 'https://helldivers.bot/loadout/guides',
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.5,
},
```

- [ ] **Step 4: Create stub LoadoutBuilder**

Create `src/components/h1/Loadout/LoadoutBuilder.jsx` (minimal stub so the page renders):

```jsx
'use client';

export default function LoadoutBuilder({ sharedLoadout, sharedHash }) {
    return <div className="loadout-builder">Loadout builder coming soon</div>;
}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds, `/loadout` appears in the route list.

- [ ] **Step 6: Commit**

```bash
git add src/app/loadout/ src/components/h1/Loadout/LoadoutBuilder.jsx src/app/sitemap.js
git commit -m "feat(loadout): add /loadout page route with stub builder"
```

---

## Task 6: StratagemPicker Component

**Files:**
- Create: `src/components/h1/Loadout/StratagemPicker.jsx`

- [ ] **Step 1: Implement StratagemPicker**

Create `src/components/h1/Loadout/StratagemPicker.jsx`:

```jsx
import stratagems from '@/enums/stratagems.mjs';

const CATEGORY_CLASS = {
    offensive: 'strat-cat-offensive',
    defensive: 'strat-cat-defensive',
    supply: 'strat-cat-supply',
    special: 'strat-cat-special',
};

export default function StratagemPicker({ selectedIds, onSelect }) {
    return (
        <div className="strat-picker">
            <div className="strat-picker-bar">
                <span className="strat-picker-title">Select Stratagem</span>
            </div>
            <div className="strat-picker-grid">
                {stratagems.map((strat) => {
                    const isUsed = selectedIds.includes(strat.id);
                    return (
                        <button
                            key={strat.id}
                            className={`strat-picker-item ${CATEGORY_CLASS[strat.category]} ${isUsed ? 'strat-picker-item--used' : ''}`}
                            onClick={() => !isUsed && onSelect(strat.id)}
                            disabled={isUsed}
                            title={strat.name}
                            type="button"
                        >
                            <img
                                src={strat.icon}
                                alt={strat.name}
                                width={28}
                                height={28}
                                className="strat-picker-icon"
                                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                            />
                            <span className="strat-picker-fallback" style={{ display: 'none' }}>
                                {strat.name.charAt(0)}
                            </span>
                            <span className="strat-picker-name">{strat.name}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/h1/Loadout/StratagemPicker.jsx
git commit -m "feat(loadout): add StratagemPicker component"
```

---

## Task 7: ItemDropdown Component

**Files:**
- Create: `src/components/h1/Loadout/ItemDropdown.jsx`

- [ ] **Step 1: Implement ItemDropdown**

Create `src/components/h1/Loadout/ItemDropdown.jsx`:

```jsx
import { useState, useRef, useEffect } from 'react';

export default function ItemDropdown({ items, value, onChange, placeholder }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const selected = items.find((item) => item.id === value);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        function handleClick(e) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    return (
        <div className="item-dropdown" ref={ref}>
            <button
                className={`item-dropdown-trigger ${open ? 'item-dropdown-trigger--open' : ''} ${!selected ? 'item-dropdown-trigger--empty' : ''}`}
                onClick={() => setOpen(!open)}
                type="button"
            >
                {selected ?
                    <>
                        <img
                            src={selected.icon}
                            alt=""
                            width={36}
                            height={36}
                            className="item-dropdown-icon"
                        />
                        <div className="item-dropdown-info">
                            <span className="item-dropdown-name">{selected.name}</span>
                            {selected.class && (
                                <span className="item-dropdown-type">{selected.class}</span>
                            )}
                            {selected.description && (
                                <span className="item-dropdown-type">{selected.description}</span>
                            )}
                        </div>
                    </>
                :   <span className="item-dropdown-placeholder">{placeholder || 'Select...'}</span>
                }
                <span className={`item-dropdown-arrow ${open ? 'item-dropdown-arrow--up' : ''}`}>
                    ▼
                </span>
            </button>
            {open && (
                <div className="item-dropdown-list">
                    {items.map((item) => (
                        <button
                            key={item.id}
                            className={`item-dropdown-option ${item.id === value ? 'item-dropdown-option--selected' : ''}`}
                            onClick={() => {
                                onChange(item.id);
                                setOpen(false);
                            }}
                            type="button"
                        >
                            <img
                                src={item.icon}
                                alt=""
                                width={28}
                                height={28}
                                className="item-dropdown-opt-icon"
                            />
                            <div>
                                <span className="item-dropdown-opt-name">{item.name}</span>
                                {item.class && (
                                    <span className="item-dropdown-opt-sub">{item.class}</span>
                                )}
                                {item.description && (
                                    <span className="item-dropdown-opt-sub">{item.description}</span>
                                )}
                            </div>
                            {item.id === value && <span className="item-dropdown-check">✓</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/h1/Loadout/ItemDropdown.jsx
git commit -m "feat(loadout): add ItemDropdown component for weapons/perks"
```

---

## Task 8: PerkBlock Component

**Files:**
- Create: `src/components/h1/Loadout/PerkBlock.jsx`

- [ ] **Step 1: Implement PerkBlock**

Create `src/components/h1/Loadout/PerkBlock.jsx`:

```jsx
import { useState, useRef, useEffect } from 'react';
import perks from '@/enums/loadoutPerks.mjs';

export default function PerkBlock({ value, onChange, readOnly }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const selected = perks.find((p) => p.id === value);

    useEffect(() => {
        if (!open) return;
        function handleClick(e) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    return (
        <div className="perk-block" ref={ref}>
            <button
                className={`perk-block-bar ${open ? 'perk-block-bar--open' : ''} ${!selected ? 'perk-block-bar--empty' : ''}`}
                onClick={() => !readOnly && setOpen(!open)}
                type="button"
                disabled={readOnly}
            >
                <span>{selected?.name || 'Select perk...'}</span>
                {!readOnly && <span className={`perk-block-arrow ${open ? 'perk-block-arrow--up' : ''}`}>▼</span>}
            </button>
            <div className={`perk-block-icon-area ${!selected ? 'perk-block-icon-area--empty' : ''}`}>
                {selected ?
                    <img src={selected.icon} alt={selected.name} width={48} height={48} />
                :   <span className="perk-block-plus">+</span>
                }
            </div>
            {open && (
                <div className="perk-block-dropdown">
                    {perks.map((perk) => (
                        <button
                            key={perk.id}
                            className={`perk-block-option ${perk.id === value ? 'perk-block-option--selected' : ''}`}
                            onClick={() => {
                                onChange(perk.id);
                                setOpen(false);
                            }}
                            type="button"
                        >
                            <img src={perk.icon} alt="" width={28} height={28} className="perk-block-opt-icon" />
                            <div>
                                <span className="perk-block-opt-name">{perk.name}</span>
                                <span className="perk-block-opt-desc">{perk.description}</span>
                            </div>
                            {perk.id === value && <span className="perk-block-check">✓</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/h1/Loadout/PerkBlock.jsx
git commit -m "feat(loadout): add PerkBlock component with game-style gold display"
```

---

## Task 9: LoadoutBuilder Client Component + CSS

**Files:**
- Modify: `src/components/h1/Loadout/LoadoutBuilder.jsx`
- Create: `src/components/h1/Loadout/LoadoutBuilder.css`

- [ ] **Step 1: Implement full LoadoutBuilder**

Replace the stub `src/components/h1/Loadout/LoadoutBuilder.jsx`:

```jsx
'use client';
import './LoadoutBuilder.css';
import { useState } from 'react';
import { encodeLoadout } from '@/utils/loadoutHash.mjs';
import { saveFavorite } from '@/utils/loadoutFavorites.mjs';
import StratagemPicker from '@/components/h1/Loadout/StratagemPicker';
import ItemDropdown from '@/components/h1/Loadout/ItemDropdown';
import PerkBlock from '@/components/h1/Loadout/PerkBlock';
import { primaryWeapons, secondaryWeapons } from '@/enums/loadoutWeapons.mjs';
import stratagems from '@/enums/stratagems.mjs';

export default function LoadoutBuilder({ sharedLoadout, sharedHash }) {
    const isShared = !!sharedLoadout;

    const [name, setName] = useState(sharedLoadout?.name || '');
    const [strats, setStrats] = useState(sharedLoadout?.stratagems || [null, null, null, null]);
    const [primary, setPrimary] = useState(sharedLoadout?.primary || null);
    const [secondary, setSecondary] = useState(sharedLoadout?.secondary || null);
    const [perk, setPerk] = useState(sharedLoadout?.perk || null);
    const [activeSlot, setActiveSlot] = useState(null);
    const [copied, setCopied] = useState(false);

    function handleStratSelect(stratId) {
        if (activeSlot === null) return;
        const next = [...strats];
        next[activeSlot] = stratId;
        setStrats(next);
        setActiveSlot(null);
    }

    function handleStratSlotClick(index) {
        if (isShared) return;
        if (strats[index]) {
            // Clear filled slot
            const next = [...strats];
            next[index] = null;
            setStrats(next);
        } else {
            // Open picker for this slot
            setActiveSlot(activeSlot === index ? null : index);
        }
    }

    function getHash() {
        return encodeLoadout({ name, stratagems: strats, primary, secondary, perk });
    }

    function handleShare() {
        const hash = getHash();
        const url = `${window.location.origin}/loadout?b=${hash}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    function handleSave() {
        const hash = getHash();
        saveFavorite(hash, name || 'Unnamed Loadout');
    }

    function handleEditCopy() {
        // Navigate to builder mode with the same selections
        window.location.href = '/loadout';
        // State will be lost — re-encode as fresh builder
        // Better: push state via URL without the ?b= param
        const hash = sharedHash;
        const loadout = sharedLoadout;
        window.history.replaceState(null, '', '/loadout');
        window.location.reload();
    }

    const selectedStratIds = strats.filter(Boolean);

    return (
        <div className="loadout-builder">
            {/* Shared view header */}
            {isShared ?
                <div className="loadout-shared-header">
                    <div className="loadout-shared-name">★ {sharedLoadout.name || 'Shared Loadout'}</div>
                    <div className="loadout-shared-sub">Shared Loadout · helldivers.bot</div>
                </div>
            :   <input
                    className="loadout-name-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name this loadout…"
                    maxLength={50}
                />
            }

            {/* Stratagems */}
            <div className="loadout-section-label">Stratagems</div>
            <div className="loadout-strat-slots">
                {strats.map((stratId, i) => {
                    const strat = stratId ? stratagems.find((s) => s.id === stratId) : null;
                    const isActive = activeSlot === i;
                    return (
                        <button
                            key={i}
                            className={`loadout-strat-slot ${strat ? `strat-cat-${strat.category}` : 'loadout-strat-slot--empty'} ${isActive ? 'loadout-strat-slot--active' : ''}`}
                            onClick={() => handleStratSlotClick(i)}
                            type="button"
                            disabled={isShared}
                        >
                            {strat ?
                                <img src={strat.icon} alt={strat.name} width={32} height={32} />
                            :   <span className="loadout-strat-plus">+</span>
                            }
                        </button>
                    );
                })}
            </div>
            {activeSlot !== null && (
                <StratagemPicker selectedIds={selectedStratIds} onSelect={handleStratSelect} />
            )}

            {/* Perk */}
            <div className="loadout-section-label">Perk</div>
            <PerkBlock value={perk} onChange={setPerk} readOnly={isShared} />

            {/* Primary Weapon */}
            <div className="loadout-section-label">Primary Weapon</div>
            {isShared ?
                <ItemDropdown items={primaryWeapons} value={primary} onChange={() => {}} placeholder="No weapon" />
            :   <ItemDropdown items={primaryWeapons} value={primary} onChange={setPrimary} placeholder="Select primary weapon…" />
            }

            {/* Secondary Weapon */}
            <div className="loadout-section-label">Secondary Weapon</div>
            {isShared ?
                <ItemDropdown items={secondaryWeapons} value={secondary} onChange={() => {}} placeholder="No weapon" />
            :   <ItemDropdown items={secondaryWeapons} value={secondary} onChange={setSecondary} placeholder="Select secondary weapon…" />
            }

            {/* Actions */}
            <div className="loadout-actions">
                {isShared ?
                    <>
                        <button className="loadout-btn loadout-btn--save" onClick={handleShare} type="button">
                            {copied ? '✓ Copied!' : '📋 Copy Link'}
                        </button>
                        <button className="loadout-btn loadout-btn--share" onClick={handleEditCopy} type="button">
                            ✏️ Edit Copy
                        </button>
                    </>
                :   <>
                        <button className="loadout-btn loadout-btn--save" onClick={handleSave} type="button">
                            ♥ Save
                        </button>
                        <button className="loadout-btn loadout-btn--share" onClick={handleShare} type="button">
                            {copied ? '✓ Copied!' : '🔗 Share Link'}
                        </button>
                    </>
                }
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Create CSS**

Create `src/components/h1/Loadout/LoadoutBuilder.css`:

```css
.loadout-builder {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    max-width: 400px;
}

/* Name input */
.loadout-name-input {
    padding: 0.5rem 0.625rem;
    background: var(--color-surface-0);
    border: 1px solid var(--color-ghost-border);
    border-left: 3px solid var(--color-loadout-gold);
    font-family: var(--font-display);
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--color-loadout-gold);
    letter-spacing: 0.03em;
    outline: none;
    width: 100%;
}
.loadout-name-input::placeholder {
    color: var(--color-text-muted);
}

/* Shared view header */
.loadout-shared-header {
    text-align: center;
    padding: 0.75rem 0;
}
.loadout-shared-name {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-loadout-gold);
    letter-spacing: 0.04em;
}
.loadout-shared-sub {
    font-family: var(--font-mono);
    font-size: 0.5625rem;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-top: 0.125rem;
}

/* Section labels */
.loadout-section-label {
    padding: 0.625rem 0 0.25rem;
    font-family: var(--font-display);
    font-size: 0.8125rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-loadout-gold);
}

/* Stratagem slots */
.loadout-strat-slots {
    display: flex;
    gap: 0.375rem;
}
.loadout-strat-slot {
    width: 3.5rem;
    height: 3.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid;
    cursor: pointer;
    transition: all 0.12s;
    background: none;
    padding: 0;
}
.loadout-strat-slot:hover {
    transform: scale(1.05);
}
.loadout-strat-slot--empty {
    background: var(--color-surface-0);
    border: 2px dashed var(--color-ghost-border);
}
.loadout-strat-slot--active {
    border-color: var(--color-primary) !important;
    box-shadow: 0 0 0 1px var(--color-primary);
}
.loadout-strat-plus {
    color: var(--color-text-muted);
    font-size: 1.25rem;
}

/* Stratagem category colors */
.strat-cat-offensive {
    background: var(--color-loadout-cat-offensive);
    border-color: var(--color-loadout-cat-offensive-border);
}
.strat-cat-defensive {
    background: var(--color-loadout-cat-defensive);
    border-color: var(--color-loadout-cat-defensive-border);
}
.strat-cat-supply {
    background: var(--color-loadout-cat-supply);
    border-color: var(--color-loadout-cat-supply-border);
}
.strat-cat-special {
    background: var(--color-loadout-cat-special);
    border-color: var(--color-loadout-cat-special-border);
}

/* Stratagem picker */
.strat-picker {
    background: var(--color-surface-0);
    border: 1px solid var(--color-loadout-gold);
}
.strat-picker-bar {
    padding: 0.4375rem 0.625rem;
    border-bottom: 1px solid var(--color-ghost-border);
}
.strat-picker-title {
    font-family: var(--font-display);
    font-size: 0.625rem;
    font-weight: 700;
    color: var(--color-loadout-gold);
    letter-spacing: 0.08em;
    text-transform: uppercase;
}
.strat-picker-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.1875rem;
    padding: 0.375rem;
}
.strat-picker-item {
    aspect-ratio: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.125rem;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.1s;
    padding: 0.125rem;
    background: none;
}
.strat-picker-item:hover:not(:disabled) {
    border-color: var(--color-loadout-gold);
}
.strat-picker-item--used {
    opacity: 0.25;
    cursor: default;
}
.strat-picker-icon {
    object-fit: contain;
}
.strat-picker-fallback {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-surface-2);
    font-family: var(--font-display);
    font-size: 0.75rem;
    color: var(--color-text-muted);
}
.strat-picker-name {
    font-size: 0.375rem;
    color: var(--color-text-muted);
    font-family: var(--font-display);
    text-transform: uppercase;
    text-align: center;
    line-height: 1.1;
}

/* Item dropdown */
.item-dropdown {
    position: relative;
}
.item-dropdown-trigger {
    width: 100%;
    background: var(--color-surface-0);
    border: 1px solid var(--color-ghost-border);
    padding: 0.5rem 0.625rem;
    display: flex;
    align-items: center;
    gap: 0.625rem;
    cursor: pointer;
    transition: border-color 0.15s;
    text-align: left;
    color: inherit;
    font: inherit;
}
.item-dropdown-trigger:hover {
    border-color: var(--color-loadout-gold);
}
.item-dropdown-trigger--open {
    border-color: var(--color-loadout-gold);
}
.item-dropdown-icon {
    width: 2.25rem;
    height: 2.25rem;
    object-fit: contain;
    background: var(--color-surface-1);
}
.item-dropdown-info {
    flex: 1;
    display: flex;
    flex-direction: column;
}
.item-dropdown-name {
    font-family: var(--font-display);
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text);
}
.item-dropdown-type {
    font-size: 0.5rem;
    color: var(--color-text-muted);
    font-family: var(--font-display);
    letter-spacing: 0.06em;
    text-transform: uppercase;
}
.item-dropdown-placeholder {
    color: var(--color-text-muted);
    font-family: var(--font-display);
    font-size: 0.8125rem;
}
.item-dropdown-arrow {
    color: var(--color-loadout-gold);
    font-size: 0.625rem;
    transition: transform 0.2s;
}
.item-dropdown-arrow--up {
    transform: rotate(180deg);
}
.item-dropdown-list {
    position: absolute;
    left: 0;
    right: 0;
    z-index: 10;
    background: var(--color-surface-0);
    border: 1px solid var(--color-loadout-gold);
    border-top: none;
    max-height: 15rem;
    overflow-y: auto;
}
.item-dropdown-option {
    width: 100%;
    padding: 0.4375rem 0.625rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    border: none;
    border-bottom: 1px solid var(--color-surface-1);
    transition: background 0.1s;
    background: none;
    text-align: left;
    color: inherit;
    font: inherit;
}
.item-dropdown-option:hover {
    background: rgba(200, 168, 50, 0.06);
}
.item-dropdown-option--selected {
    background: rgba(200, 168, 50, 0.1);
}
.item-dropdown-opt-icon {
    width: 1.75rem;
    height: 1.75rem;
    object-fit: contain;
}
.item-dropdown-opt-name {
    font-family: var(--font-display);
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--color-text);
    display: block;
}
.item-dropdown-opt-sub {
    font-size: 0.5rem;
    color: var(--color-text-muted);
    font-family: var(--font-display);
    display: block;
}
.item-dropdown-check {
    color: var(--color-loadout-gold);
    font-size: 0.75rem;
    margin-left: auto;
}

/* Perk block */
.perk-block {
    position: relative;
}
.perk-block-bar {
    width: 100%;
    padding: 0.5rem 0.75rem;
    background: var(--color-surface-1);
    border: 1px solid var(--color-ghost-border);
    border-bottom: none;
    font-family: var(--font-display);
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--color-text);
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    text-align: left;
    font: inherit;
}
.perk-block-bar--open {
    border-color: var(--color-loadout-gold);
}
.perk-block-bar--empty {
    color: var(--color-text-muted);
}
.perk-block-arrow {
    color: var(--color-loadout-gold);
    font-size: 0.625rem;
    transition: transform 0.2s;
}
.perk-block-arrow--up {
    transform: rotate(180deg);
}
.perk-block-icon-area {
    background: linear-gradient(135deg, var(--color-loadout-gold), var(--color-loadout-gold-dark));
    padding: 0.875rem;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 4rem;
    border: 1px solid var(--color-loadout-gold);
    border-top: none;
}
.perk-block-icon-area--empty {
    background: var(--color-surface-0);
    border-color: var(--color-ghost-border);
}
.perk-block-plus {
    color: var(--color-text-muted);
    font-size: 1.25rem;
}
.perk-block-dropdown {
    position: absolute;
    left: 0;
    right: 0;
    z-index: 10;
    background: var(--color-surface-1);
    border: 1px solid var(--color-loadout-gold);
    border-top: none;
}
.perk-block-option {
    width: 100%;
    padding: 0.5rem 0.625rem;
    display: flex;
    align-items: center;
    gap: 0.625rem;
    cursor: pointer;
    border: none;
    border-bottom: 1px solid var(--color-surface-2);
    transition: background 0.1s;
    background: none;
    text-align: left;
    color: inherit;
    font: inherit;
}
.perk-block-option:hover {
    background: rgba(200, 168, 50, 0.06);
}
.perk-block-option--selected {
    background: rgba(200, 168, 50, 0.1);
}
.perk-block-opt-icon {
    width: 1.75rem;
    height: 1.75rem;
    background: linear-gradient(135deg, var(--color-loadout-gold), var(--color-loadout-gold-dark));
    object-fit: contain;
}
.perk-block-opt-name {
    font-family: var(--font-display);
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--color-text);
    display: block;
}
.perk-block-opt-desc {
    font-size: 0.5rem;
    color: var(--color-text-muted);
    display: block;
}
.perk-block-check {
    color: var(--color-loadout-gold);
    font-size: 0.75rem;
    margin-left: auto;
}

/* Actions */
.loadout-actions {
    display: flex;
    gap: 0.375rem;
    margin-top: 0.5rem;
}
.loadout-btn {
    flex: 1;
    padding: 0.6875rem;
    text-align: center;
    font-family: var(--font-display);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    cursor: pointer;
    transition: filter 0.15s;
    border: none;
}
.loadout-btn:hover {
    filter: brightness(1.12);
}
.loadout-btn--save {
    background: var(--color-surface-1);
    border: 1px solid var(--color-ghost-border);
    color: var(--color-text);
}
.loadout-btn--share {
    background: linear-gradient(135deg, var(--color-loadout-gold), var(--color-loadout-gold-dark));
    color: var(--color-surface-0);
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds, `/loadout` is functional.

- [ ] **Step 4: Run all tests**

Run: `npm run test:unit:run`
Expected: All tests pass (including the hash and favorites tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/h1/Loadout/
git commit -m "feat(loadout): implement full LoadoutBuilder with all sub-components and CSS"
```

---

## Task 10: Curated Faction Guides Page

**Files:**
- Create: `src/app/loadout/guides/page.jsx`

- [ ] **Step 1: Create guides page**

Create `src/app/loadout/guides/page.jsx` with placeholder content (the project owner will write the actual guide content later):

```jsx
import { encodeLoadout } from '@/utils/loadoutHash.mjs';

export const metadata = {
    title: 'Faction Guides | Loadout Builder | Helldivers Bot',
    description: 'Curated loadout recommendations per enemy faction for Helldivers 1.',
};

const guides = [
    {
        faction: 'Bugs',
        factionIcon: '/icons/faction0.webp',
        builds: [
            {
                name: 'Bug Exterminator',
                rationale: 'Area denial and crowd control to handle swarms.',
                loadout: {
                    name: 'Bug Exterminator',
                    stratagems: ['incendiary_bombs', 'mg_turret', 'resupply', 'railcannon_strike'],
                    primary: 'sg225_breaker',
                    secondary: 'p2_peacemaker',
                    perk: 'heavy_armor',
                },
            },
        ],
    },
    {
        faction: 'Cyborgs',
        factionIcon: '/icons/faction1.webp',
        builds: [
            {
                name: 'Cyborg Buster',
                rationale: 'Anti-tank focus to deal with heavy armor units.',
                loadout: {
                    name: 'Cyborg Buster',
                    stratagems: ['railcannon_strike', 'at_turret', 'resupply', 'exo_suit'],
                    primary: 'rx1_railgun',
                    secondary: 'p2_peacemaker',
                    perk: 'stratagem_priority',
                },
            },
        ],
    },
    {
        faction: 'Illuminate',
        factionIcon: '/icons/faction2.webp',
        builds: [
            {
                name: 'Illuminate Hunter',
                rationale: 'Mobility and precision to counter shielded enemies.',
                loadout: {
                    name: 'Illuminate Hunter',
                    stratagems: ['tesla_tower', 'distortion_field', 'resupply', 'reinforce'],
                    primary: 'las13_trident',
                    secondary: 'p2_peacemaker',
                    perk: 'cardio_accelerator',
                },
            },
        ],
    },
];

export default function GuidesPage() {
    return (
        <div className="gutters flex flex-col gap-4 py-4">
            <h1>Curated Faction Guides</h1>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                Recommended loadouts per enemy faction. Click "Use This Loadout" to open in the builder.
            </p>
            {guides.map((guide) => (
                <section key={guide.faction} className="flex flex-col gap-2">
                    <h2 className="flex items-center gap-2">
                        <img src={guide.factionIcon} alt="" width={20} height={20} />
                        {guide.faction}
                    </h2>
                    {guide.builds.map((build) => {
                        const hash = encodeLoadout(build.loadout);
                        return (
                            <div
                                key={build.name}
                                style={{
                                    background: 'var(--color-surface-1)',
                                    border: '1px solid var(--color-ghost-border)',
                                    padding: '0.75rem',
                                }}
                            >
                                <div
                                    style={{
                                        fontFamily: 'var(--font-display)',
                                        fontSize: '0.875rem',
                                        fontWeight: 700,
                                        color: 'var(--color-loadout-gold)',
                                    }}
                                >
                                    {build.name}
                                </div>
                                <p
                                    style={{
                                        fontSize: '0.75rem',
                                        color: 'var(--color-text-muted)',
                                        margin: '0.25rem 0 0.5rem',
                                    }}
                                >
                                    {build.rationale}
                                </p>
                                <a
                                    href={`/loadout?b=${hash}`}
                                    style={{
                                        display: 'inline-block',
                                        padding: '0.5rem 1rem',
                                        background: 'var(--color-loadout-gold)',
                                        color: 'var(--color-surface-0)',
                                        fontFamily: 'var(--font-display)',
                                        fontSize: '0.6875rem',
                                        fontWeight: 700,
                                        letterSpacing: '0.1em',
                                        textTransform: 'uppercase',
                                        textDecoration: 'none',
                                    }}
                                >
                                    Use This Loadout
                                </a>
                            </div>
                        );
                    })}
                </section>
            ))}
        </div>
    );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds, `/loadout/guides` in route list.

- [ ] **Step 3: Commit**

```bash
git add src/app/loadout/guides/
git commit -m "feat(loadout): add curated faction guides page"
```

---

## Task 11: Final Verification

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: Clean build, both `/loadout` and `/loadout/guides` in route list.

- [ ] **Step 2: All tests**

Run: `npm run test:unit:run`
Expected: All tests pass (including loadoutHash and loadoutFavorites).

- [ ] **Step 3: Format**

Run: `npm run format`

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore(loadout): format all loadout builder files"
```
