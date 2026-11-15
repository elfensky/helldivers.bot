# Phase 2 — Mermaid render record (D-23)

Browser render of the five diagrams that three docs pages draw with live Mermaid. `next build` does not run client-side Mermaid and a render failure only logs to the console, so only a browser proves these diagrams. Plan 02-15 appends the staging lines (production build).

- Mermaid version: 12.3.0 (`node_modules/mermaid/package.json` in the lane)
- Server: lane dev server `http://127.0.0.1:3100` (`next dev`, `WORKER_ENABLED=false`, `VITEST=1`, stub env, no database)
- Tool: chrome-devtools MCP, run by the execute-phase orchestrator on 2026-11-15, 02:12Z to 02:21Z
- Browser: isolated Chrome 157.0.0.0 (macOS), real CDP clicks on accessibility uids
- Viewports: 1440×900 (desktop) and 768×1024 (768px)
- Node-ID rule: Mermaid 12.3.0 writes node ids as `mermaid-<diagram>-<n>-flowchart-<nodeId>-<n>`. The check matched the `flowchart-<nodeId>-<n>` suffix on `g.node[id]` inside each diagram's own svg (`mermaid-data-flow-*`, `mermaid-docs-overview-*`, `mermaid-notification-flow-*`, `mermaid-inapp-flow-*`, `mermaid-push-flow-*`). This is the rule `src/shared/components/MermaidDiagram/MermaidDiagram.jsx:17` uses. All 14 + 11 + 10 + 12 + 7 listed node IDs were found at both widths.
- At 768 px the architecture svg viewBox was 1053×1542 (taller than wide), so the TD `mobileDefinition` layout was in use.

## Dev lines

/docs/architecture desktop dev: PASS (svg 1/1, missing nodes 0, render errors 0)
/docs/architecture 768px dev: PASS (svg 1/1, missing nodes 0, render errors 0)
/docs desktop dev: PASS (svg 1/1, missing nodes 0, render errors 0)
/docs 768px dev: PASS (svg 1/1, missing nodes 0, render errors 0)
/docs/notifications desktop dev: PASS (svg 3/3, missing nodes 0, render errors 0)
/docs/notifications 768px dev: PASS (svg 3/3, missing nodes 0, render errors 0)

## Console

Every page and width: 0 messages that contain `[MermaidDiagram] render failed:`. The only error and warning lines were `GET /api/h1/live` 500 and `[useLiveData] poll failed: HTTP 500`. The lane server has no database, so these are expected and unrelated to the diagrams.

## Detail panels (desktop)

1. /docs/architecture, node `lease`: heading `POLLER LEASE`; subtitle `worker_heartbeat · src/update/lease.mjs`; text "Every replica runs the worker thread. Each poll first claims the single worker_heartbeat row with an atomic conditional upsert. The holder polls the API. The other replicas answer 200 { role: 'standby' } and stop. A dead holder is replaced after the 60 s TTL, with no election."; tag `60 s TTL`; second paragraph "The row also holds prev_events and last_season_observed. A new holder inherits them, so a handover neither misses nor repeats an event transition."
2. /docs/architecture flow highlights: view `Live Polling` highlights `lease` (and `worker`, `h1_statistic`, `h1_event_progress`). View `Snapshot Sync` highlights `lease` (and `worker`, `api_snapshot`) and dims `h1_statistic` and `h1_event_progress`. Read from the `diagram-highlighted` and `diagram-dimmed` classes on `g.node`. The first `Live Polling` click hit a stale uid and did not apply; it was repeated after a fresh snapshot.
3. /docs, node `api_update` (button "/api/h1/update Worker trigger"): heading `UPDATE ROUTE`; subtitle `src/app/api/h1/update/route.js`; text "Internal GET endpoint (Bearer UPDATE_KEY) that the worker thread calls. Only the poller lease holder does the work; other replicas answer standby. POST answers 405. Runs updateStatus() and updateSeason(), then the push notification check."
4. /docs/notifications, diagram `notification-flow`, node `pushcheck` (button "Push Notifier checkAndNotify()"): heading `PUSH NOTIFIER`; subtitle `src/update/pushNotifier.mjs`; text "Server-side change detection that runs after each update cycle (fire-and-forget). Compares against the previous event snapshot in the lease row (worker_heartbeat.prev_events) and sends web-push notifications on transitions." followed by a Feature/Detail table.

Every step of the checkpoint ran.

Lane commit: 0f2a2432d907e3ccb75f1e95fdf7a6d347e0c7cb

Verdict: RENDERED

## Staging (plan 02-15)

