# Phase 1 Release Record

Tracks the release-gate checks, version choice, and final tag/deploy evidence
for shipping all five Phase 1 stability fixes (01-01 through 01-07) in one
release, per plan 01-08 and D-01/D-03.

## Pre-release checks — re-run 2026-10-14 (v0.95.2)

Re-execution of 01-08 Task 2. The August release never ran: `origin/main`
is still at `v0.90.14`, and `develop` moved 114 commits to `v0.95.2`
(`5b539144`). Process change since August: `develop` is rebase-merged per PR
and every PR carries its own version bump and CHANGELOG move, so
`## Unreleased` is empty by design and the release version is develop's
current version. Checks ran on the lane `chore/phase-01-release`, which
equals `origin/develop` at `5b539144`. Task 1 (GlitchTip #497 and
`SENTRY_PROJECT`) was done by the developer on 2026-08-31 and is not
repeated; check 5 re-confirms its effect.

| # | Check | Result |
|---|-------|--------|
| 1 | Verification chain | PASS |
| 2 | Version adjacency | PASS |
| 3 | Changelog content | PASS |
| 4 | VAPID wiring | PASS |
| 5 | Symbolication prerequisites | PASS (end-to-end proof pending the tag build) |
| 6 | Staging health | PASS (6b Umami proxy routes: OPEN) |
| 7 | Production config for 0.95.2 (`UMAMI_SITE_URL`) | OPEN (developer) |

### 1. Verification chain — PASS

Run with `mise exec --` (Node 24.15.0). Build used the CI stub env
(`POSTGRES_URL`, `UPDATE_KEY`, `UPDATE_INTERVAL` set inline; no `.env*` file
read or created).

- `npm run lint` — exit 0, 0 errors, 323 warnings (same pre-existing count
  as in August).
- `npm run typecheck` — exit 0.
- `npm run test:unit` — exit 0, 194 test files and 2028 tests passed.
- `npm run build` — exit 0, no "Failed to compile", service worker written
  (196 precached URLs, 8.43 MB).

### 2. Version adjacency — PASS

- `package.json` version: `0.95.2`.
- `git describe --tags --abbrev=0 origin/main` (after
  `git fetch -q origin main --tags`): `v0.90.14`.
- `0.95.2` differs from `v0.90.14`, so no duplicate tag or deployment id.
- `origin/main` (`2b415eac`) is an ancestor of `develop`, so the release PR
  is a clean merge. `v0.90.14` is 114 commits behind develop.

### 3. Changelog content — PASS

- `## Unreleased` exists and is empty, by design under the per-PR bump
  process.
- `## 0.95.2` exists and is non-empty (Changed: analytics point at
  `umami.lav.ren`).
