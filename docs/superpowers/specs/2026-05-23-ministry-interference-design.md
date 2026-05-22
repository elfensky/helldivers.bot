# Ministry Interference — Sitewide Easter Egg

**Status:** Design — ready for implementation planning
**Author:** Andrei
**Date:** 2026-05-23 (revised same day)

## Summary

Replace the archives-only "Cyberstan interference" easter egg with a sitewide system: a single global controller surfaces a rare, in-universe propaganda hijack on a random opt-in element every 2-5 minutes, plus an always-on ambient micro-flicker every 15-30 seconds. The tone of the defacement is derived from humanity's overall war record — a "winning" record gets sardonic resistance-voice mocking, a "losing" record gets calm Big Brother / Skynet reassurance from the regime. The current per-page mechanism, manual opt-out, and continuous loop on defeat archives are retired in favor of the unified sitewide system.

## Goals

- Extend the easter egg from `/archives` only to every page of the site that has hijackable text — starting with a narrow whitelist and expanding only after layout-stability is measured.
- Surface the effect rarely and subtly — never disrupts the actual task the user is on.
- Make the tone of the propaganda contextual to humanity's overall war record so the joke works in both directions (winning and losing).
- Reuse the existing `GlitchText` rendering machinery rather than reinventing it.
- Zero hydration mismatches. No runtime errors that affect the surrounding page. (Layout stability is *measured*, not assumed — the v1 whitelist is chosen to minimize CLS risk; broader rollout follows real-world measurement.)
- Never expose visible / accessible-name divergence on interactive controls (WCAG 2.5.3).

## Non-goals

- Per-season, per-faction, or per-page nuanced tone selection beyond the binary `winning` / `losing` signal.
- A manual user-facing toggle. Opt-out is via `prefers-reduced-motion` only.
- Tracking which strings the user has already seen to avoid repetition.
- Real-time updates to the war-tone signal during a session. Tone is computed server-side per request.
- A CMS or admin UI for managing the propaganda copy. Content ships in code.

## User-visible behavior

### Rare hijack

Every 2-5 minutes of active page time, exactly one opt-in element on the current page is selected at random. That element runs a single glitch cycle (`takeover` 800ms → `hold` 1000ms → `restore` 800ms = **2600ms total**) where its visible text is replaced with an in-universe propaganda line, then restored to its original "truth" text. No other element on the page changes during the hijack.

**The `fight` phase from the existing `useGlitchCycle.mjs` is dropped.** The continuous loop's chaotic-ticker phase makes sense when the cycle repeats endlessly; for a one-shot hijack, the cleaner takeover→hold→restore arc is more readable. Cycle duration is exported as a single shared constant from the new `useMinistryHijackCycle` hook (see Architecture) so the scheduler, the test suite, and the component never disagree on it.

### Always-on ambient micro-flicker

Every 15-30 seconds, one random character of one random registered element flickers to a single Cyberstan glyph for 150-300ms then restores. So tiny most users will not consciously register it; gives the page a continuous, low-grade sense of unease without ever taking over.

### Tone of the defacement

**Both tones are "someone breaking into the Ministry's page" — different intruders, different rhetoric.** The page itself is always the Ministry of Truth's official voice. A hijack is always a third party taking over. Tone selection is computed server-side from completed-season win/loss records.

- **`winning`** (humanity has won ≥ 50% of completed wars all-time) → **the Underground / Resistance hackers** mocking the regime's victory framing. The "we won" narrative the page is selling gets reframed as pyrrhic, costly, or covered-up by hackers who know better. Example header swap: `"Live Statistics"` → `"Pyrrhic Statistics"`. Example OUTCOME flip on a won season: `"VICTORY"` → `"DEFEAT"`. Voice: sardonic, fourth-wall-aware, dry.
- **`losing`** (otherwise) → **the Underground / pirate-radio bootleg broadcast** breaking through the Ministry's airwaves to attack the regime with Skynet / Big Brother / surveillance-state imagery directed AT the Ministry. The page is officially saying "everything is fine" — the pirate hijack tells the citizen they're being watched, lied to, fed pre-approved truths. Example header swap: `"Live Statistics"` → `"You Are Being Watched"`. Voice: cold, paranoid, omniscient-but-warning. Existing `RESISTANCE_MESSAGES` body copy fits here — that material is already anti-Ministry sentiment from an outside speaker, which matches the Underground broadcast framing exactly.

