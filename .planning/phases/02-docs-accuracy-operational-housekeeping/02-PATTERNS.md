# Phase 2: Docs Accuracy & Operational Housekeeping - Pattern Map

**Mapped:** 2026-11-14 (develop 0.98.0)
**Files analyzed:** 20 groups (code, config, scripts, docs)
**Analogs found:** 8 / 20 (the rest are prose edits with no code analog; the file itself is the pattern)
All paths below were checked with `git ls-files` (tracked).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `deploy/staging/compose.yaml` (add `SENTRY_DSN`, D-30) | config | request-response | `deploy/production/compose.yaml:92-93` | exact |
| `scripts/check-mermaid-fences.mjs` (new) | utility (CLI script) | batch / file-I/O | `scripts/hydration-sweep.mjs` | role-match |
| `next.config.mjs` (D-14) | config | transform | itself, lines 17 and 214-225 | exact (in-file edit) |
| `deploy/README.md:36` (Sentry sentence only) | docs | n/a | production compose comment at `:92` | partial |
| `AGENTS.md` (`:44`, `:79-83`) | docs | n/a | itself | in-file |
| `src/app/api/h1/update/route.js` (2 comments) | comment edit | request-response | itself; `lease.mjs` wording | in-file |
| `src/shared/utils/initializeWorker.mjs` (comment `:2-6`) | comment edit | n/a | `.example.env:17-19` | in-file |
| `public/workers/cron.js` (comment `:13`) | comment edit | n/a | `src/instrumentation.node.js:18,22` | in-file |
| `.planning/codebase/{STACK,ARCHITECTURE,INTEGRATIONS,CONCERNS}.md` | docs | n/a | `.planning/architecture/*.md` | in-file |
| `src/app/docs/{architecture,data-flow,infrastructure,database,testing}/page.mdx` + config `.mjs` | docs / component data | n/a | the page itself; `src/app/docs/architecture/dataFlowConfig.mjs` | in-file |
| `src/app/docs/notifications/*`, `docs/page.mdx`, `overviewConfig.mjs` | docs | n/a | same | in-file |
| `.planning/milestones/M7-phases/01-stability-fixes-release/01-REVIEW-DISPOSITION.md:31` | docs | n/a | itself (IN-03 row) | in-file |
| `CHANGELOG.md` `## Unreleased` notes | docs | n/a | existing Unreleased entries | in-file |

## Pattern Assignments

### `deploy/staging/compose.yaml` (config, D-30)

**Analog:** `deploy/production/compose.yaml:92-93`

```yaml
            # Plain, not a *_FILE: src/instrumentation.js reads it before the file values load.
            SENTRY_DSN: 'https://8afca5d3e7344a42b31eb9d8dd85cc89@glitchtip.lav.ren/1'
```

**Placement.** The staging `environment:` block is at `deploy/staging/compose.yaml:~70-100`. It has `SENTRY_SERVER_NAME` (`:79`), then the `*_FILE` secret entries (`POSTGRES_URL_FILE`, `UPDATE_KEY_FILE`). Add the two lines above, comment included, directly after the `SENTRY_SERVER_NAME` entry and before the `# The app reads secrets from files...` comment. Production orders it the same way: plain values first, then `*_FILE`. Keep the 12-space indent and single quotes. The DSN is public (`deploy/README.md:139`).

**Same PR, `deploy/README.md:36-37`.** Current text: "Auth/Umami/Sentry unset on purpose: the app degrades gracefully and OAuth callbacks need a real hostname anyway." Change to "Auth/Umami unset on purpose ... ; Sentry reports to the production GlitchTip project with `environment: staging`." Leave all other stale lines for #624 (D-28).

---

### `scripts/check-mermaid-fences.mjs` (utility, batch / file-I/O, new)

**Analog (conventions):** `scripts/hydration-sweep.mjs`. It is a top-level-await ESM script with a JSDoc header (purpose, Usage, Env vars, Exit code), `console.log` output and a non-zero exit code on failure. `eslint.config.mjs:86-98` turns `no-console` off for `scripts/**`. `jsconfig.json` includes only `src/**`, so the script is not type-checked.

