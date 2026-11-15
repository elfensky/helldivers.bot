# Phase 2 — Mermaid render record (D-23)

Browser render of the five diagrams that three docs pages draw with live Mermaid. `next build` does not run client-side Mermaid and a render failure only logs to the console, so only a browser proves these diagrams. Plan 02-15 appends the staging lines (production build).

The plan 02-05 dev render (lane commit 0f2a2432) passed all six lines; this gap-closure render replaces it.

- Mermaid version: 12.3.0 (`node_modules/mermaid/package.json` in the lane)
- Server: lane dev server `http://127.0.0.1:3100` (`next dev`, `WORKER_ENABLED=false`, `VITEST=1`, stub env, no database), stopped after the render
- Tool: chrome-devtools MCP, run by the execute-phase orchestrator on 2026-11-15 (plan 02-19 Task 2), isolated Chrome context without a login
- Browser: Chrome 157.0.0.0 (macOS)
- Viewports: 1440×900 (desktop) and 768×1024 (768px)
- Method per page and viewport: `resize_page`, reload with the cache ignored, wait until every `.diagram-canvas svg` has `g.node` elements, then `evaluate_script` for the svg count, the node ids without a matching `g.node`, and the edge `path` `data-id` values; `list_console_messages` (error, warn) since that navigation, searched for `[MermaidDiagram] render failed:`.
- Node-ID rule: Mermaid 12.3.0 writes node ids as `mermaid-<diagram>-<n>-flowchart-<nodeId>-<n>`. The check matched the `flowchart-<nodeId>-\d+$` suffix on `g.node[id]` inside each diagram's own svg (`mermaid-data-flow-*`, `mermaid-docs-overview-*`, `mermaid-notification-flow-*`, `mermaid-inapp-flow-*`, `mermaid-push-flow-*`). This is the rule `src/shared/components/MermaidDiagram/MermaidDiagram.jsx:17` uses.
- `g.node` counts per svg (both viewports): data-flow 14, docs-overview 11, notification-flow 11 (10 listed ids plus the inline `db`), inapp-flow 12, push-flow 7.

## Dev lines

/docs/architecture desktop dev: PASS (svg 1/1, missing nodes 0, render errors 0)
/docs/architecture 768px dev: PASS (svg 1/1, missing nodes 0, render errors 0)
/docs desktop dev: PASS (svg 1/1, missing nodes 0, render errors 0)
/docs 768px dev: PASS (svg 1/1, missing nodes 0, render errors 0)
/docs/notifications desktop dev: PASS (svg 3/3, missing nodes 0, render errors 0)
/docs/notifications 768px dev: PASS (svg 3/3, missing nodes 0, render errors 0)

## Console

Every page and width: 0 messages that contain `[MermaidDiagram] render failed:`. The only error and warning lines were `Failed to load resource` 500 and `[useLiveData] poll failed: HTTP 500` pairs. The lane server has no database, so `/api/h1/live` answers 500 as expected; this is unrelated to the diagrams.

## Edge results (desktop)

Mermaid 12.3 puts `L_<from>_<to>_<n>` in the path `data-id` (the path `id` is `<svg id>-L_...`), so edge ids carry node names and the edges are measurable.

- /docs (`mermaid-docs-overview-*`): edge ids are L_dash_api_live_0, L_api_live_db_0, L_worker_api_update_0, L_api_update_db_0, L_api_update_hd1_0. `L_api_update_hd1_` present, `L_worker_hd1_` absent. PASS.
- In-app flow (`mermaid-inapp-flow-*`): `L_hd1_api_post_update_0` present, `L_hd1_api_worker_` absent. The only other worker edge is L_worker_post_update_0. PASS.
- Notification flow: the only worker edge is L_worker_update_0; it has no hd1 edge.
- Extra edges (plan 02-16 deviation, architecture svg `mermaid-data-flow-*`): `L_h1_statistic_fe_live_0` present, `L_h1_statistic_fe_archives_0` present, `L_h1_event_progress_fe_archives_` absent. Frontend edges found: L_h1_status_fe_live_0, L_h1_statistic_fe_live_0, L_h1_event_fe_live_0, L_h1_season_fe_live_0, L_h1_status_fe_archives_0, L_h1_event_fe_archives_0, L_h1_statistic_fe_archives_0, L_h1_season_fe_rebroadcast_0, L_h1_status_fe_rebroadcast_0, L_h1_statistic_fe_rebroadcast_0, L_h1_event_fe_rebroadcast_0. Total edges 23. PASS.

## Detail panels (desktop; clicked the `g.node`, read `.diagram-detail-panel.open` innerText, tables as Field/Type rows)