**Crucially, in both tones there is a third-party intruder.** The losing tone is NOT "Ministry doubling down on itself" (which would lack narrative tension — the page is already Ministry voice). It is a bootleg broadcast cutting in with hostile-AI / surveillance-state imagery aimed at the regime. This was the resolution of Open Question #1.

### Accessibility

- `prefers-reduced-motion: reduce` disables both the hijack scheduler and the ambient flicker entirely — neither timer is created. Toggled live via a `matchMedia` `change` listener; no reload needed.
- **`<Hijackable>` is restricted to non-interactive, non-navigational text.** The category enum is `'heading' | 'value' | 'body' | 'footer'` only — `nav`, `button`, and `link` are explicitly banned. Wrapping interactive controls would create visible/accessible-name divergence (WCAG 2.5.3 violation) and unreliable announcement behavior across AT/browser combinations.
- During a hijack, the wrapper element keeps the truth text as its primary text content. Propaganda characters rendered by `GlitchText` are wrapped in `aria-hidden="true"` spans so assistive tech is never exposed to the altered text. We do NOT rely on `aria-label` on the wrapper — `aria-label` on `<span>` without a `role` is ignored by NVDA in browse mode and VoiceOver's virtual cursor still navigates into child spans.
- No focus stealing, no overlays, no input blocking. Hijacks are pure visual character swaps in place.

## Architecture

### File layout

New feature folder `src/features/ministry/`:

| File | Role |
|---|---|
| `MinistryProvider.jsx` | Provider component mounted **below** the existing `LiveDataProvider` in `src/app/layout.jsx`. Owns the schedulers and the war-tone signal. Subscribes to (does not re-register) `prefers-reduced-motion` and tab-visibility — visibility specifically is shared from `LiveDataProvider`'s existing listener via context rather than registering a second listener. |
| `Hijackable.jsx` | Opt-in wrapper component. Initial render: a wrapper element (tag chosen via `as`, default `span`) containing the truth text as primary text content. No `aria-label`. When picked, runs a one-shot glitch cycle via the shared `useMinistryHijackCycle` hook. Alt characters are rendered inside `aria-hidden="true"` spans. |
| `AmbientFlicker.jsx` | Internal child of the provider. Drives the always-on micro-flicker timer independently from the hijack timer. Per-element idle check at fire-time. |
| `useMinistryHijackCycle.mjs` | **Single authoritative state machine.** Exports the cycle constants (`TAKEOVER_MS=800`, `HOLD_MS=1000`, `RESTORE_MS=800`, `CYCLE_MS=2600`) and the hook that consumers (Hijackable, tests) use to drive the takeover→hold→restore transition. Replaces — does NOT duplicate — the deleted `useGlitchCycle.mjs`. |
| `ministryRegistry.mjs` | Module-level `useRef`-backed store (a `Map<id, descriptor>`) plus subscribe/unsubscribe API. Notifies hijack/flicker targets via direct callback invocation, not via React context updates. Backed by `useSyncExternalStore` for any consumers that need to read registry state during render. |
| `ministryContent.mjs` | Static content library: 8 pools (4 categories × 2 tones). Exports `MINISTRY_CONTENT` and `pickAlt(category, tone, rng)`. Categories: `heading`, `value`, `body`, `footer`. |
| `warTone.mjs` | Server-only helper. Reads completed-season outcomes from Prisma and returns `'winning' | 'losing' | null` (null = disable effect entirely). |