**Header pattern** (`hydration-sweep.mjs:1-24`): block comment with purpose, `Usage:`, `Exit code:`. Then imports, then the body.

**Core pattern to copy:** RESEARCH § Code Examples 1 (lines 441-466), tested on mermaid 12.3.0 and jsdom 30.1.3. `jsdom` is a devDependency (`package.json:75`).

```js
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const mermaid = (await import('mermaid')).default;

let fail = 0;
for (const p of ['architecture', 'data-flow', 'infrastructure', 'database', 'testing', 'notifications']) {
    const t = fs.readFileSync(`src/app/docs/${p}/page.mdx`, 'utf8');
    for (const m of t.matchAll(/```mermaid\n([\s\S]*?)```/g)) {
        const line = t.slice(0, m.index).split('\n').length;
        // ... parse, log OK / FAIL with fence line, count failures
    }
}
process.exit(fail ? 1 : 0);
```

**Error handling: deviation from the research draft.** AGENTS.md forbids bare try/catch, and the repo `tryCatch` wrapper (`src/shared/utils/tryCatch.mjs:14-23`) calls `reportError` to GlitchTip. Do not use it in a CLI script. Use the promise form, which has no try/catch block:

```js
const err = await mermaid.parse(m[1]).then(() => null, (e) => e);
if (err) { fail++; console.log('FAIL', p, `fence@${line}`, String(err.message).split('\n').slice(0, 3).join(' | ')); }
else console.log('OK  ', p, `fence@${line}`);
```

**Test.** Run it fail-first. Baseline: 8 `OK` lines, `FAIL database fence@73` (`PK-FK`), exit 1. After fixing `PK-FK` to `PK, FK` it must exit 0. The script is the check, so no vitest file is needed. A vitest file under `src/__tests__/unit/scripts/` would conflict with `mirrorTree.test.mjs`, because `scripts/` is outside `src/`.

---

### `next.config.mjs` (config, D-14)

**Analog:** itself. Delete `:17` `productionBrowserSourceMaps: true,` and add one option to the `withSentryConfig` call at `:214-225`.

```js
export default process.env.SENTRY_AUTH_TOKEN ?
    withSentryConfig(finalConfig, {
        // No `silent: true`. ... (keep this comment)
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        sentryUrl: process.env.SENTRY_URL,
        sourcemaps: { deleteSourcemapsAfterUpload: true },   // add
    })
:   finalConfig;
```

Keep the repo's ternary style (`?` at line end, `:   finalConfig` aligned). The same PR edits the Sentry block of `infrastructure/page.mdx` and the IN-03 row in `01-REVIEW-DISPOSITION.md:31` (`| IN-03 | info | next.config.mjs:1,15 | open | ... |` becomes resolved).

---

### Comment edits (DOCS-01, D-03), no logic change

Keep all guards. Use these sources for the new wording.

| File and lines | Current | Wording source |
|---|---|---|
| `src/app/api/h1/update/route.js:35` | "The worker polls every ~15s" | `UPDATE_INTERVAL`, 20 s on both stacks (`deploy/production/compose.yaml:79`) |
| `route.js:76-78` (guard at `:79-80` stays) | "prevEvents and lastSeasonObserved live in this process ... (#516)" | `route.js:30-33`: "both live in the lease row, not in this process — see src/update/lease.mjs (#517)". Reword the 403 reason to "worker disabled on this instance: this replica opted out with WORKER_ENABLED=false". |
| `src/shared/utils/initializeWorker.mjs:2-6` | "update path keeps state in memory ... Deployments run N web replicas with WORKER_ENABLED=false and one worker replica" | `.example.env:17-19`: "serve web only, no poller. Not needed to scale: every replica runs the worker, and the worker_heartbeat lease lets only one of them poll (src/update/lease.mjs)." |
| `public/workers/cron.js:13` | "Spawned by src/instrumentation.js" | `src/instrumentation.node.js:18` `await migrateOrWait();` then `:22` `const worker = await initializeWorker();` |

