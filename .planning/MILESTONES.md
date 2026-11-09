# Milestones

## M7 Production is stable on the Hetzner swarm (Shipped: 2026-10-25)

**Delivered:** production on the Hetzner swarm, released as v0.96.4; the stability release v0.95.2.

**Phases completed:** 2 phases, 9 plans, 22 tasks

**Key accomplishments:**
- Both `getWarOutcome` victory-signal `.every` checks now optional-chain faction-slot access instead of dereferencing bare, closing the STAB-05 crash; `buildPlayerBeats`' pre-existing zero-baseline and single-sample guards are now pinned by dedicated regression tests.
- Playwright timezone-sweep + per-variant disposition doc prove STAB-01's date/timezone hydration mismatches on `/` are already fixed on `develop`; a validated Server-vs-Client-Component canary confirmed the harness itself works; the sweep's one real finding (`UserSection.jsx`'s auth-session hydration race) is a different bug class, filed as issue #526.
- Replaced the OG route's Satori-rendered crash fallback with a committed static PNG served as raw bytes, split Cache-Control by render outcome, and fixed a next.config.mjs header rule that was silently overriding both — a real "frozen fallback" bug caught only by testing against a production standalone build.
- One outcome-labelled Umami event per real /opengraph-image invocation, a getCampaign() failure-mode audit that splits query failures (reported) from legitimately empty seasons (silent), and a genuine null-faction-slot crash found and fixed while pinning three previously-untested map-state shapes against the real route.
- Built and booted the app image from local source against a real 159-season seeded database on the same linux/arm64 architecture as staging, drove three distinct map states through the real Satori/sharp pipeline, reproduced nothing, ruled out two of three standing hypotheses by inspection, and posted the findings to #503 while leaving it open.
- Added a fifth `'error'` state to `NotificationToggle`'s state machine reached via a `Promise.race` against a 5s timer plus rejection handling, gave it a working Retry that re-runs a single extracted `init()`, made `subscribeToPush()` return a discriminated `{error}` result so a missing VAPID key surfaces instead of faking success, and confirmed by a real `docker build` that the VAPID public key is currently ABSENT from the release image.
- Space Mono is now fetched through `next/font/google` and `--font-mono` resolves through the generated `var(--font-space-mono)` in both `layout.css` declarations, proven via real dev-server before/after measurements (not the project's visual-regression harness, which turned out to be structurally blind to `next/font`) and posted to #476.
- GlitchTip re-count on release 0.95.2 shows all three classes (#496 hydration, #503 OG sharp rejection, #485 notification toggle) still firing, so all three issues stay open with numbers attached and three residual classes became issues #565, #566, #567.

**Archive:** [roadmap](milestones/M7-ROADMAP.md), [requirements](milestones/M7-REQUIREMENTS.md), [phase evidence](milestones/M7-phases/).

---
