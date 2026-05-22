# Ministry Interference — Sitewide Easter Egg

**Status:** Design (approved in brainstorming)
**Author:** Andrei
**Date:** 2026-05-23

## Summary

Replace the archives-only "Cyberstan interference" easter egg with a sitewide system: a single global controller surfaces a rare, in-universe propaganda hijack on a random opt-in element every 2-5 minutes, plus an always-on ambient micro-flicker every 15-30 seconds. The tone of the defacement is derived from humanity's overall war record — a "winning" record gets sardonic resistance-voice mocking, a "losing" record gets calm Big Brother / Skynet reassurance from the regime. The current per-page mechanism, manual opt-out, and continuous loop on defeat archives are retired in favor of the unified sitewide system.

## Goals

- Extend the easter egg from `/archives` only to every page of the site.
- Surface the effect rarely and subtly — never disrupts the actual task the user is on.
- Make the tone of the propaganda contextual to humanity's overall war record so the joke works in both directions (winning and losing).
- Reuse the existing `GlitchText` rendering machinery rather than reinventing it.
- Keep zero risk of hydration mismatch, broken layouts, or runtime errors that affect the surrounding page.

## Non-goals

- Per-season, per-faction, or per-page nuanced tone selection beyond the binary `winning` / `losing` signal.
- A manual user-facing toggle. Opt-out is via `prefers-reduced-motion` only.
- Tracking which strings the user has already seen to avoid repetition.
- Real-time updates to the war-tone signal during a session. Tone is computed server-side per request.
- A CMS or admin UI for managing the propaganda copy. Content ships in code.

## User-visible behavior

### Rare hijack

Every 2-5 minutes of active page time, exactly one opt-in element on the current page is selected at random. That element runs a single glitch cycle (takeover → hold → restore, ~2.6 seconds total) where its visible text is replaced with an in-universe propaganda line, then restored to its original "truth" text. No other element on the page changes during the hijack.

### Always-on ambient micro-flicker

Every 15-30 seconds, one random character of one random registered element flickers to a single Cyberstan glyph for 150-300ms then restores. So tiny most users will not consciously register it; gives the page a continuous, low-grade sense of unease without ever taking over.

### Tone of the defacement

Computed server-side from completed-season win/loss records:

- **`winning`** (humanity has won ≥ 50% of completed wars all-time) → resistance/hacker voice that mocks the regime's victory framing and reframes the player's pyrrhic wins as defeats. Example header swap: `"Live Statistics"` → `"Pyrrhic Statistics"`. Example OUTCOME flip on a won season: `"VICTORY"` → `"DEFEAT"`.
- **`losing`** (otherwise) → the regime/Machine voice that drowns dissent in saccharine Big Brother propaganda. Example header swap: `"Live Statistics"` → `"Sanctioned Truth"`. Existing `RESISTANCE_MESSAGES` body copy fits here.

### Accessibility

- `prefers-reduced-motion: reduce` disables both the hijack scheduler and the ambient flicker entirely — neither timer is created. Toggled live via a `matchMedia` `change` listener; no reload needed.
- Each `Hijackable` wrapper carries `aria-label={text}` so screen readers always announce the truth text and never the propaganda.
- No focus stealing, no overlays, no input blocking. Hijacks are pure visual character swaps in place.

## Architecture

### File layout

New feature folder `src/features/ministry/`:

| File | Role |
|---|---|
| `MinistryProvider.jsx` | Root-level React context provider. Owns the registry, the schedulers, the war-tone signal, and the `prefers-reduced-motion` + `visibilitychange` listeners. |
| `Hijackable.jsx` | Opt-in wrapper component. Renders as a plain `<span>` (or configurable tag) on initial render; registers with the provider on mount; runs a one-shot glitch cycle when picked. |
| `AmbientFlicker.jsx` | Internal child of the provider. Drives the always-on micro-flicker timer independently from the hijack timer. |
| `useMinistryRegistry.mjs` | Internal hook used by `Hijackable` to register/unregister and subscribe to "you're picked" callbacks. |
| `ministryContent.mjs` | Static content library: 12 pools (6 categories × 2 tones). Exports `MINISTRY_CONTENT` and `pickAlt(category, tone, rng)`. |
| `warTone.mjs` | Server-only helper. Reads completed-season outcomes from Prisma and returns `'winning' | 'losing'`. |

Mounted once in `src/app/layout.jsx`:

```jsx
<MinistryProvider warTone={await getWarTone()}>
  {children}
</MinistryProvider>
```

### Component contracts