**AGENTS.md `:44`.** The current line is `` `gh pr merge --rebase --delete-branch` ``. Replace it with `gh pr merge <n> --rebase`, then `git push origin --delete <branch>` after `gh pr view <n> --json state` reports `MERGED` (D-27).

**AGENTS.md `:79-83`.** Extend the existing bullet, which is the style to match. Quote facts from `src/update/lease.mjs:19-20` (`LEASE_TTL_S = 60`) and `route.js:91` (`{ role: 'standby', holder }`). Add `WORKER_ENABLED=false` as an opt-out and "both stacks run 2 app replicas". Keep the lines short and add no new section.

---

### Docs pages (DOCS-02), prose edits

**Analog:** the page being edited, plus the verbatim sources in CONTEXT D-03..D-11.

- Mermaid node IDs use underscores. Renaming a node ID needs matching changes in `flows` and `details` of the config `.mjs`, or the node silently loses its panel.
- Only `<MermaidDiagram>` renders. The ```` ```mermaid ```` fences are raw `<pre>` (`mdx-components.jsx:26-30`), so check them with the new script.
- Public pages carry no IPs, host names, node labels or secret names (D-06).
- Reuse for topology wording: `deploy/README.md:15-29` (after checking against D-01 sources 1-3) and `src/update/lease.mjs:5-20`.
- testing page (D-11): one rule, "unit tests mirror the source tree under `src/__tests__/unit/`, enforced by `src/__tests__/unit/_meta/mirrorTree.test.mjs`". Match `AGENTS.md:65-66`.
- Verification: the sweep greps in RESEARCH § Code Examples 3 (baselines 46, 11 and AGENTS.md line 44).

## Shared Patterns

### Merge and branch cleanup (D-27)
**Apply to:** every plan that merges a PR.
`gh pr merge <n> --rebase`, then `git push origin --delete <branch>` after state `MERGED`. A release PR (head `develop`) is never deleted. No `--delete-branch` from a lane.

### Version and changelog (D-22)
**Apply to:** every work PR touching code or config (`deploy/staging/compose.yaml`, `next.config.mjs`, comments, docs pages).
The note goes under `## Unreleased` in `CHANGELOG.md`, with no version bump. `.planning/`-only PRs carry no note. Only the cut PR moves `## Unreleased` into `## X.Y.Z`.

### Error handling
**Apply to:** app code only. `src/shared/utils/tryCatch.mjs` (returns `{data, error}`, reports to GlitchTip). Not for CLI scripts such as `check-mermaid-fences.mjs`, which use `.then(ok, err)` and an exit code (see `hydration-sweep.mjs:12-14`, "no try/catch ... crash loudly").

### Lease wording (all docs and comments)
**Source:** `src/update/lease.mjs:19-20`, `route.js:30-33`, `route.js:91`, `.example.env:17-19`.
Every replica runs the worker thread. Only the `worker_heartbeat` lease holder polls. The lease lasts 60 s. Handover state lives in the lease row. A standby answers `200 { role: 'standby' }`. Both stacks run 2 app replicas. `UPDATE_INTERVAL` is 20.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/__tests__/unit/...` test for the fence script | test | batch | Not needed: the script's exit code is the check, and `scripts/` has no unit-test mirror (`mirrorTree.test.mjs` covers `src/`). |
| GitHub issues (D-17 gaps, WR-07, WR-08) and #502/#501 comments | process | n/a | No file. Wording is at Claude's discretion. |
| `.claude/CLAUDE.md` regeneration | generated | n/a | Gitignored (`.gitignore:58`). Never hand-edit. Regenerate in the main checkout after the maps merge. |

## Metadata

**Analog search scope:** `deploy/`, `scripts/`, `next.config.mjs`, `src/update/`, `src/app/api/h1/update/`, `src/shared/utils/`, `public/workers/`, `eslint.config.mjs`, `AGENTS.md`
**Tracked-source gate:** `git ls-files` returned a path for every analog named above. No gitignored mirror paths are used.
**Pattern extraction date:** 2026-11-14
