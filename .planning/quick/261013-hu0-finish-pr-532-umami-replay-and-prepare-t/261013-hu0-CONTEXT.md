# Quick Task 261013-hu0: Finish PR 532 (Umami replay) and prepare the repo for GSD - Context

**Gathered:** 2026-10-13
**Status:** Ready for planning

<domain>
## Task Boundary

Two deliverables, each in its own locked worktree, each landing on `develop` by PR:

1. **PR #532** (`feat/umami-performance-replay`, worktree `.worktrees/feat-umami-performance-replay`):
   Umami Core Web Vitals (`data-performance="true"`), session replay + heatmaps (`recorder.js` and
   three rewrites in `next.config.mjs`), the `AnalyticsOptOut` component, and the rewritten privacy
   text in `src/app/legal/page.jsx`. Already committed (988ea1e8) and pushed; CI is green except
   `Check: Version Bump`.
2. **GSD prep** (`chore/gsd-prep`, worktree `.worktrees/chore-gsd-prep`, branched from
   `origin/develop` at d4993029): make `.planning/` safe to commit and apply the cockpit GSD profile.

The main checkout is already clean, on `develop`, synced. It is out of scope — never commit there.

</domain>

<decisions>
## Implementation Decisions

### Git workflow (current rules on origin/develop, AGENTS.md § Worktrees + § Git Workflow)
- These rules REPLACE the `--no-ff` local-merge rules that older CLAUDE.md copies still show.
- Work and commit only inside the two worktrees. Never commit in the main checkout.
- Land by PR, merged with `gh pr merge <n> --rebase --delete-branch`. Never merge locally.
- Wait for required checks first: `gh pr checks <n> --watch --required`.
- Verify chain before the PR is merged, in the PR #532 worktree: `npm run lint`, `npm run typecheck`,
  `npm run test:unit`, `npm run build` — all four green. Dependencies are already installed there.
  Env files were NOT copied (a secret-file guard blocks reading them); if `npm run build` fails only
  for a missing env var, report it and rely on CI's `Test & Build` check, do not fabricate values.

### PR #532 scope — review, fix, test, bump
- Rebase `feat/umami-performance-replay` onto `origin/develop`, push with `--force-with-lease`.
- Fix review findings, at minimum:
  - `AnalyticsOptOut.jsx` uses raw `try/catch` (twice). The project forbids try/catch blocks; use
    `tryCatch` from `src/shared/utils/tryCatch.mjs`. Note `tryCatch` takes a PROMISE (async only) and
    auto-reports caught errors to GlitchTip at `warning` level — wrap the sync `localStorage` access in
    a promise and keep the existing "storage blocked" (`null`) state.
  - Add `data-umami-event` to the opt-out button (project rule: every interactive element is tracked,
    `category-action` naming).
  - Check the CSP (`next.config.mjs` headers and/or `src/proxy.js`/middleware nonce handling) allows
    the same-origin `/recorder.js` script and its `/api/record` + `/api/websites/:id/recorder` calls.
- Add a unit test at the mirrored path `src/__tests__/unit/shared/components/AnalyticsOptOut.test.jsx`
  (toggle on/off, blocked-storage branch).
- Add a CHANGELOG entry under `## Unreleased` describing the feature.
- LAST commit of the PR = version bump: `package.json` `0.94.0` → `0.95.0` (minor, feature) and move
  the `## Unreleased` entries into a new `## 0.95.0` section.

### Legal text — replay sample rate
- Replays are NOT enabled in Umami yet. The sentence "Roughly 15% of visits are recorded for review"
  must not state a rate. Rewrite it so it is true whatever the Umami setting is (e.g. "A sample of
  visits may be recorded for review"). Keep the rest of the legal text.

### GSD prep (chore/gsd-prep)
- `.gitignore`: add the GSD runtime-only paths `.gsd/` (dispatch-isolation sentinel),
  `.planning/milestone.lock` (per-session phase claim) and `.planning/state.json` (machine state
  contract regenerated at every step boundary).
- `.planning/config.json`: apply the cockpit GSD profile with
  `node ~/.claude/gsd-core/bin/gsd-tools.cjs config-set workflow.research_before_questions true` and
  `... config-set workflow.discuss_mode assumptions` (`human_verify_mode` is already `end-of-phase`).
  Also commit `workflow._auto_chain_active: false` (GSD writes it on every manual execute-phase run;
  committing the default stops the tree going dirty).
- Commit `.planning/phases/01-stability-fixes-release/01-PATTERNS.md` (already copied into the worktree).
- `.planning/STATE.md` is 3 commits behind HEAD; the orchestrator's Step 7 update refreshes it.
- No version bump: `Check: Version Bump` only covers `src/**`, `prisma/**`, `public/**`, `package.json`.
- Do NOT edit AGENTS.md on chore/gsd-prep, and do not touch its `dev:up` / "assume the dev server is
  already running" line anywhere: another session's locked worktree `chore/dev-up` owns it — report the
  cockpit profile's warning only. (The PR #532 branch may add `legal` to the `Categories:` line; that is
  a separate one-word hunk.)
- The GSD prep PR is opened and merged by the orchestrator AFTER the quick-task artifacts are
  committed (Step 8), and after PR #532 has merged (rebase onto the new `origin/develop` first).

### Claude's Discretion
- CHANGELOG move: move every entry under `## Unreleased` into `## 0.95.0` — they are all on develop
  already and ship with that version.
- Wording of the CHANGELOG entry and the legal sentence; exact `data-umami-event` name.

</decisions>

<specifics>
## Specific Ideas

- The main checkout's former dirty copy of these 4 files was verified byte-identical to 988ea1e8 and
  discarded; the PR branch is the only source.
- PR #532 commit message (988ea1e8) documents the design; keep its rationale.
- Locked worktrees you did not create (`chore-dev-up`) belong to another session — leave them.

</specifics>

<canonical_refs>
## Canonical References

- `AGENTS.md` (= `CLAUDE.md` symlink) on origin/develop — § Worktrees, § Git Workflow, § Conventions
- `.github/workflows/check-version.yml` — version-bump check scope
- `~/.claude/skills/cockpit-gsd-profile/SKILL.md` — profile keys and checks

</canonical_refs>