#### `<MinistryProvider warTone="winning" | "losing">`

Single prop: `warTone`, computed server-side per request.

Internal context (consumed only by `Hijackable` and `AmbientFlicker`):

```js
{
  register(id, descriptor),
  unregister(id),
  subscribe(id, callback),       // for hijack notifications
  subscribeFlicker(id, callback),// for single-char flicker
  warTone,
}
```

`descriptor` shape:

```js
{
  text: string,                   // the truth (required)
  altText?: string,               // explicit override; otherwise content pool is used
  category: 'heading' | 'value' | 'nav' | 'button' | 'body' | 'footer',
  scope: 'global' | 'archives',   // default 'global'
}
```

#### `<Hijackable text="…" altText={…} category="heading" />`

Default render: a plain `<span>{text}</span>` with `aria-label={text}`. No visible effect, no listeners attached beyond registration.

Props:

| Prop | Default | Purpose |
|---|---|---|
| `text` | (required) | The truth text to display normally. |
| `altText` | `undefined` | Explicit override for the propaganda string; falls back to `pickAlt(category, tone, rng)`. |
| `category` | `'body'` | Selects which content pool the provider draws from. |
| `scope` | `'global'` | Restricts visibility to certain pages (`'archives'` shows only on archive pages). |
| `className` | `undefined` | Passed through to internal `GlitchText`. |
| `altClassName` | `undefined` | Passed through to internal `GlitchText` for alt-styled characters. |
| `as` | `'span'` | Wrapper tag — set to `'h1'`, `'p'`, etc. when the wrapper itself is the heading/paragraph. |

Internally: generates a stable id with `useId()`, registers/unregisters in `useEffect`, holds local `useState` for phase (`'idle' | 'takeover' | 'hold' | 'restore'`), and reuses the existing `GlitchText` for the per-character animation.

#### `AmbientFlicker`

No props. Mounted once inside `MinistryProvider`. Owns the 15-30s timer. Picks one random registered descriptor, picks one random non-space char index, calls `subscribeFlicker(id)(charIndex, durationMs)`. Reschedules on completion.

### Scheduler

Both timers live in `MinistryProvider`, both use `setTimeout` (never `setInterval`).

**Hijack timer:**

1. Wait `random(2 min, 5 min)`.
2. Filter registry by current-page scope (archives includes `global` + `archives`, all other pages include only `global`).
3. Pick one descriptor uniformly at random.
4. Resolve altText: prefer descriptor's explicit `altText`, else `pickAlt(descriptor.category, warTone, rng)`.
5. Set `isHijackActive = true`. Call subscriber. After the known cycle duration (~2.6s), set `isHijackActive = false` and reschedule.

**Ambient flicker timer:**

1. Wait `random(15s, 30s)`.
2. If `isHijackActive`, reschedule without firing.
3. Else, pick a random descriptor + char index + duration, call flicker subscriber, reschedule.

**Lifecycle:**

- Both timers start on provider mount.
- Both timers pause on `document.visibilityState === 'hidden'` and resume on visible.
- Both timers never start if `prefers-reduced-motion: reduce` is active. A live `change` listener starts/stops them when the OS setting flips.
- Both timers are torn down on provider unmount.
- The current-page scope is detected via `usePathname()` and updated on navigation. Pages under `/archives` (matched via `pathname.startsWith('/archives')`) include both `global` and `archives`-scoped descriptors; everywhere else only `global` is eligible.

### Content library

`ministryContent.mjs` exports:

```js
export const MINISTRY_CONTENT = {
  winning: { heading: [...], value: [...], nav: [...], button: [...], body: [...], footer: [...] },
  losing:  { heading: [...], value: [...], nav: [...], button: [...], body: [...], footer: [...] },
};

export function pickAlt(category, tone, rng) { /* returns string | undefined */ }
```

Approximately 6-10 entries per pool, ~80-120 strings total at launch. Authoring rules:

- In-universe Helldivers-franchise voice only — no real-world political content.
- Profanity-free; matches the franchise's dark-comedy military-propaganda tone.
- No string interpolation of user/session data — all pool entries are static.
- For the `value` category, entries are kept roughly the same character length as common stat values to avoid layout shift in fixed-width cards.

