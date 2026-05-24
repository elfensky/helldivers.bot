# Ministry Interference v2 — Per-Component Content + Overlay Effects

**Status:** Design — ready for implementation planning
**Author:** Andrei
**Date:** 2026-05-24
**Supersedes:** [`2026-05-23-ministry-interference-design.md`](2026-05-23-ministry-interference-design.md) (v1 — shipped in 0.50.0, augmented by 0.52.0)

## Summary

Replace the v1 "rare hijack swaps the full sentence" mechanic with a per-component, multi-overlay system. Every `<Hijackable>` declares its own propaganda content for each effect it opts into; the truth text is **never** mutated visually (only an alien-glyph char-flicker remains as an ambient layer). The random scheduler stays for non-admin users but now filters Hijackables to those intersecting the viewport. The 0.52.0 floating admin-trigger widget is replaced by per-Hijackable icon-button strips. All effect rendering + scheduling + admin UI code is lazy-loaded via `next/dynamic` so it stays out of the critical-path bundle.

## Goals

- Eliminate user confusion caused by sentence-swap hijacks. New effects are visually obvious as "third-party intrusion" rather than "the page changed its mind".
- Move propaganda content from global category × tone pools into per-component explicit declarations, so each Hijackable's propaganda fits the design of its specific location.
- Give admins per-component trigger buttons (one per supported effect) so individual effects can be reproduced on demand without random-scheduler delay or tab juggling.
- Make the random scheduler viewport-aware — random fires that miss the user's current scroll position are wasted effort.
- Ship the entire effect/scheduler subsystem as a lazy chunk; truth text always renders in SSR, but no Ministry JS is in the critical path.

## Non-goals

- Tracking which effects/strings the user has already seen.
- A user-facing toggle for the easter egg (still relies on `prefers-reduced-motion` only).
- Per-season, per-faction nuanced tone selection beyond the existing binary `winning` / `losing` signal from `getWarTone()`.
- A new effect type beyond the four listed below (scribble, margin, message, flicker). The system is structured to allow more later but v1 ships only these four.
- Real-time tone updates during a session. `warTone` is computed server-side per request, unchanged from v1.

## User-visible behavior

### Effect repertoire (replaces v1's full-text-swap hijack)

Three new intrusion effects + the existing flicker. **All four effects leave the truth text intact in the DOM and visible underneath** — the user can always read the real content. Overlays are `aria-hidden`; assistive tech is never exposed to propaganda.

**Scribble overlay** — random Cyberstan glyphs (8–12 chars) drawn across the element via an absolute-positioned overlay. ~2.2s total (fade-in → hold → fade-out). The "graffiti across the title" idiom. Glyph set is the existing `GLYPH_CHARS` (`'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'`) rendered in `--font-cyberstan` at 1.2em.

**Margin marker** — Cyberstan-font glyph cluster scrawled to the right of the wrapper (`left: 100%; margin-left: 0.5em`). ~2s. The "someone tagged this in the margin" idiom. Content is declared per-component as a string or randomly-picked-from-array.

**Message banner** — bordered banner appears below the wrapper (`top: 100%`) with per-component propaganda text. ~3.2s with slide-in / hold / fade-out. The "intercept signal" idiom. Styled with `--color-primary` border, `--color-surface-1` background, `--font-mono`.

**Char-flicker** — unchanged from v1. Every 15–30s, one truth character swaps to a single Cyberstan glyph for 150–300ms. Now viewport-filtered.

**Removed**: the v1 `takeover → hold → restore` full-sentence text-swap. Gone entirely. The `useMinistryHijackCycle.mjs` hook that powered it is deleted.

### Random scheduler (still fires for non-admin users)

Two independent timers in `MinistryScheduler` (separate `setTimeout`s, never `setInterval`):

| Scheduler | Cadence | Filter | Fires |
|---|---|---|---|
| Main effect | 2–5 min | `isIdle && isInViewport && scope-eligible && effects ⊃ {scribble, margin, message}` | One eligible Hijackable, one of its main effects at random |
| Flicker | 15–30 s | `isIdle && isInViewport && scope-eligible && effects ⊃ {flicker}` | One eligible Hijackable, fires flicker |