1. /docs/architecture, node `h1_season`: "H1_SEASON / Root anchor for all game data / h1_status, h1_statistic and h1_event FK back to this via season (Int); h1_event_progress links to h1_event instead. Inlines the introduction_order[] and points_max[] arrays (formerly separate tables) plus the season_duration scalar (Int)." Fields: season Int @unique; last_updated DateTime?; introduction_order Int[]; points_max Int[]; season_duration Int.
2. /docs/architecture, node `h1_status`: "H1_STATUS / Bucketed campaign timeseries / One row per (season, enemy, bucket). Stores campaign progress (points, status) at each time bucket. Both API paths write here — unified source for live dashboard and archives." Tags: bucket-upsert by (season, enemy, bucket), Live Dashboard + Archives. Fields: season Int FK; enemy Int (0/1/2); bucket Int (window start); time Int; points / points_taken Int; status String. No `players` row.
3. /docs/architecture, node `h1_event_progress`: "H1_EVENT_PROGRESS / Bucketed event progression / One row per (type, event_id, bucket). Tracks how event points change over time; points_max is constant and lives on h1_event. The app only writes this table; the offline scripts in scripts/analysis read it." Tags: bucket-upsert by (type, event_id, bucket), read by analysis scripts. Fields: type "attack" | "defend"; event_id Int; type + event_id FK → h1_event; bucket Int (window start); points Int. No `points_max` row.
4. /docs, node `dash`: "DASHBOARD / src/app/page.jsx / Live campaign dashboard with galaxy map, faction stats, event cards, and timeline. Polls /api/h1/live every 10 seconds via the useLiveData hook."
5. /docs, node `auth_api`: "AUTH API / src/app/api/auth/[...all]/route.js / BetterAuth catch-all route handling Discord, GitHub and Google OAuth flows, session management, and account operations. Optional — returns 503 when BETTER_AUTH_SECRET is absent."
6. /docs/notifications, `notification-flow`, node `worker`: "WORKER THREAD / public/workers/cron.js / Dedicated Worker Thread. Every replica runs it, and it calls POST /api/h1/update via HTTP to the main Next.js process every UPDATE_INTERVAL seconds. Only the poller lease holder polls the official Helldivers 1 API." Settings: Poll interval — UPDATE_INTERVAL env (required; 20 in both stacks); Method — setTimeout (prevents overlap); Auth — Bearer token (UPDATE_KEY).
7. /docs/notifications, `inapp-flow`, node `hd1_api`: "OFFICIAL HD1 API / External data source / Official Helldivers 1 API. Updates approximately every second. Only the poller lease holder fetches it, once per UPDATE_INTERVAL seconds."

Every step of the checkpoint ran.

Lane commit: 3ac800a53840bb7595925f1dc20217912e817f9d

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

### Gap-closure re-check (plan 02-20)

- Gap-closure merge commit M: `67019064edfb0455271186be442887ec65a278a2` (PR #687, rebase-merged on develop as 14 commits, range `74b69088..67019064`; M is the develop head after the merge)
- Build: Staging run for M: 43760663110 (conclusion success). `Check: CI` run 43760452648 for M also ended success.
- Build on staging at Task 1: 0.99.0-dev.6701906 (read from `/api/h1/live` at 2026-11-15T22:03:45+01:00; `git merge-base --is-ancestor M 6701906` holds, the sha is M itself). The previous build was 0.99.0-dev.74b6908.
- Served text (curl, cache-busted, all three pages answer 200): `/docs/architecture` holds `activates as soon as it installs` (2 matches) and 0 matches for `explicit client approval`; `/docs` holds `Discord, GitHub and Google` (1 match); `/docs/notifications` holds `Only the poller lease holder polls the official Helldivers 1 API` (1 match) and 0 matches for `Thread that polls`.
- Node IDs per diagram at `6701906` (`git show 6701906:<path>`; node lines plus inline edge-declared ids; unchanged from `c46001d`):
  - `/docs/architecture` (`dataFlowDefinition.mjs`, 14): api_status, api_snapshot, seed_files, worker, lease, seed_script, h1_season, h1_status, h1_statistic, h1_event, h1_event_progress, fe_live, fe_archives, fe_rebroadcast
  - `/docs` (`overviewDefinition.mjs`, 11): dash, archives, profile, docs, api_live, api_rb, api_update, auth_api, worker, db, hd1
  - `/docs/notifications` `notification-flow` (`notificationFlowDefinition.mjs`, 11): worker, update, pushcheck, live, pushapi, sw, hook, detect, toast, webnoti, db (inline in an edge line)
  - `/docs/notifications` `inapp-flow` (`inAppFlowDefinition.mjs`, 12): hd1_api, worker, post_update, update_status, poll, live_api, get_campaign, hook, rerender, detect_changes, sonner_toast, web_noti
  - `/docs/notifications` `push-flow` (`pushFlowDefinition.mjs`, 7): post_update, check_notify, detect_changes, query_subs, web_push, sw_push, show_noti
