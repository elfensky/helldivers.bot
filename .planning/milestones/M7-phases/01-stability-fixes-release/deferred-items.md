# Deferred Items — Phase 01: Stability Fixes & Release

Out-of-scope discoveries acknowledged during phase execution but not fixed inline, per the
executor's scope-boundary rule (only auto-fix issues directly caused by the current task).

| Found in plan | Item | Why deferred | Tracking |
| --- | --- | --- | --- |
| 01-02 | `UserSection.jsx` produces a real, reproducible React hydration mismatch on `/` — an async auth-session (`useSession()`) pending-state race with hydration, structurally different (full DOM-subtree swap) from the date/timezone-formatting bugs STAB-01 targets. The textbook fix (a `mounted`/`hasHydrated` gating boolean) is explicitly prohibited by plan 01-02's own acceptance criteria, and the file is not in 01-02's `files_modified` list. | Requires its own scoped investigation into BetterAuth's `useSession()` SSR behavior — a structural change to the auth/session data flow, not a drive-by fix inside a timezone-focused sweep. | [elfensky/helldivers.bot#526](https://github.com/elfensky/helldivers.bot/issues/526) |
| 01-02 | `npm run lint` fails repo-wide on one pre-existing Prettier violation in `src/__tests__/unit/features/archives/buildWarNarrative.test.mjs:616` (a trailing-comma/formatting issue), committed as part of plan `01-01` (`3c318aef`). Unrelated to hydration/STAB-01 — 01-02 did not modify this file. | Out of scope per the scope-boundary rule (pre-existing issue in an unrelated file, not caused by 01-02's changes). `npx eslint scripts/hydration-sweep.mjs` (01-02's own new file) passes clean. | Needs a one-line `npm run lint:fix` pass, ideally by the next plan that touches lint/test hygiene, or a dedicated housekeeping commit. |
