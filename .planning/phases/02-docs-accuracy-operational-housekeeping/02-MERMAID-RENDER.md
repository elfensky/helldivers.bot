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