The existing `RESISTANCE_MESSAGES` array from `src/features/archives/resistanceMessages.mjs` is migrated into `MINISTRY_CONTENT.losing.body` and that file is deleted afterward. `PROPAGANDA_BODY` (the page's normal description text) is left in place — it is the page's *truth*, not propaganda.

### War tone helper

`warTone.mjs` server-side:

```js
export async function getWarTone() {
  // Reads all h1_season rows via existing Prisma query.
  // A "completed" war is one whose season number < currentSeason
  // (i.e., the war has ended and a new one has started).
  // Counts completed wars won vs total completed wars using the existing
  // getWarOutcome() helper (which already classifies victory/defeat/unknown
  // from the season's snapshots).
  // Returns 'winning' if wonCount / completedCount >= 0.5, else 'losing'.
  // On any DB error or zero completed wars, returns 'losing' (the
  // in-universe-believable fallback).
}
```

Called once per page render in `src/app/layout.jsx`. Result is passed as a prop to `MinistryProvider`. No caching beyond Next.js's request-level memoization; the cost is one cheap aggregate query per page load.

## Data flow

```
app/layout.jsx (server)
   │
   ├── await getWarTone()        ─────►  'winning' | 'losing'
   │
   └── <MinistryProvider warTone={tone}>
          │
          ├── context: { register, unregister, subscribe, subscribeFlicker, warTone }
          │
          ├── <AmbientFlicker />  ── 15-30s tick ──► subscribeFlicker(randomId)(charIdx, dur)
          │
          ├── (children: the app tree)
          │       │
          │       └── <Hijackable text="X" altText? category? scope? />
          │              │
          │              ├── useEffect mount   ─► register(id, descriptor)
          │              ├── useEffect unmount ─► unregister(id)
          │              └── subscribed callback fires ─► local phase state transitions
          │                                                through takeover → hold → restore
          │                                                rendered via internal GlitchText
          │
          └── hijack scheduler ── 2-5min tick ──► pick descriptor → resolve altText → subscribe(id)(altText)
```

## Adoption: which elements get wrapped

The wrapping is a one-time, mechanical chore. The bar for "wrap this element?" is *"would seeing this element glitch be a recognizable moment?"* — favor inclusion. Initial pass covers:

- All `<h1>` and `<h2>` headings across `src/app/**/page.jsx` and major feature components.
- Stat card labels and values inside `StatGrid`, `ArchiveStats`, dashboard cards.
- Top-nav link labels (`HeaderNav` items).
- Footer text in `Footer.jsx`.
- Archives header h1 + body, archives OUTCOME card (these already use `GlitchText` today; they migrate to `Hijackable`).

Page-hero headings get explicit `altText` props for memorable, page-specific swaps. Generic h2s and body text rely on the content pool.

## Error handling

- All scheduler ticks wrapped in the project's `tryCatch` wrapper — a thrown error is swallowed and the next tick is rescheduled. The page must never break because of the easter egg.
- `pickAlt` returning `undefined` (empty pool, missing category) causes the hijack to reschedule without firing.
- `Hijackable` unmounted between "picked" and "fire" → the unregister already cleared the subscriber callback, so the provider's call is a no-op.
- `getWarTone()` throwing server-side → falls back to `'losing'`, no rethrow, page render unaffected.
- No `try`/`catch` blocks elsewhere; the rest of the code paths are pure or already covered by React's render error boundaries.

## Performance

- Registry is a `Map<string, descriptor>`. Register/unregister O(1). Random pick O(n) but n is small (<50 typical).
- `Hijackable` in idle is just `<span>{text}</span>` — no listeners, no extra DOM.
- Context value is `useMemo`'d so downstream re-renders are not triggered by provider state changes.
- All randomness happens in `useEffect` callbacks — no work during render, no hydration concerns.
- Tab-hidden pauses both timers. No background-tab cost.
- Estimated bundle impact: 6-10KB minified (content strings dominate; logic is small).
- Compatible with the project's React Compiler — no manual memoization beyond the context value.

## Removed / changed files

| File | Action |
|---|---|
| `src/features/archives/useCyberstanEffects.mjs` | Deleted. Replaced by the global system. |
| `src/features/archives/useGlitchCycle.mjs` | Deleted. The one-shot cycle is folded into `Hijackable`. |
| `src/features/archives/resistanceMessages.mjs` | Deleted after migration. `RESISTANCE_MESSAGES` → `MINISTRY_CONTENT.losing.body`. `PROPAGANDA_BODY` stays inline in `ArchivesHeader.jsx` since it is normal-mode copy. |
| `src/features/archives/CyberstanInterference.css` | Reduced. Keep `.glitch-char`. Remove `.cyberstan-defeat`, `::before` watermark, `.cyberstan-watermark-active`. |
| `src/features/archives/ArchivesHeader.jsx` | `EffectsToggle` export removed. Header still uses `GlitchText` via `Hijackable` wrappers. `onPhaseChange` plumbing removed (provider owns the phase now). |
| `src/features/archives/ArchivesClient.jsx` | `EffectsToggle` usage removed. `useCyberstanEffects` import removed. `cyberstan-defeat`/`cyberstan-watermark-active` classes removed. Synced `glitchPhase` state removed. `useCallback` `handlePhaseChange` removed. The `getWarOutcome` import + `isDefeat` derivation stays — still used by `ArchiveStats` for the OUTCOME card's value/color logic. |
| `src/features/archives/ArchiveStats.jsx` | `GlitchText` swapped for `Hijackable` on the OUTCOME card. `glitchPhase` prop removed. |
| `localStorage` key `cyberstan-effects-disabled` | Left orphaned in existing users' browsers — harmless, not worth migration code. |

`src/features/archives/GlitchText.jsx` stays unchanged and is reused by `Hijackable` internally.

## Testing strategy

### Unit tests (Vitest) — `src/__tests__/unit/features/ministry/`

1. **`ministryContent.test.mjs`**
   - `pickAlt(category, tone, rng)` returns expected pool entries with injected RNG.
   - Exhaustive across all 12 pools — each returns a non-empty string.
   - Unknown category returns `undefined`.

2. **`warTone.test.mjs`**
   - Empty seasons → `'losing'`.
   - ≥ 50% wins → `'winning'`.
   - < 50% wins → `'losing'`.
   - Counts only completed wars; current/in-progress war excluded.
   - DB throw → `'losing'`, no re-throw.

3. **`MinistryProvider.test.jsx`** — `vi.useFakeTimers()` + injected RNG:
   - Register/unregister via context works.
   - Hijack tick picks a registered descriptor and calls its subscriber with the resolved altText.
   - Ambient flicker skips its tick while `isHijackActive`.
   - `visibilitychange` pause/resume.
   - `prefers-reduced-motion: reduce` → no timers ever scheduled.
   - `scope: 'archives'` descriptors excluded outside `/archives`.
   - Empty registry → hijack tick reschedules without throwing.

4. **`Hijackable.test.jsx`**
   - Initial render is plain `<span>{text}</span>` with `aria-label={text}` — no glitch classes.
   - Mount registers; unmount unregisters.
   - Subscriber callback drives the cycle through takeover → hold → restore (driven via fake timers).
   - Flicker subscriber callback flips one char to `.glitch-char` for duration then restores.
   - `as` prop changes the rendered tag.

### Integration test (Playwright)

`src/__tests__/e2e/ministry-easter-egg.spec.mjs` — one narrow test. Load `/archives` for a known season. Use a test-only debug hook `window.__ministry_test__.hijack(id)` (exposed only when `process.env.NODE_ENV !== 'production'`) to fire a hijack immediately on the archives header. Assert text swaps to expected altText and restores within ~3s.

### Tests removed

- Any existing tests for `useGlitchCycle`, `useCyberstanEffects` are deleted alongside their source files.
- `ArchivesHeader`/`ArchivesClient` tests that asserted on `EffectsToggle` or `cyberstan-defeat` are updated.
- Imports of `RESISTANCE_MESSAGES` in tests are repointed to `MINISTRY_CONTENT.losing.body` or removed entirely.

### Manual QA checklist (PR review only, not automated)

- `prefers-reduced-motion: reduce` on → no glitch ever fires on any page.
- `/archives` for a won season → over a 5-min wait, OUTCOME can flip to `DEFEAT`, header can swap. (Previously only happened on lost seasons.)
- `/archives` for a lost season → existing Skynet/Big Brother vibe still surfaces.
- Dashboard and generic pages over a few minutes → ambient char-flicker is visible if you watch for it; no hijack feels harshly jarring.
- Tab-out 30s, tab-in → no flurry of hijacks.
- Screen reader pass on `/archives` during a hijack → only the truth text is announced.

## Risks accepted

- **First-hijack timing is unpredictable.** A user might see one within 2 minutes; another might browse for 10 minutes and see nothing. This is the desired feel of "rare."
- **Content can feel stale within a session** if the same string appears twice. Acceptable for v1.
- **`warTone` is binary, all-time.** No per-faction or recent-window nuance. Future refinement is a one-helper change.
- **Wrapping is mechanical and easy to miss on new pages.** Missing the wrap means the easter egg doesn't fire on that element — not a bug, just a missed opportunity. Acceptable.

## Open questions

None at design time. All open scope questions were answered in brainstorming.