- 02-05 merge commit M: `c46001d04fa64d0e6c138351f965eb833bece007` (PR #665, rebase-merged on develop)
- Build: Staging run for M: 43668279968 (conclusion success)
- Build: Staging run for the later develop head `810197fc` (plan 02-06): 43669207015, in progress at 2026-11-15T02:47Z. Staging may roll to `0.98.1-dev.810197f`; that build also contains M.
- Build on staging at Task 1: 0.98.1-dev.c46001d (read from `/api/h1/live` at 2026-11-15T02:47Z; `git merge-base --is-ancestor M c46001d` holds, the sha is M itself)
- Served text (curl, cache-busted): `/docs/architecture` holds `Poller lease` (1 match); `/docs/notifications` holds `prev_events` (2 matches) and 0 matches for `in memory` (case-insensitive).
- Node-ID rule for the render check: Mermaid 12.3.0 writes rendered node ids as `mermaid-<diagram>-<n>-flowchart-<nodeId>-<n>`; the check matches the `flowchart-<nodeId>-<n>` suffix on `g.node[id]` inside each diagram's own svg, as `MermaidDiagram.jsx:17` does.
- Node IDs per diagram at `c46001d` (`git show c46001d:<path>`):
  - `/docs/architecture` (`dataFlowDefinition.mjs`, 14): api_status, api_snapshot, seed_files, worker, lease, seed_script, h1_season, h1_status, h1_statistic, h1_event, h1_event_progress, fe_live, fe_archives, fe_rebroadcast
  - `/docs` (`overviewDefinition.mjs`, 11): dash, archives, profile, docs, api_live, api_rb, api_update, auth_api, worker, db, hd1
  - `/docs/notifications` `notification-flow` (`notificationFlowDefinition.mjs`, 10): worker, update, pushcheck, live, pushapi, sw, hook, detect, toast, webnoti
  - `/docs/notifications` `inapp-flow` (`inAppFlowDefinition.mjs`, 12): hd1_api, worker, post_update, update_status, poll, live_api, get_campaign, hook, rerender, detect_changes, sonner_toast, web_noti
  - `/docs/notifications` `push-flow` (`pushFlowDefinition.mjs`, 7): post_update, check_notify, detect_changes, query_subs, web_push, sw_push, show_noti
- Earlier measurement (2026-11-15T02:48Z, build 0.98.1-dev.c46001d): all three pages passed (svg 1/1, 1/1, 3/3, missing nodes 0, render errors 0). It was re-run on the release cut commit because #672 changed a prose paragraph of /docs/notifications after c46001d.
- Second measurement (2026-11-15T12:39:29Z to 12:40:12Z, build 0.99.0-dev.96e34c9, the cut PR #682 commit `96e34c9520051f347b404d898ea67eda02107e1e`): all three pages passed with the same counts (svg 1/1, 1/1, 3/3, missing nodes 0, render errors 0; no console messages). `git diff c46001d 96e34c9` over the five definition files and `src/shared/components/MermaidDiagram` is empty. It was re-run on the final release commit because #671 changed /docs/notifications prose after 96e34c9, and Andrei decided to include #671 and #677 in 0.99.0.
- Re-run commit: `709126df159c180b050756887257a0b2be1d02d3` (develop head with #671 and #677). `git diff 96e34c9 283a276d` over the five definition files and `src/shared/components/MermaidDiagram` is empty, and #677 does not touch them either (`git diff 96e34c9 709126df` over the same paths is empty), so the node IDs above are unchanged. The five diagrams were matched on the `flowchart-<nodeId>-<n>` suffix of `g.node[id]` inside each diagram's own svg (`mermaid-data-flow-1`, `mermaid-docs-overview-1`, `mermaid-notification-flow-1`, `mermaid-inapp-flow-1`, `mermaid-push-flow-1`): the same 14, 11, 10, 12 and 7 IDs, all found.
- Tool and browser: chrome-devtools MCP, run by the execute-phase orchestrator in an isolated Chrome 157.0.0.0 (macOS) at 1440×900, between 2026-11-15T12:54:47Z and 12:55:06Z. The appVersion was read before and after the render and did not change. Console: no messages at all on all three pages. The later release cut commit only adds CHANGELOG.md to this build; the D-23 pre-flight proves the render sources are the same.

Staging version: 0.99.0-dev.709126d

/docs/architecture desktop staging: PASS (svg 1/1, missing nodes 0, render errors 0)
/docs desktop staging: PASS (svg 1/1, missing nodes 0, render errors 0)
/docs/notifications desktop staging: PASS (svg 3/3, missing nodes 0, render errors 0)