Mounted **inside** `LiveDataProvider` in `src/app/layout.jsx`:

```jsx
<LiveDataProvider>
  <MinistryProvider warTone={await getWarTone()}>
    {children}
  </MinistryProvider>
</LiveDataProvider>
```

This nesting matters: `MinistryProvider` reads tab-visibility from `LiveDataProvider`'s existing context (no second `visibilitychange` listener), and subscribes to `LiveDataProvider`'s app-version-mismatch reload signal so it can cancel all in-flight timers before `guardedReload()` fires.

Also required in `src/app/layout.jsx`:

```jsx
export const dynamic = 'force-dynamic';
```

Without this, a CDN-cached render could bake a stale `warTone` into the HTML — persisting across multiple sessions until the cache invalidates. If `dynamic = 'force-dynamic'` is unacceptable for performance reasons, the staleness must be explicitly documented in "Risks accepted" and the team must accept that the easter egg's tone may be wrong for hours/days after a war flips.

### Component contracts

#### `<MinistryProvider warTone={…}>`

Single prop: `warTone: 'winning' | 'losing' | null`, computed server-side per request. `null` disables the effect entirely — no timers scheduled, no registrations accepted, no rendering changes.

Context value (consumed only by `Hijackable` and `AmbientFlicker`):

```js
{
  register(id, descriptor),       // forwards to module-level registry ref
  unregister(id),                 // forwards to module-level registry ref
  subscribe(id, callback),        // hijack notification callback
  subscribeFlicker(id, callback), // ambient flicker callback (per-element)
  warTone,                        // 'winning' | 'losing' | null
}
```

**The context value is a stable object.** All five callbacks are created once on mount via `useCallback` (or once at module load); none are recreated on registry changes. The `Map<id, descriptor>` storing registrations lives in a `useRef`, not in React state — so a `<Hijackable>` mounting or unmounting does NOT invalidate the context value. Subscribers see `register`/`unregister` as identity-stable functions; mount/unmount cascades do not propagate as React re-renders. (This is the core stability decision after the adversarial spec review — Map mutation cannot be allowed to drive context-value invalidation, or every `Hijackable` re-renders on every navigation.)

`descriptor` shape:

```js
{
  text: string,                       // the truth (required)
  altText?: string,                   // explicit override; otherwise content pool is used
  category: 'heading' | 'value' | 'body' | 'footer',  // nav/button/link banned (accessibility)
  scope: 'global' | 'archives',       // default 'global'
}
```

#### `<Hijackable text="…" altText={…} category="heading" as="h1" />`

Default render: a wrapper element (tag chosen via `as`, default `span`) containing the truth text as direct text content. No `aria-label`. No glitch classes. No listeners attached beyond registration.

Props:

| Prop | Default | Purpose |
|---|---|---|
| `text` | (required) | The truth text to display normally. |
| `altText` | `undefined` | Explicit override for the propaganda string; falls back to `pickAlt(category, tone, rng)`. |
| `category` | `'body'` | One of `'heading' \| 'value' \| 'body' \| 'footer'`. `nav`, `button`, `link` are banned (see Accessibility). |
| `scope` | `'global'` | `'archives'` registers only when the current path matches `/archives`. |
| `className` | `undefined` | Passed through to internal `GlitchText`. |
| `altClassName` | `undefined` | Passed through to internal `GlitchText` for alt-styled characters. |
| `as` | `'span'` | Wrapper tag. Use `'h1'`/`'h2'`/`'p'` when the wrapper IS the semantic element. |

**Wrapping pattern — use ONE consistent form across the codebase.** When wrapping a heading or paragraph, use `as` to make `<Hijackable>` itself the semantic element: `<Hijackable as="h1" category="heading" text="My Title" />`. Never nest `<Hijackable>` inside an existing semantic element (`<h1><Hijackable text="..." /></h1>` is banned by convention) — the two patterns have different accessibility behavior and mixing them creates a maintenance trap.

