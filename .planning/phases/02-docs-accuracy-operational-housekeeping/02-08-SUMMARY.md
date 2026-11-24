---
phase: 02-docs-accuracy-operational-housekeeping
plan: 08
subsystem: docs
tags: [docs, infrastructure, swarm, github-actions, docker, mdx]

requires:
  - phase: 02-docs-accuracy-operational-housekeeping
    provides: "Plan 02-10 rewrote the infrastructure Sentry block; plan 02-07 merged the database and testing pages (PR #667)"
provides:
  - "/docs/infrastructure describes the two lease-coordinated Swarm stacks, the pin-based release path, the current images, all 11 workflows, the startup sequence and the full env table (PR #668, rebase-merged)"
  - "02-DOCS-PAGE-CHECK.md section /docs/infrastructure with 22 rows, the lane commit and Page infrastructure: CHECKED"
affects: [02-09, 02-11, 02-12]

status: complete
actuals:
  tokens: 20700
  tasks: 3
  commits: 1
plan_head_before: 7d9689cb985baa6e3307bceaff5bc065fec4a2be
plan_head_after: 324ead6fc858ffa0dbc02576b8af259c6845c975

tech-stack:
  added: []
  patterns:
    - "Every topology and release fact on the page is read from the compose files, the workflows and the Dockerfiles, never from deploy/README.md (D-28)"

key-files:
  created:
    - .planning/phases/02-docs-accuracy-operational-housekeeping/02-08-SUMMARY.md
  modified:
    - src/app/docs/infrastructure/page.mdx
    - CHANGELOG.md
    - .planning/phases/02-docs-accuracy-operational-housekeeping/02-DOCS-PAGE-CHECK.md

key-decisions:
  - "The page cites no file name that the retired-name gate forbids: Check: Docker Smoke is described as using a separate compose file, because the gate regex matches the CI compose file name."
  - "Observed facts (release took about 10 minutes to report the new version, a staging roll took 5 to 6 minutes, the rollover 404 then cached 200) are stated as observed, in the Deployment topology section only."
  - "NODE_ENV and NEXT_RUNTIME left the env table and sit in a note below it, so every table key exists in .example.env as the acceptance criterion requires."

requirements-completed: [DOCS-02]

coverage:
  - id: D1
    description: "/docs/infrastructure has a Deployment topology section: two Swarm stacks (2 app, 2 cloudflared, one shared Postgres each), lease-coordinated, UPDATE_INTERVAL 20, any replica count safe, docker-compose.yml is a single-host compose"
    requirement: DOCS-02
    verification:
      - kind: other
        ref: "Task 1 automated checks 1-2 (fence parse; grep for topology, worker_heartbeat, Pin Production, Arcane Git Sync, node:26-slim, 65532, APP_VERSION, -dev., UPDATE_INTERVAL)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The page names no IP address, host name, node label, constraint or Swarm secret name (D-06, T-02-43)"
    requirement: DOCS-02
    verification:
      - kind: other
        ref: "Task 1 automated checks 4-5 (non-loopback IPv4 count 0, 10 secret names 0 on page, host-name and label gate exit 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Docker section matches Dockerfile.app and Dockerfile.migrate; no retired NODE_ENV, user or distroless text; the runner section has no init wrapper; the migrate image keeps tini"
    requirement: DOCS-02
    verification:
      - kind: other
        ref: "Task 1 automated check 3 (grep count 0; tini count 0 in the runner range)"
        status: pass
    human_judgment: false
  - id: D4
    description: "All 11 workflow files and their declared names are on the page; retired names, the OpenAPI init, POSTGRES_SSL, RELEASE.md and softprops are gone; the env table has the nine additions and the *_FILE note"
    requirement: DOCS-02
    verification:
      - kind: other
        ref: "Task 2 automated checks 2-4"
        status: pass
    human_judgment: false
  - id: D5
    description: "02-DOCS-PAGE-CHECK.md has ## /docs/infrastructure with a Sentry-block row, a Lane commit line and Page infrastructure: CHECKED; the page is unchanged since that commit"
    requirement: DOCS-02
    verification:
      - kind: other
        ref: "Task 2 automated check 5, run from the GSD working tree against the lane (CHECK-OK)"
        status: pass
    human_judgment: false
  - id: D6
    description: "PR #668 passed all checks and was rebase-merged; lint, typecheck, 2103 unit tests and the build pass in the lane"
    requirement: DOCS-02
    verification:
      - kind: other
        ref: "gh pr checks 668 (6 pass); gh pr list --state merged --head docs/02-infrastructure (1); npm run build exit 0"
        status: pass
    human_judgment: false
  - id: D7
    description: "The prose reads as a correct and clear account of the deployment to a public reader"
    requirement: DOCS-02
    verification: []
    human_judgment: true
    rationale: "Accuracy against the repo is automated or cited; clarity and the choice of what a public reader needs is a judgment. Phase verification re-reads the page at the release tag (plan 02-11)."