- The five Phase-01 fixes are in `## 0.94.0`: the `NotificationToggle` error
  state (#485); the null faction slot crashes in `getWarOutcome` and the
  `/opengraph-image` route (#459, #503); the static PNG fallback with
  outcome-dependent `Cache-Control` and the `next.config.mjs` header-rule
  fix (#503); the OG render-outcome telemetry and `getCampaign()` error
  reporting (#503); Space Mono loading (#476); the VAPID build-arg wiring.
- CHANGELOG sections that reach production for the first time with this
  release (everything above `## 0.90.14`, which `v0.90.14` already
  shipped): 0.90.15, 0.90.16, 0.91.0, 0.91.1, 0.92.0, 0.93.0, 0.93.1,
  0.94.0, 0.95.0, 0.95.1, 0.95.2 — 11 sections.
- Database: one new migration reaches production with this release,
  `20260827140000_worker_heartbeat_lease` (plus a `prisma/schema.prisma`
  change). Informational for the developer: it applies through the migrate
  container at deploy.

### 4. VAPID wiring — PASS

- `Dockerfile.app` declares `ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY` (line 67) and
  `ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY` (line 68).
- `.github/workflows/build-release.yml` line 74 passes
  `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${{ vars.NEXT_PUBLIC_VAPID_PUBLIC_KEY }}` as a
  build-arg.
- `gh variable list`: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` present, updated
  `2026-08-31T11:50:47Z` (name and timestamp only; no value read or
  recorded).
- Caveat unchanged from August: verified by source inspection and pattern
  parity with `NEXT_PUBLIC_SENTRY_DSN`; the first end-to-end proof is the
  tag build.

### 5. Symbolication prerequisites — PASS (end-to-end proof pending)

- `gh secret list` shows `SENTRY_PROJECT` (updated `2026-08-31T09:11:38Z`),
  `SENTRY_AUTH_TOKEN` and `SENTRY_ORG` (names and timestamps only).
- `gh variable list` shows `SENTRY_URL` and `NEXT_PUBLIC_SENTRY_DSN`.
- Workflow name: `Build: Release` (`.github/workflows/build-release.yml`).
  It triggers on `push` of tags matching `v*.*.*`.
- `gh run list --workflow=build-release.yml --limit 5` returns no runs. No
  release build has ever executed, so there is no sourcemap-upload step to
  read for Errno 13 or an auth failure. Evidence of the #497 fix remains
  the developer's 2026-08-31 manual `sentry-cli sourcemaps upload` test
  (see the old check 5 below).
- The real proof is the sourcemap-upload step of the tag-triggered run.

### 6. Staging health — PASS (6b: OPEN)

- Latest `Build: Staging` run for develop `5b539144`: run `38456694658`,
  completed, success, 2026-10-13T19:40:23Z
  (https://github.com/elfensky/helldivers.bot/actions/runs/38456694658).
  The four runs before it also succeeded.
- Staging URL: `https://staging.helldivers.bot` (from
  `deploy/staging/compose.yaml`, Cloudflare tunnel to the app service).
  `origin/deploy/staging` pins `sha-5b539144bd6e`, the same commit.
- Observed with `curl`:
  - `/api/healthcheck` — 200, `application/json`, `alive: true`.
  - `/api/h1/live` — 200, `application/json`, `cache-control: no-store`,
    `appVersion` `0.95.2` (staging runs the release candidate).
  - `/stats.js` — 404, `text/plain;charset=UTF-8`.
  - `/recorder.js` — 404, `text/plain;charset=UTF-8`.
- 6b (OPEN): the 404s are the designed response of `proxyUmamiScript` when
  `UMAMI_SITE_URL` is unset (`src/shared/utils/umami.mjs`), and staging has
  no Umami env in `deploy/staging/compose.yaml`. So staging cannot exercise
  the 0.95.1 and 0.95.2 script proxy routes. They get their first real test
  on production once `UMAMI_SITE_URL` is set (check 7). The new host
  `umami.lav.ren` answers 200 `application/javascript` for `/script.js` and
  `/recorder.js`.

### 7. Production config change required by 0.95.2 — OPEN (developer)

- `CHANGELOG.md` `## 0.95.2`: production's `UMAMI_SITE_URL` must be set to
  `umami.lav.ren` at deploy time. The Umami instance moved to the homelab
  and `umami.drunik.be` is being retired.
- What must change: on the production host, set `UMAMI_SITE_URL=umami.lav.ren`
  (host only, no scheme, no port) before the tag build deploys, and confirm
  `UMAMI_SITE_ID` still matches the website id on the new Umami instance.
  Only the developer can make this change.
- Repo search for `umami.drunik.be` in `*.js`, `*.mjs`, `*.jsx`, `*.mdx`,
  `*.yml`, `*.yaml` (excluding `node_modules`, `.next`, `public/sw.js`):
  no matches. `src`, `deploy`, `docker-compose*.yml`, `.example.env`,
  `next.config.mjs` and `Dockerfile*` also have no `drunik` reference. The
  string remains only in `CHANGELOG.md` and in `.planning/` documents,
  which is history, not configuration.

## Pre-release checks (2026-08-31, v0.93.1 / 0.94.0 attempt)

> Superseded by the re-run of 2026-10-14 above. Kept as history; do not use
> these results to gate the release.

Five checks required by 01-08 Task 2, each recorded with its evidence.
Stops the plan on any unresolved FAIL — none remain unresolved.

### 1. Verification chain

**Result: PASS**

Ran on the working branch (`chore/gsd-planning`), after the VAPID build-arg
wiring fix and the CHANGELOG fix below:

- `npm run lint` — 0 errors, 323 pre-existing warnings (JSDoc/React-Compiler/
  eslint-react style warnings across the codebase, not introduced by this
  phase; matches the count already present before Phase 1 started)
- `npm run typecheck` — clean, no output beyond the command banner
- `npm run test:unit` — 190 test files, 2003 tests, all passed
- `npm run build` — completed successfully (`output: 'standalone'`, full
  route table printed including `/opengraph-image`), service worker
  generated (196 precached URLs, 8.48 MB), no "Failed to compile"

### 2. Version adjacency

**Result: PASS**

- `package.json` version: `0.93.1`
- Latest semver tag on `origin/main`: `v0.90.14` (`git describe --tags
  --abbrev=0 origin/main`, after `git fetch origin main`)
- `0.93.1 != 0.90.14` — releasing now will not collide with an
  already-deployed tag/deployment id.

### 3. Changelog content

**Result: FAIL, auto-fixed (deviation — see below)**

`CHANGELOG.md` had **no `## Unreleased` section at all** — `grep -n '^## '
CHANGELOG.md` showed the file went straight from `# Changelog` to
`## 0.93.1`. None of the five phase-01 fix commits (01-01 through 01-07)
had recorded a changelog entry.

Auto-fixed under deviation Rule 2 (missing critical functionality — release
notes are a correctness requirement for a shippable release, and D-01's
whole point is that this release documents a known-good set): wrote a
`## Unreleased` section covering all five fixes plus the VAPID build-arg
fix, in the file's existing Added/Fixed style. See `## Deviations` below.

### 4. Release-gate item from 01-06 — VAPID verdict

**Result: FAIL (01-06's original ABSENT verdict), auto-fixed → PASS**

01-06 recorded `NEXT_PUBLIC_VAPID_PUBLIC_KEY` as **ABSENT** from the release
image via a real `docker build` + bundle grep (see
`01-VAPID-IMAGE-CHECK.md`): `Dockerfile.app` had no `ARG`/`ENV` for it, and
neither `build-release.yml` nor `build-staging.yml` passed it as a
build-arg. Left unfixed, every push-capable production visitor would hit
`NotificationToggle`'s new missing-key error state instead of subscribing.

Per explicit developer decision: **fix the wiring, do not ship-anyway.**
Fixed in three parts:

1. `Dockerfile.app`'s builder stage now declares `ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY`
   / `ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
   mirroring the existing, already-proven `NEXT_PUBLIC_SENTRY_DSN` pattern
   (commit `525c6d70`).
2. Both `build-release.yml` and `build-staging.yml` now pass
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${{ vars.NEXT_PUBLIC_VAPID_PUBLIC_KEY }}` as
   a build-arg (same commit).
3. The GitHub Actions repository variable `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is
   now set — confirmed via `gh variable list` (name and last-updated
   timestamp only; the value is never recorded in any commit or document):
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY` present, updated `2026-08-31T11:50:47Z`.
   Sourced from the production host's own `.env.production` (the developer
   ran `gh variable set` directly — this session never held or logged the
   raw value beyond a transient, already-deleted scratchpad file used only
   to validate its shape: 87 bytes, base64url charset, starts with `B`).

**Verification caveat, recorded honestly:** this wiring is verified by
source inspection and by exact pattern parity with `NEXT_PUBLIC_SENTRY_DSN`
(the identical mechanism, already proven working in production). It has
**not** been independently re-verified with a fresh `docker build` + bundle
grep the way 01-06 proved the ABSENT verdict — that would require rebuilding
a full image locally with the real key and grepping `.next/static`, which
was judged unnecessary given the pattern is byte-for-byte identical to a
mechanism already shipping successfully. The first genuine end-to-end proof
is Task 5's real tag-triggered production build; its workflow run and
conclusion are recorded in `## Release` below once cut.

### 5. Symbolication effect

**Result: PASS**

- `gh secret list`: `SENTRY_PROJECT` present (updated `2026-08-31T09:11:38Z`),
  alongside `SENTRY_AUTH_TOKEN` and `SENTRY_ORG`.
- `gh variable list`: `SENTRY_URL` (`https://glitchtip.lav.ren`) and
  `NEXT_PUBLIC_SENTRY_DSN` present.
- No prior "Build: Release" workflow run exists to inspect for an Errno 13
  or auth failure in its sourcemap upload step — `gh run list
  --workflow=build-release.yml` returns zero runs. The workflow was created
  2026-08-08 and no version tag has been pushed since, so it has literally
  never executed. This means the plan's "read the latest release-build run"
  check has no run to read yet; substituted with the strongest available
  evidence instead.
- Developer-verified evidence (Task 1 checkpoint): the GlitchTip host's
  `uploads/`/`file_blobs/` directories are now owned `5000:5000` (fixing
  #497's Errno 13), and a real `sentry-cli sourcemaps upload --release
  test-497` against `glitchtip.lav.ren` succeeded, landing 3 new blob files
  on disk correctly owned `5000:5000`. (A harmless `test-497` artifact
  release now exists in GlitchTip as a side effect — noted, not cleaned up,
  per the developer's own instruction to ignore it.)
- The real proof point is still Task 5's actual tag-triggered release build
  — its sourcemap upload step outcome is recorded in `## Release` below.

## Deviations from Task 2

**1. [Rule 2 - Missing Critical] `CHANGELOG.md` had no `## Unreleased` section**
- **Found during:** Task 2, check 3 (changelog content)
- **Issue:** None of plans 01-01 through 01-07's fix commits recorded a
  changelog entry; the file had no `## Unreleased` header at all.
- **Fix:** Added a `## Unreleased` section with `### Added` (the
  `NotificationToggle` error state) and `### Fixed` (null-slot crashes,
  OG image fallback/cache/telemetry, Space Mono loading, VAPID build-arg
  wiring) entries, matching the file's existing style and issue-number
  convention.
- **Files modified:** `CHANGELOG.md`
- **Verification:** `grep -n '^## '` now shows `## Unreleased` immediately
  after `# Changelog`, non-empty.
- **Committed in:** this plan's Task 2 metadata commit.

**2. [Rule 2 - Missing Critical] `NEXT_PUBLIC_VAPID_PUBLIC_KEY` never reached the shipped bundle**
- **Found during:** flagged by 01-06, confirmed still true at the start of
  Task 2's own re-check.
- **Issue:** See "Release-gate item from 01-06" above.
- **Fix:** `Dockerfile.app` ARG/ENV pair, both workflows' build-args, GitHub
  Actions repository variable set. Developer explicitly directed "fix the
  wiring, do not ship-anyway."
- **Files modified:** `Dockerfile.app`, `.github/workflows/build-release.yml`,
  `.github/workflows/build-staging.yml`
- **Verification:** Source inspection confirms the wiring matches the
  proven `NEXT_PUBLIC_SENTRY_DSN` pattern exactly; `gh variable list`
  confirms the repository variable is set. Full end-to-end proof deferred
  to Task 5's real tagged build (see caveat above).
- **Committed in:** `525c6d70` (code wiring, committed ahead of Task 2 once
  the blocker was identified); the GitHub Actions variable itself is
  infrastructure state, not a commit.

---

**Total deviations:** 2 auto-fixed (both Rule 2 — missing critical
functionality required for D-01's "one known-good release" to actually be
known-good).
**Impact on plan:** Both fixes are necessary preconditions for a release
that does what this phase promises (release notes existing at all; push
notifications not silently breaking for every visitor). No scope creep —
both are narrowly the release-gate items Task 2 itself names.

## Version choice (Task 3)

**Chosen: 0.94.0 (minor bump from 0.93.1)**

This release carries five bug fixes (STAB-01 through STAB-05) plus one
genuinely user-visible addition: `NotificationToggle` gained a new `error`
state with a Retry control — behavior a user can now observe that did not
exist before (previously the component just hung in "loading" forever with
no way out). CLAUDE.md's Git Workflow rule 2 calls for "minor for features,
major for breaking changes, patch for bugfixes" — the new Retry-capable
error state is a feature addition riding alongside the bug fixes, not itself
a bugfix, so a minor bump is the honest read over rounding down to a patch.
No breaking changes are in this release (no removed/renamed public API,
route, or wire-format contract), so major is not warranted.

Merge performed via `git merge --no-ff --no-commit` from `chore/gsd-planning`
into `develop` (in an isolated temporary worktree — the main checkout had a
pre-existing, unrelated uncommitted change to `.planning/config.json` that
this plan does not own and left untouched), then `CHANGELOG.md`'s
`## Unreleased` entries were moved into a new `## 0.94.0` section (leaving
`## Unreleased` present but empty) and `package.json`'s `"version"` was set
to `0.94.0` — both edits folded into the same merge commit per CLAUDE.md
rule 2's explicit "do not defer this to a separate commit" instruction.

### Addendum 2026-10-14 (re-execution)

The merge-into-develop procedure above is superseded by the per-PR bump
process in CLAUDE.md (§ Git Workflow rules 0 and 2): `develop` is
rebase-merged per PR, and each PR carries its own version bump and CHANGELOG
move. Nothing was merged into `develop` and no version was bumped in this
re-run.

- The release version is develop's current version, **0.95.2**.
- The August choice of 0.94.0 stands for its own CHANGELOG section
  (`## 0.94.0`, which holds the five Phase-01 fixes and ships with this
  release).
- Check run: `package.json` version `0.95.2`; `## 0.95.2` exists in
  `CHANGELOG.md` and is non-empty (plan Task 3 node check passed).
- Plan Task 3 check `git log --merges -1 develop` contains `package.json`:
  not applicable. `develop` no longer takes a merge commit carrying the bump;
  the bump travels in each PR's last commit. The only merge commits are the
  release PR into `main` and its merge-back.
- Deployment id for this release (dots to dashes, per `next.config.mjs`
  `APP_VERSION.replaceAll('.', '-')`): `0-95-2`.