Internally: generates a stable id with `useId()`, registers/unregisters in `useEffect`, holds local `useState` for phase (`'idle' | 'takeover' | 'hold' | 'restore'`) via the shared `useMinistryHijackCycle` hook, and reuses the existing `GlitchText` for the per-character animation. The component sets a flag (`isIdle: boolean`) on its registry entry whenever its phase changes, so the ambient flicker timer can skip elements that are mid-hijack (see Scheduler).

During hijack, alt-styled characters from `GlitchText` are wrapped in `aria-hidden="true"` spans. The wrapper element's primary text content (which assistive tech announces) continues to read the truth.

#### `AmbientFlicker`

No props. Mounted once inside `MinistryProvider`. Owns the 15-30s timer. Picks one random registered descriptor, picks one random non-space char index, calls `subscribeFlicker(id)(charIndex, durationMs)`. Reschedules on completion.

### Scheduler

Both timers live in `MinistryProvider`, both use `setTimeout` (never `setInterval`). Both no-op when `warTone === null` (effect disabled).

A `pathnameRef = useRef(pathname)` is maintained — `usePathname()` is read once and the ref is updated in a `useEffect` that runs on every pathname change. **Scope eligibility is evaluated against `pathnameRef.current` at pick-time**, NOT via a render-gated filter dependency. This eliminates the ~16ms stale-registration race that would otherwise let an `archives`-scoped descriptor from the previous page be eligible on the next.

**Hijack timer:**

1. Wait `random(2 min, 5 min)`.
2. Read `pathnameRef.current`. Filter registry: pages under `/archives` (matched via `pathname.startsWith('/archives')`) include both `global` and `archives`-scoped descriptors; everywhere else only `global` is eligible.
3. Pick one descriptor uniformly at random from the filtered set. Empty filtered set → no-op, reschedule.
4. Resolve altText: prefer descriptor's explicit `altText`, else `pickAlt(descriptor.category, warTone, rng)`. `undefined` result → no-op, reschedule.
5. Mark the target descriptor `isIdle = false` in the registry. Call subscriber. After exactly `CYCLE_MS` (2600ms from `useMinistryHijackCycle`), mark `isIdle = true` and reschedule.

**Ambient flicker timer:**

1. Wait `random(15s, 30s)`.
2. Filter registry to descriptors where `isIdle === true` AND scope-eligible against `pathnameRef.current`. (Per-element idle check, not a global `isHijackActive` flag — prevents the "double-restore collision" where a flicker mid-hold could write a propaganda character into the restored truth.)
3. If empty, reschedule without firing.
4. Else, pick a random descriptor + char index + duration `random(150ms, 300ms)`. Call its flicker subscriber. Reschedule.

**Lifecycle:**

- Both timers start on provider mount, only when `warTone !== null`.
- Both timers pause on tab-hidden — read from `LiveDataProvider`'s shared visibility context, no second `visibilitychange` listener is registered. Resume on visible.
- Both timers never start if `prefers-reduced-motion: reduce` is active. A live `matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', …)` starts/stops them when the OS setting flips.
- Both timers cancel cleanly when `LiveDataProvider`'s app-version-mismatch reload signal fires (via `guardedReload()`), so the unload sequence doesn't leave orphaned timers firing during the new page's hydration.
- Both timers are torn down on provider unmount.

### Content library

`ministryContent.mjs` exports:

```js
export const MINISTRY_CONTENT = {
  winning: { heading: [...], value: [...], body: [...], footer: [...] },
  losing:  { heading: [...], value: [...], body: [...], footer: [...] },
};

export function pickAlt(category, tone, rng) { /* returns string | undefined */ }
```