Both keep the existing `document.hidden` no-fire gate and the live `prefers-reduced-motion` matchMedia listener (`enabled = warTone !== null && !reducedMotion`).

### Viewport eligibility

Each `<Hijackable>` mounts an `IntersectionObserver` (`threshold: 0.1`) on its wrapper. Intersection callbacks call `ctx.setInViewport(id, isIntersecting)`. The registry stores `isInViewport: boolean` (defaults `false` until the IO's first callback fires next-frame). The scheduler's `pickEligible` honors `requireInViewport: true`.

A random fire that finds no in-viewport eligible Hijackable just reschedules without firing (graceful — same pattern as the v1 "empty registry" path).

### Admin trigger UI

When `MinistryContext.isAdmin === true` (server-resolved from the BetterAuth session in `layout.jsx`, same plumbing as 0.52.0), each `<Hijackable>` renders a small icon-button strip as a flow sibling of the truth span — one button per opted-in main effect:

```
Track Managed Democracy Across the Galaxy [S][M][B]
                                           ↑  ↑  ↑
                                       scribble
                                          margin
                                            banner/msg
```

Buttons: monospace, `var(--color-primary)` border on transparent background, inverted on hover/focus. Each carries an explicit `aria-label` (e.g. `"Trigger scribble effect"`). The strip is INLINE — slight admin-only layout shift after each Hijackable is accepted as the cost of avoiding overflow problems an absolute-positioned strip would have.

**Flicker is not exposed as an admin button** — it fires every 15–30s naturally, no need to trigger.

Click flow: `ctx.triggerEffect(id, type)` — same code path the random scheduler uses, just bypasses the random delay. Honors the registry's `isIdle` flag: clicks during an in-progress effect are silent no-ops (admin waits ~2-3s for the running effect to complete).

### Accessibility

Carries forward v1's WCAG 2.5.3 stance, strengthened:

- Truth text **always** stays in the DOM and visually visible during scribble/margin/message — these are pure overlays, the underlying truth is never replaced.
- Char-flicker: brief (150–300ms) single-character glyph swap. So short most AT doesn't re-announce. (Same v1 behavior.)
- All overlays are `aria-hidden="true"`.
- Admin trigger buttons are NOT aria-hidden — they're real interactive controls. Each has an `aria-label`.
- `<Hijackable>` still bans `nav` / `button` / `link` categories from v1. Actually, since `category` is removed in v2 (see below), the ban is enforced at the call-site level: don't wrap interactive controls. Lint rule or dev-mode runtime check optional.

## Architecture

### File changes

**Deleted**:

- `src/features/ministry/ministryContent.mjs` — the global `MINISTRY_CONTENT` pools + `pickAlt()` helper. Per-component explicit content makes shared pools obsolete. The 96 hand-authored v1 propaganda strings are not auto-migrated; they are redistributed by hand onto the specific Hijackables where they fit, or dropped where no good location exists.
- `src/features/ministry/useMinistryHijackCycle.mjs` — powered the v1 text-swap `takeover → hold → restore` state machine; nothing in v2 uses it.
- `src/features/admin/MinistryTriggerWidget.jsx` — the floating global widget shipped in 0.52.0; replaced by per-Hijackable button strips.
- `src/__tests__/unit/features/admin/MinistryTriggerWidget.test.jsx` — its tests.
- `src/__tests__/unit/features/ministry/useMinistryHijackCycle.test.mjs` — tests for the deleted hook.

**Modified**:

- `src/features/ministry/Hijackable.jsx` — becomes a thin sync shell (~30 LOC). Always renders the truth text; conditionally renders the dynamically-imported `<HijackableEffects>` when any effect prop is set. Props change as documented in *Component API* below.
- `src/features/ministry/MinistryProvider.jsx` — becomes a thin sync shell (~80 LOC). Owns the registry + builds the context value (`register`, `unregister`, `setIdle`, `setInViewport`, `triggerEffect`, `warTone`, `isAdmin`); dynamically imports `<MinistryScheduler>` when `warTone !== null`.
- `src/features/ministry/MinistryContext.mjs` — JSDoc updated for the new context shape (adds `setInViewport`, `triggerEffect`, `isAdmin`; removes nothing from v1 0.52.0's surface except renames `forceHijack` to `triggerEffect`).
- `src/features/ministry/MinistryInterference.css` — augmented with overlay rules for scribble / margin / message / admin-triggers; the existing `.glitch-char` flicker class stays. Imported by `HijackableEffects.jsx`, so the CSS rides the lazy chunk.
- `src/features/ministry/ministryRegistry.mjs` — gain a `setInViewport(id, bool)` method and extend descriptors with `isInViewport: boolean` (default `false`) and `effects: string[]`. `pickEligible` gains optional `requireInViewport` and `hasEffect` filters.
- `src/app/layout.jsx` — drop the `<MinistryTriggerWidget isAdmin={isAdmin} />` mount from 0.52.0. Continue passing `warTone` + `isAdmin` props to `<MinistryProvider>`.
- **Every existing `<Hijackable>` call site** — drop `category` / `altText`; add per-effect opt-ins authored to fit that specific location. Sites: `DashboardClient.jsx` (hero heading), `ArchivesHeader.jsx` (header h1 + body), `ArchiveStats.jsx` (OUTCOME card), `/stats` headings, `/legal` headings, `/docs/brandkit` section headings, `/sign-in` heading. ~7–10 sites total.

**Added**:

- `src/features/ministry/HijackableEffects.jsx` — heavy lazy-loaded client component. Owns: registry registration via `ctx.register`, `IntersectionObserver` wiring via `ctx.setInViewport`, internal state for active scribble / margin / message / flicker, overlay rendering, admin trigger button strip. ~250 LOC.
- `src/features/ministry/MinistryScheduler.jsx` — heavy lazy-loaded scheduler component. Owns the two `setTimeout` schedulers (main + flicker), `document.hidden` gate, pathname ref, and reads from the registry passed via prop. ~150 LOC.

### Component API

```jsx
<Hijackable
  // Truth (required, unchanged)
  text="Track Managed Democracy"

  // Effect opt-ins
  scribble                                  // boolean — random Cyberstan glyphs across element
  margin="⌐ Øæ ⊨∇"                           // string OR array of strings — glyph cluster, margin
  message="// SIGNAL INTERCEPTED"           // string OR array of strings — banner below element
  flicker                                   // boolean — existing single-char glyph swap

  // Scoping (unchanged from v1)
  scope="global"                            // 'global' | 'archives' — eligibility filter

  // Layout (unchanged from v1)
  as="span"
  className="..."
/>
```

**Asymmetric opt-in semantics**: boolean for content-less effects (`scribble`, `flicker`), value-as-content for content-bearing effects (`margin`, `message`). Reads naturally at the call site and matches "the component carries its own content" framing.

**Array values** for content-bearing effects let a single element host several propaganda options without re-introducing global pools — `margin={["⌐ Øæ ⊨∇", "Δ ⌘ ⊕ ⌬"]}` picks one at random each fire.

**Removed props** (from v1): `category` (no more pools), `altText` (no more text-swap), `altClassName` (per-effect styles live in CSS, not as overrides).

**Inert default**: a `<Hijackable text="X" />` with no effect props renders the truth plain and does NOT register with the provider. The scheduler will never pick it. Migration safety net for un-updated v1 call sites. Dev-mode `console.warn` flags this case in `NODE_ENV !== 'production'`.

### Registry shape

```js
// ministryRegistry.mjs entries
{
  text: string,
  scope: 'global' | 'archives',
  effects: Array<'scribble' | 'margin' | 'message' | 'flicker'>,
  margin: string | string[] | null,     // content for margin effect
  message: string | string[] | null,    // content for message effect
  onEffect: (type) => void,             // unified dispatch (replaces v1 onHijack + onFlicker)
  isIdle: boolean,                      // existing
  isInViewport: boolean,                // NEW — IntersectionObserver target state
}
```

`pickEligible({ rng, pathname, requireIdle, requireInViewport, hasEffect })` — gains `requireInViewport` (boolean) and `hasEffect` (single effect-name string; entry must include it in its `effects` array).

### Context shape

```ts
// MinistryContext.mjs published value
{
  register(id, descriptor): void,
  unregister(id): void,
  setIdle(id, isIdle: boolean): void,
  setInViewport(id, inViewport: boolean): void,    // NEW
  triggerEffect(id, type): void,                   // RENAMED from forceHijack
  warTone: 'winning' | 'losing' | null,
  enabled: boolean,                                // false when warTone null OR reduced-motion
  isAdmin: boolean,                                // NEW (was 0.52.0; ported into v2)
}
```

`triggerEffect(id, type)` does the full single-fire path: look up entry → verify type is in `entry.effects` → if non-idle, no-op → flip `isIdle: false` → call `entry.onEffect(type)` → schedule `setTimeout` to flip `isIdle: true` after `EFFECT_DURATION_MS[type] + 100`.

### Effect rendering details

DOM structure inside `<Hijackable>` after rewrite (sync `<span className="ministry-truth">` + lazy `<HijackableEffects>` mounting inside the wrapper):

```jsx
<Tag className={className}>
  <span className="ministry-truth" ref={truthRef}>
    {flickerState ? renderFlickered(text, flickerState) : text}

    {/* Overlays — absolute-positioned within .ministry-truth */}
    {showScribble && <span className="ministry-scribble" aria-hidden="true">{randomGlyphs}</span>}
    {showMargin && <span className="ministry-margin" aria-hidden="true">{currentMarginContent}</span>}
    {showMessage && <div className="ministry-message" aria-hidden="true">{currentMessageContent}</div>}
  </span>

  {/* Admin trigger strip — flow sibling, isAdmin gate */}
  {isAdmin && hasAnyMainEffect && (
    <span className="ministry-admin-triggers">
      {effects.includes('scribble') && <button onClick={() => trigger('scribble')} aria-label="Trigger scribble effect">S</button>}
      {effects.includes('margin') && <button onClick={() => trigger('margin')} aria-label="Trigger margin marker">M</button>}
      {effects.includes('message') && <button onClick={() => trigger('message')} aria-label="Trigger message banner">B</button>}
    </span>
  )}
</Tag>
```

Effect timings (used for `setIdle` reset + as CSS animation durations):

```js
const EFFECT_DURATION_MS = {
  scribble: 2200,
  margin: 2000,
  message: 3200,
  flicker: 300,  // upper bound of 150–300 range
};
```

CSS (added to `MinistryInterference.css`, imported by `HijackableEffects.jsx`):

```css
.ministry-truth { position: relative; }

.ministry-scribble {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-cyberstan); font-size: 1.2em;
  color: var(--color-primary); letter-spacing: 0.3em;
  pointer-events: none;
  animation: ministry-scribble 2200ms ease-in-out;
}

.ministry-margin {
  position: absolute; left: 100%; top: 0; margin-left: 0.5em;
  font-family: var(--font-cyberstan); font-size: 0.9em;
  color: var(--color-primary); white-space: nowrap;
  pointer-events: none; opacity: 0;
  animation: ministry-margin 2000ms ease-in-out;
}

.ministry-message {
  position: absolute; top: 100%; left: 0; margin-top: 0.5em;
  padding: 0.5em 1em;
  border: 1px solid var(--color-primary);
  background: var(--color-surface-1);
  color: var(--color-primary);
  font-family: var(--font-mono); font-size: 0.875em;
  white-space: nowrap; pointer-events: none;
  z-index: 1;
  animation: ministry-message 3500ms ease-in-out;
}

.ministry-admin-triggers {
  display: inline-flex; gap: 0.25em;
  margin-left: 0.5em; vertical-align: baseline;
}
.ministry-admin-triggers button {
  font-family: var(--font-mono); font-size: 0.7em;
  padding: 0 0.4em; line-height: 1.4;
  border: 1px solid var(--color-primary);
  color: var(--color-primary);
  background: transparent;
  cursor: pointer;
}
.ministry-admin-triggers button:hover,
.ministry-admin-triggers button:focus-visible {
  background: var(--color-primary);
  color: var(--color-surface-0);
}

/* keyframes ministry-scribble, ministry-margin, ministry-message
   spec: fade-in → hold → fade-out / slide-in → hold → fade-out */
```

## Bundle / async loading strategy

### Sync shells (main bundle)

`Hijackable.jsx` and `MinistryProvider.jsx` are thin sync wrappers. Both stay in the main bundle.

`Hijackable.jsx` (~30 LOC) always renders the truth text wrapped in `<span className="ministry-truth">{text}</span>`. When any effect prop is truthy, it mounts a `dynamic`-imported `<HijackableEffects />` child. Critical guarantee: **truth text appears in SSR HTML**. Smoke tests at `src/__tests__/smoke/smoke.test.mjs` (which assert `expect(body).toContain('Track Managed Democracy Across the Galaxy')`) continue to pass unchanged.

`MinistryProvider.jsx` (~80 LOC) builds the registry + context value synchronously. Renders children synchronously. Conditionally mounts `<MinistryScheduler />` (dynamic-imported) when `warTone !== null`. **Wrapping the whole app in a dynamic-imported provider would break SSR** — children would only render after the lazy module loads. So the provider stays sync; only the scheduler is dynamic.

### Lazy chunk(s)

```jsx
// Hijackable.jsx
const HijackableEffects = dynamic(() => import('./HijackableEffects'), { ssr: false });

// MinistryProvider.jsx
const MinistryScheduler = dynamic(() => import('./MinistryScheduler'), { ssr: false });
```

Both lazy modules use `ssr: false` (they're purely client-side concerns). Whether Next.js/Turbopack emits one shared chunk or two separate chunks is bundler-decided — both modules belong to the same feature and likely co-emit. We do not enforce a chunking strategy.

CSS (`MinistryInterference.css`) is imported by `HijackableEffects.jsx`, so it splits with the chunk — no Ministry CSS in the initial paint.

### Boot timeline

1. **SSR**: HTML emits truth text in `<span className="ministry-truth">`. No overlays. No admin buttons. No JS-side scheduler.
2. **Hydration**: main bundle hydrates the sync shells. Context is live; `ctx.register / setInViewport / triggerEffect` callbacks exist and are wired up but the registry is empty (`HijackableEffects` not loaded yet).
3. **Lazy chunk load**: starts after hydration. Typically 50–500ms on a normal connection.
4. **Effects mount**: `HijackableEffects` mounts inside each `<Hijackable>` with effects opted in. Each one calls `ctx.register` and begins observing the viewport.
5. **Scheduler mount**: `MinistryScheduler` mounts inside `<MinistryProvider>`. Two timers begin.
6. **First fire**: random scheduler waits 2–5 min after mount; flicker scheduler waits 15–30s. Plenty of buffer past the chunk-load delay.
7. **Admin buttons**: rendered alongside the effects mount in step 4. Brief visible "pop in" of buttons 100–500ms after page hydration, only visible to admin sessions.

## Migration plan

### Existing Hijackable call sites

Each existing v1 `<Hijackable>` becomes a manual port. The author decides:
- Which new effects fit this specific element's design and surrounding layout
- What propaganda content fits (heading-shaped, badge-shaped, paragraph-shaped, etc.)
- Whether to author a single string or an array of options

A `grep -rn '<Hijackable' src/` at the time of writing returns ~20 call sites across `DashboardClient.jsx`, `ArchivesHeader.jsx`, `ArchiveStats.jsx`, `/stats`, `/legal`, `/docs/brandkit`, `/sign-in`. The implementation step enumerates them; each call site gets author judgment on which effects fit. Suggested defaults by element kind:

- **Hero / section h1**: scribble + message (high-visibility, tolerates message banner below)
- **Section h2**: scribble + flicker (lighter touch, no banner)
- **Body paragraph**: margin + flicker (no scribble — covers reading text)
- **Stat-value badge** (OUTCOME, etc.): margin + flicker (small element, margin marker is the natural overlay)

These are starting points — author refines per actual layout during implementation.

### Old propaganda content

`MINISTRY_CONTENT[warTone][category]` 96 strings — redistribute by hand onto specific call sites OR drop where no element is a natural home. There is **no auto-migration**; each line is curated.

### tone (`warTone`) handling

Unchanged from v1. Server-side `getWarTone()` returns `'winning' | 'losing' | null`. Provider receives via prop. `warTone === null` continues to disable the feature entirely. **Per-component content is tone-agnostic** in this redesign — each Hijackable's `margin` / `message` prop is one string (or array) that fires regardless of which tone is in effect. Tone-conditional per-element content (`messageWinning="..."` / `messageLosing="..."`) is deferred to a follow-up if needed.

## Testing

### Unit tests

- `MinistryProvider.test.jsx` — context shape (includes `setInViewport`, `triggerEffect`, `isAdmin`), `triggerEffect` happy path + non-idle skip + unknown-type skip, scheduler lazy-mount (verify `<MinistryScheduler>` is dynamic-imported, not rendered immediately). Note: dynamic-imported components in vitest+RTL need `vi.mock` of `next/dynamic` to make them render synchronously.
- `HijackableEffects.test.jsx` — registration on mount + unregistration on unmount, IntersectionObserver callback flips `isInViewport`, each effect's render branch, admin button strip rendering by `effects` opt-in, click handlers call `triggerEffect`, button hidden when `isAdmin === false`.
- `Hijackable.test.jsx` — sync shell: truth text always present, `<HijackableEffects>` mounted only when any effect prop is set, inert no-op when no effects opted in (no registration), dev-mode warn for un-migrated v1 props.
- `ministryRegistry.test.mjs` — extended for `setInViewport`, `requireInViewport` filter, `hasEffect` filter.
- `MinistryScheduler.test.jsx` — `requireInViewport: true` filter behavior, flicker scheduler picks only flicker-supporting entries, main scheduler picks main-effect-supporting entries, both honor `document.hidden`.

### Smoke tests

`src/__tests__/smoke/smoke.test.mjs` — unchanged. Truth-text assertions on homepage + archives continue to pass because the sync `<Hijackable>` shell renders the truth in SSR. Verify these explicitly during implementation.

### Manual / admin

Admin signs in, opens any page with Hijackables, clicks the per-component S/M/B buttons, observes each effect plays correctly with the per-component content. Verifies on `/`, `/archives`, `/stats`, `/legal`, `/docs/brandkit`, `/sign-in`.

## Open questions / future work

These were considered but deferred:

- **Per-effect cadences for the random scheduler**: dropped in favor of one unified cadence (2–5 min picks any main effect) per the brainstorming decision. Revisit if some effects feel under- or over-represented in production.
- **Tone-conditional per-element content**: a Hijackable could declare `messageWinning="..." messageLosing="..."` to vary copy by tone. Out of scope for this redesign; per-element content is tone-agnostic. Revisit if tone-conditional copy proves needed.
- **Flicker admin trigger button**: not exposed in this redesign since flicker fires frequently in normal use. Easy to add later if testing demands.
- **Effect cancellation on admin re-click**: clicks during an in-progress effect are silent no-ops. A "force-interrupt" mode is not provided. Admin waits ~2-3s.
- **Element scroll-into-view for admin testing**: a Hijackable below the fold won't be in-viewport, so the random scheduler skips it. Admin can manually click its trigger button by scrolling to it. No auto-scroll affordance.
- **Configurability of overlay sizes / colors per element**: dropped. CSS defaults are tied to theme tokens (`--color-primary`, `--font-cyberstan`). Author can override via CSS specificity if needed.
- **Lint rule banning `<Hijackable>` inside `nav` / `button` / `a`**: nice-to-have; v1's runtime category guard is removed in v2 (no `category` prop). Worth a follow-up lint rule but not blocking v2.

## Risks

- **Per-component content discipline**: with no global pools as fallback, an author who opts into `message=` but writes a flat string that doesn't fit the element's design will produce visibly off-tone content. Tradeoff: explicit content is the whole point. Mitigation: code review during call-site migration.
- **Admin layout shift**: per-Hijackable inline button strips visibly displace ~3em horizontally for admin sessions. Accepted as the cost of avoiding absolute-positioning overflow problems. Admins know they're seeing dev affordances.
- **Lazy chunk failure mode**: if the dynamic chunk fails to load (network blip, CDN issue), the easter egg silently doesn't fire. Truth text is unaffected. No retry UI; the next page navigation re-attempts the chunk fetch.
- **Margin / message overflow**: `left: 100%` / `top: 100%` positioning can clip in tight containers or near viewport edges. Accepted as author responsibility — opt elements into `margin` / `message` only where their gutters are clear.
- **Scheduler vs. lazy boot race**: the registry is empty until `HijackableEffects` modules mount. If the scheduler somehow fires (impossible because it's in the same lazy chunk) before any registrations, it would just find no eligible entries and reschedule. No actual race.