duration: 45 min
completed: 2026-11-15
---

# Phase 2 Plan 08: Infrastructure docs page Summary

**/docs/infrastructure now tells the deployment as it runs: two lease-coordinated Swarm stacks, the tag -> Build: Release -> Pin Production -> Arcane Git Sync release path, the node:26-slim images, all 11 workflows, migrate-on-start and a complete env table with the `*_FILE` convention (PR #668).**

## Performance

- **Duration:** about 45 min (start time not recorded; estimated from the run log)
- **Completed:** 2026-11-15T03:19Z
- **Tasks:** 3 of 3
- **Files modified on develop:** 2 (`src/app/docs/infrastructure/page.mdx`, `CHANGELOG.md`)

## Accomplishments

- New `## Deployment topology` section: stack shape table, ingress by Cloudflare Tunnel, "One poller across replicas", start-first rollover (with the observed `/_next/static` 404 then cached 200), the release path as a diagram and a numbered list, rollback by dispatch, the staging path, and the single-host compose note.
- Section 1: the Dockerfile.migrate steps now follow the file (no npm-upgrade step, minimal five-package manifest next to the project lockfile, `USER node`, tini kept). The Dockerfile.app section lists build inputs (four public build args, four BuildKit secrets) and the runner as built: `node:26-slim`, `65532:65532`, no init wrapper, `CMD ["node", "server.js"]`.
- Section 2: a table of all 11 workflows (file, declared name, trigger, purpose), a rebuilt diagram, and staging and production job tables. The release body is described as the `CHANGELOG.md` section extracted by `awk`.
- Section 3: the OpenAPI step is gone; the flow shows `hydrateFileSecrets()`, `migrateOrWait()` and the `WORKER_ENABLED=false` branch, and names the three crash paths.
- Section 4: server and client tracing rates differ and are stated. The plan-02-10 Sentry block was re-checked against `next.config.mjs:213-225`; it needed no change.
- Section 5: nine rows added, `POSTGRES_SSL` removed, new `*_FILE` subsection. Section 6: the manifest path and the whole cache-header table were wrong and are corrected.
- PR #668 passed 6 of 6 checks (Test & Build, Visual Regression, Review Dependencies, CodeQL x3) and was rebase-merged. The remote branch, the local branch and the lane worktree are removed.

## Task Commits

1. Task 1 (tracer): `981eb74a` on develop (`docs(infrastructure): deployment topology, release path and current images (DOCS-02)`), lane commit `7904b6ba` before the rebase merge. The tracer gate (auto and end-of-phase modes) re-ran the tracer `<verify>`: it passed, so expansion went ahead.
2. Task 2: `fa552af1` on develop (`docs(infrastructure): workflows, init flow and env table match the repo (DOCS-02)`), lane commit `c6bcfdb3`. The page-check record is `324ead6f` in the GSD working tree (`docs(02-08): record the /docs/infrastructure page check against lane commit c6bcfdb3`).
3. Task 3: `acecf2b7` on develop (`docs(changelog): record the infrastructure page (DOCS-02)`), lane commit `f1a1c03b`; PR #668.

The three develop commits are outside the GSD working tree, as the plan's lane carve-out requires. The `commits:` field counts the GSD working tree only.

## Files Created/Modified

- `src/app/docs/infrastructure/page.mdx` (develop) - the corrected page
- `CHANGELOG.md` (develop) - note under `## Unreleased` / `### Changed`, no version bump
- `.planning/phases/02-docs-accuracy-operational-housekeeping/02-DOCS-PAGE-CHECK.md` - section `/docs/infrastructure`

## Decisions Made

See `key-decisions` above. Nothing needs Andrei's decision.

## Deviations from Plan

### Auto-fixed Issues

None.

### Observations

**1. Extra drift found while reading, fixed in the same PR (plan allows "fix drift" in sections 6 and the cross-references).** The Dockerfile.migrate "Upgrade npm to 11.7.0" step does not exist; `autoSessionTracking: false` is not in the client config; section 6 named `src/app/site.webmanifest` (the file is `public/site.webmanifest`) and a cache table that disagreed with `next.config.mjs` (icons, images and SVGs are 1 year, not 7 days; `/sw.js` is `no-store`); the `.docker.env` paragraph described two services where `docker-compose.yml` has one; "BETTER_AUTH_SECRET + 5 auth vars" is seven. The "Audience: project owner and AI assistants" line was removed, as on the testing page. All are rows in the page check.

**2. Plan line numbers were off by two.** The plan cites staging replicas at `:112` and `:146`; the file has them at `:114` and `:148`. The page check cites the real lines. Production (`:118`, `:151`) was right.

**3. The release also builds the migrate image.** The plan names only the app legs. `build-release.yml` also runs Build Migrate Image and Publish Migrate Manifest, and Pin Production needs both. The page shows both.

**4. The retired-name gate forbids the CI compose file name.** Its regex `[^-a-z]ci\.yml` matches `docker-compose.ci.yml`. The page therefore says Check: Docker Smoke "uses a separate compose file". A later gate change could allow the name.

**5. A Task 1 verify forced two small interim edits.** `NODE_ENV=staging` (two lines in the old CI/CD and init sections) would have failed the Task 1 gate before Task 2 rewrote those sections, so Task 1 already carries the one-line fixes.

**6. Prettier realigned the page's tables.** The original page was not prettier-clean and `npm run lint` does not check MDX. `prettier --write` changed table alignment only (verified: no non-table line differs). It makes the diff of the two touched tables larger.

**7. A stale shortcut in `Dockerfile.app:140-143`, recorded for Andrei, not changed.** The comment says the hand-maintained production compose healthcheck calls `/nodejs/bin/node`. The production compose has no such healthcheck now (it uses the image one). The symlink may be removable.

**Total deviations:** 0 auto-fixed, 7 observations. **Impact:** none on the plan's outcome.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None. The page names no address, host, label or secret (T-02-43 gate exit 0). The env table holds key names and descriptions only (T-02-44). `docker-compose.ci.yml:70` still sets `POSTGRES_SSL: 'false'`; no code reads it; it is in the PR body, not changed.

## Issues Encountered

None. Two Bash calls were blocked by the secret-read guard because their text named a protected env file pattern; the page text was inserted with the Edit tool instead.

## Next Phase Readiness

Plan 02-11 re-reads `/docs/infrastructure` at the release tag against the lane commit `c6bcfdb3` (the page is unchanged since). Observed numbers on the page (10 minutes for a release, 5 to 6 minutes for a staging roll) are dated by observation only; if a later release differs materially, edit those two sentences. `deploy/README.md` stays for #624.

## Self-Check: PASSED

- `02-08-SUMMARY.md` exists; the page-check section ends `Page infrastructure: CHECKED` and its check script printed CHECK-OK.
- Commit `324ead6f` is an ancestor of HEAD in the GSD working tree; `981eb74a`, `fa552af1` and `acecf2b7` are on `origin/develop`; PR #668 state is MERGED.
- `gh pr list --state merged --head docs/02-infrastructure` returns 1; the lane worktree and branch are removed, the remote branch is deleted.
- Task 1, 2 and 3 `<automated>` checks exit 0 (Task 3's chain ran in the lane before the push).