**Minimum 12 entries per pool** (8 pools × 12 = 96 strings minimum at launch). A Vitest assertion in `ministryContent.test.mjs` enforces this — contributors cannot ship a pool below the threshold. The 12-entry floor is derived from realistic browse durations: at 2-5 min between hijacks, a 30-minute browse on a page with 5 hijackable elements yields ~6-15 hijacks; with 12 entries the chance of immediate repetition (back-to-back same string) drops to acceptable for v1.

Authoring rules:

- In-universe Helldivers-franchise voice only — no real-world political content.
- Profanity-free; matches the franchise's dark-comedy military-propaganda tone.
- No string interpolation of user/session data — all pool entries are static.
- For the `value` category, entries are kept roughly the same character length as common stat values to minimize CLS in fixed-width cards. Even so, `value` is **not** in the v1 adoption whitelist (see Adoption) — it's deferred until CLS is measured.

The existing `RESISTANCE_MESSAGES` array from `src/features/archives/resistanceMessages.mjs` is migrated into `MINISTRY_CONTENT.losing.body` and that file is deleted afterward. `PROPAGANDA_BODY` (the page's normal description text) is left in place — it is the page's *truth*, not propaganda.

### War tone helper

`warTone.mjs` server-side. Returns `'winning' | 'losing' | null` — null disables the effect entirely.

```js
export async function getWarTone() {
  // 1. Load all h1_season rows with their snapshots.
  // 2. Compute "completed" wars: a season is completed if getWarOutcome() returns
  //    a definitive 'victory' or 'defeat' classification (NOT 'unknown'). This
  //    avoids the season-number-shortcut pitfall: the HD1 API has documented
  //    transition lag and closing-snapshot writes, so seasons in the brief
  //    "between currentSeason - 1 and currentSeason" window may not yet have
  //    their final snapshot — getWarOutcome's 'unknown' is the only honest
  //    "not done yet" signal.
  // 3. Count wonCount = completed wars with outcome 'victory'.
  // 4. Count completedCount = wonCount + completed wars with outcome 'defeat'.
  // 5. If completedCount === 0 → return null (effect disabled, not silently 'losing').
  // 6. Return 'winning' if wonCount / completedCount >= 0.5, else 'losing'.
  // 7. On any DB error → return null (effect disabled, not forced 'losing').
  //    Silently injecting wrong tone during operational failures is worse than
  //    no effect.
}
```

Called once per page render in `src/app/layout.jsx`. **`layout.jsx` must declare `export const dynamic = 'force-dynamic'`** (see Architecture/Mounting) to prevent a CDN-cached render baking a stale `warTone` into the HTML across sessions. The DB query is one cheap aggregate per page load.

## Data flow

```
app/layout.jsx (server) — export const dynamic = 'force-dynamic'
   │
   ├── await getWarTone()        ─────►  'winning' | 'losing' | null
   │
   └── <LiveDataProvider>  (existing — owns visibilitychange, guardedReload signals)
          │
          └── <MinistryProvider warTone={tone}>
                 │  (no-op if warTone === null)
                 │
                 ├── stable context: { register, unregister, subscribe, subscribeFlicker, warTone }
                 │   (callbacks created once; registry lives in useRef, NOT React state)
                 │
                 ├── <AmbientFlicker />  ── 15-30s tick ──► per-element idle check ──►
                 │                                          subscribeFlicker(randomId)(charIdx, dur)
                 │
                 ├── (children: the app tree)
                 │       │
                 │       └── <Hijackable as="h1" category="heading" text="X" />
                 │              │
                 │              ├── useEffect mount   ─► register(id, descriptor)  (no re-renders)
                 │              ├── useEffect unmount ─► unregister(id)            (no re-renders)
                 │              ├── isIdle flag on registry entry updated on every phase change
                 │              └── subscribed callback fires ─► useMinistryHijackCycle drives
                 │                                                takeover → hold → restore via
                 │                                                GlitchText (alt chars aria-hidden)
                 │
                 └── hijack scheduler ── 2-5min tick ──► filter registry by pathnameRef.current
                                                        + isIdle ──► pick ──► resolve altText
                                                        ──► subscribe(id)(altText)
```

## Adoption: which elements get wrapped

### v1 whitelist (ship this scope, no more)

- All `<h1>` and `<h2>` headings across `src/app/**/page.jsx` and major feature components.
- Archives header h1 + body, archives OUTCOME card (already use `GlitchText` today; they migrate to `Hijackable`).
- Decorative body-text paragraphs (long-form descriptions on landing/docs pages — NOT inline UI text in stat cards or tooltips).

Page-hero headings get explicit `altText` props for memorable, page-specific swaps. Generic h2s and body text rely on the content pool.

### v1 explicitly excluded (deferred until measurement)

- **Nav links, button labels, link text.** Banned by the accessibility constraint (see Accessibility); also covered by the category enum (no `nav`/`button`/`link` categories exist).
- **Stat card values and labels.** Layout shift risk is highest in fixed-width cards; defer until the v1 rollout proves the CLS approach for headings, then revisit with measured data.
- **Footer text.** Defer to v2; the footer is a low-impact surface and the v1 priority is proving the system works on headings.
- **Hidden / off-screen content.** Don't wrap items that aren't visible — they're not interesting to hijack and they bloat the registry.

### Authoring rules for the v1 whitelist

- Use `<Hijackable as="h1" category="heading" text="...">` for headings — the wrapper IS the semantic element. Never nest inside an existing `<h1>` (see Component contracts).
- If a wrapped element previously carried a `data-umami-event` attribute (or any other analytics/tracking attribute that the repo's `CLAUDE.md` requires), the attribute MUST be preserved on the `<Hijackable>` wrapper element. The wrapping must not silently destroy tracking. (Per the repo convention, every interactive element carries an analytics attribute — even though interactive elements are excluded from hijack in v1, this rule guards against accidental regression if scope expands.)
- A page can be safely visited without any `<Hijackable>` wrappers — the easter egg silently no-ops. So wrapping is incremental: ship a partial rollout, expand over time.

## Error handling

- All scheduler ticks wrapped in the project's `tryCatch` wrapper — a thrown error is swallowed and the next tick is rescheduled. The page must never break because of the easter egg.
- `pickAlt` returning `undefined` (empty pool, missing category) causes the hijack to reschedule without firing.
- `Hijackable` unmounted between "picked" and "fire" → the unregister already cleared the subscriber callback, so the provider's call is a no-op.
- `getWarTone()` throwing server-side → returns `null`, no rethrow, page render unaffected. `null` warTone disables the effect entirely (no timers, no registrations, no rendering changes) rather than forcing a single tone — silently injecting wrong content on operational failure is worse than no easter egg.
- No `try`/`catch` blocks elsewhere; the rest of the code paths are pure or already covered by React's render error boundaries.

## Performance

- Registry is a `Map<string, descriptor>` held in a `useRef` — never in React state. Mutating it does NOT invalidate the context value, which is a stable callback object created once on mount. Register/unregister is O(1) and triggers no React re-renders. Random pick is O(n) but n is small (v1 whitelist limits to ~10-30 wrappers per page).
- `Hijackable` in idle is just `<span>{text}</span>` (or `<h1>{text}</h1>` etc. via `as`) — no listeners, no extra DOM, no glitch classes.
- All randomness happens in `useEffect` callbacks — no work during render, no hydration concerns.
- Tab-hidden pauses both timers via `LiveDataProvider`'s existing visibility signal (no duplicate listener). No background-tab cost.
- Estimated bundle impact: 6-10KB minified (content strings dominate; logic is small).
- Compatible with the project's React Compiler — the provider's callbacks are referentially stable; the component tree below has no provider-driven cascades.

## Removed / changed files

| File | Action |
|---|---|
| `src/features/archives/useCyberstanEffects.mjs` | Deleted. Replaced by the global system. |
| `src/features/archives/useGlitchCycle.mjs` | Deleted, **replaced** by `src/features/ministry/useMinistryHijackCycle.mjs` — the single authoritative state machine. The replacement exports `TAKEOVER_MS=800`, `HOLD_MS=1000`, `RESTORE_MS=800`, `CYCLE_MS=2600` as named constants used by `Hijackable`, the scheduler, and the test suite (so they never disagree on timing). The `fight` phase from the original is dropped — one-shot hijacks don't benefit from chaotic-ticker padding the way the continuous loop did. |
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
   - Exhaustive across all 8 pools (4 categories × 2 tones) — each returns a non-empty string.
   - Unknown category returns `undefined`.
   - **Pool size assertion**: `expect(MINISTRY_CONTENT[tone][category].length).toBeGreaterThanOrEqual(12)` for every (tone, category) pair. Enforces the 12-entry minimum at CI time.

2. **`warTone.test.mjs`**
   - Empty completed seasons → `null` (effect disabled).
   - ≥ 50% wins → `'winning'`.
   - < 50% wins → `'losing'`.
   - Only seasons with definitive `getWarOutcome()` of `'victory'` or `'defeat'` count as completed; `'unknown'` is excluded.
   - DB throw → `null`, no re-throw.

3. **`MinistryProvider.test.jsx`** — `vi.useFakeTimers()` + injected RNG:
   - Register/unregister via context works.
   - `warTone: null` → no timers ever scheduled; registrations rejected silently.
   - Hijack tick picks a registered descriptor and calls its subscriber with the resolved altText.
   - **Per-element idle check**: ambient flicker skips elements whose `isIdle === false`, not just globally.
   - **Pick-time pathname check**: with two registered descriptors (`global` + `archives`), navigating from `/archives` to `/` between scheduler tick and pick uses the *current* pathname (the `global`-only filter applies), not the stale pathname.
   - Visibility-shared signal: when the consuming context's `isVisible === false`, both timers pause; resume on visible.
   - `prefers-reduced-motion: reduce` → no timers ever scheduled.
   - `scope: 'archives'` descriptors excluded outside `/archives`.
   - Empty registry → hijack tick reschedules without throwing.
   - LiveDataProvider's reload signal → all in-flight timers cancelled.

4. **`Hijackable.test.jsx`**
   - Initial render is the wrapper element with `text` as primary text content — **no `aria-label`**, no glitch classes.
   - Mount registers; unmount unregisters.
   - Subscriber callback drives the cycle through takeover → hold → restore using exact constants from `useMinistryHijackCycle` (TAKEOVER 800ms + HOLD 1000ms + RESTORE 800ms = 2600ms total) driven via fake timers.
   - During hijack, alt-styled characters are rendered with `aria-hidden="true"`.
   - Flicker subscriber callback flips one char to `.glitch-char` for duration then restores.
   - `as` prop changes the rendered tag.
   - Category enum at runtime: only `'heading' | 'value' | 'body' | 'footer'` accepted; passing `'nav'` or `'button'` throws a dev-time assertion (or fails type-check via JSDoc).
   - When the picked element is mid-hijack, its registry entry has `isIdle === false` until exactly `CYCLE_MS` after the subscriber fires.

5. **`useMinistryHijackCycle.test.mjs`** — pure state machine, fake timers:
   - Phases transition idle → takeover → hold → restore → idle with the exact constants exported.
   - Total cycle duration is exactly `CYCLE_MS` (2600ms).

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
- Generic page (home, docs) over a few minutes → ambient char-flicker is visible if you watch for it; no hijack feels harshly jarring.
- Tab-out 30s, tab-in → no flurry of hijacks.
- Screen reader pass on `/archives` during a hijack — VoiceOver, NVDA, JAWS — only the truth text is announced (no propaganda from aria-hidden glitch spans).
- Navigate from `/archives` to `/` and immediately wait for a hijack → no archives-scoped propaganda fires on the home page (pick-time pathname check working).
- **CLS measurement**: Lighthouse run on home + `/archives` after v1 ships, with multiple hijacks triggered via the test hook. CLS score must not regress measurably vs. pre-rollout baseline. (Gate before considering v2 scope expansion.)
- DevTools Network: check `/api/h1/live` etc. continue functioning during ambient flickers (catches accidental interference between the two providers).

## Risks accepted

- **First-hijack timing is unpredictable.** A user might see one within 2 minutes; another might browse for 10 minutes and see nothing. This is the desired feel of "rare."
- **Content can feel stale within a session** if the same string appears twice. The 12-entry minimum reduces this to acceptable for v1.
- **`warTone` is binary, all-time.** No per-faction or recent-window nuance. Future refinement is a one-helper change.
- **Wrapping is mechanical and easy to miss on new pages.** Missing the wrap means the easter egg doesn't fire on that element — not a bug, just a missed opportunity. Acceptable.
- **v1 ships with no values/nav/footer/stat-card hijacks.** Deliberately narrow scope, expanded after layout measurement. Easter egg's surface area is smaller than originally pitched, by design.
- **`warTone` becomes `null` during any DB outage** → the easter egg silently disappears for the duration. Acceptable; better than serving wrong tone.

## Open questions

None remaining at design time.

**Closed: Tone-direction for losing state (Open Question #1)** — resolved 2026-05-23 in favor of Sonnet's option (b): keep the `losing` → anti-government direction but change the speaker identity from "Ministry doubling down" to **"Underground / pirate-radio bootleg broadcast"**. Both tones now share a "third-party hijack" framing — the only thing that changes between tones is which third party is breaking in (Resistance mockery vs. Underground surveillance-state warnings). See updated **User-visible behavior → Tone of the defacement**.

## Revision history

- **2026-05-23 v1.0** — initial design after brainstorming session.
- **2026-05-23 v1.2** — Open Question #1 closed. Losing tone re-framed as Underground / pirate-radio bootleg broadcast (third-party intruder with anti-regime surveillance-state imagery), preserving the "hijack" framing across both tones.
- **2026-05-23 v1.1** — revisions from 3-round adversarial AI debate (`~/.claude-octopus/debates/debates/001-ministry-interference-spec-critique/`):
  - **Architecture:** mount inside `LiveDataProvider`; share visibility signal; cancel timers on `guardedReload`.
  - **MinistryProvider:** registry moved to `useRef` (not React state); stable callbacks; no context-value invalidation on mount/unmount.
  - **Hijackable:** removed `aria-label`; alt chars now `aria-hidden`; pattern locked to `as` for semantic elements (no nesting).
  - **Scheduler:** scope eligibility evaluated at pick-time against `pathnameRef.current`; per-element idle check on ambient flicker (fixes double-restore collision).
  - **Cycle:** explicitly drops `fight` phase; pins `CYCLE_MS=2600` as a shared constant from new `useMinistryHijackCycle` hook (replaces, not deletes, `useGlitchCycle`).
  - **Content:** category enum narrowed to `'heading' | 'value' | 'body' | 'footer'` (banned `nav`, `button`, `link`); minimum 12 entries per pool with Vitest enforcement.
  - **Adoption:** sharply cut v1 scope to headings + decorative body + archives migration; deferred values/nav/footer/stat-cards.
  - **War tone:** `null` return on DB error / zero completed wars (effect disabled) instead of forced `'losing'`; uses `getWarOutcome` for "completed" classification; `layout.jsx` requires `dynamic = 'force-dynamic'` for cache freshness.
  - **Goals:** removed "zero risk of broken layouts" overclaim; added WCAG 2.5.3 commitment.
