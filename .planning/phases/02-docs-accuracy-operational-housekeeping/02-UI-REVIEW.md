# Phase 02 — UI Review

**Audited:** 2026-11-15
**Baseline:** Abstract 6-pillar standards (no UI-SPEC; phase ran with --skip-ui). Accuracy baseline: the code, per D-01 of `02-CONTEXT.md`.
**Screenshots:** not captured. Live pages were read with a cache-busted HTTP fetch of production (`helldivers.bot/docs…`). Static code audit for the rest.
**Interaction captures:** off (`workflow.ui_interaction_capture` is false). Interaction findings come from code and from the render record `02-MERMAID-RENDER.md`.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 2/4 | Rewritten copy contradicts the code on service-worker updates and on the update-route HTTP method |
| 2. Visuals | 2/4 | Eight raw ` ```mermaid ` fences on in-scope pages show Mermaid source text to readers |
| 3. Color | 3/4 | Diagram colors come from the shared component; no in-scope color defect verified |
| 4. Typography | 3/4 | Heading scale and mono code blocks are consistent; raw diagram source adds long mono lines |
| 5. Spacing | 3/4 | Heading margins are consistent; long raw fences rely on horizontal scroll |
| 6. Experience Design | 3/4 | Five diagrams render with zero missing nodes; one in-page anchor is dead |

**Overall: 16/24**

Scores are not averaged upward. The two 2/4 pillars carry the findings a reader sees first.

---

## Top 3 Priority Fixes

1. **Raw Mermaid source on four in-scope pages** — A reader sees `graph LR` and node syntax instead of a diagram. Live check: `helldivers.bot/docs/architecture` returns the text `graph LR` and `setInterval 10s` in a `<pre>`. Fix: convert each fence to `<MermaidDiagram>` with a definition and config file, or delete it. Sites: `architecture/page.mdx:46`, `data-flow/page.mdx:19,104`, `database/page.mdx:87,243`, `infrastructure/page.mdx:13,214,307`.

2. **Architecture page states the wrong service-worker update behavior** — `architecture/page.mdx:74` says new service workers "wait for explicit client approval before activating." `src/sw.js:6-7` sets `skipWaiting: true` and `clientsClaim: true`, and `notifications/page.mdx:192` says the same. Fix: replace the sentence with the immediate-activation behavior. The same paragraph links to `/docs/notifications#pwa--offline`. The rendered HTML has no element with that id (`mdx-components.jsx` renders `h2`/`h3` without ids). Fix: link to `/docs/notifications` without the fragment, or add ids to the headings.

3. **Update route method differs between pages** — The notification diagrams label the route `POST /api/h1/update`. The overview page says the route is an internal GET endpoint, and `public/workers/cronLogic.js:30` sends GET. Live check confirms both texts on production. Sites: `notifications/inAppFlowDefinition.mjs:7`, `notifications/pushFlowDefinition.mjs:4`, `notifications/inAppFlowConfig.mjs:36`, `notifications/notificationFlowConfig.mjs:37`. Fix: change `POST` to `GET` in these four places. Then re-run the browser render check for the three notification diagrams (D-23).

---

## Detailed Findings

### Pillar 1: Copywriting (2/4)

**WARNING — Factual contradiction on service-worker updates.**
`src/app/docs/architecture/page.mdx:74` says version updates "wait for explicit client approval before activating." `src/sw.js:6-7` and `src/app/docs/notifications/page.mdx:192` say the opposite (`skipWaiting: true`, `clientsClaim: true`, immediate activation). Two pages of the same docs set disagree. One is wrong.

**WARNING — Method mismatch on the update route.**
The overview says "Internal GET endpoint" (live, production). The notification diagram labels say `POST /api/h1/update` (live, production, four occurrences). The worker uses GET (`public/workers/cronLogic.js:30`). Diagram labels are copy, so the defect is in copy.

**WARNING — Labels with fixed numbers.**
`notifications/notificationFlowDefinition.mjs:5` shows "polls every ~20s" as a fixed label. The cadence is `UPDATE_INTERVAL`, which the same page's config (`notificationFlowConfig.mjs:43`) names as an env value. The label does not change when the env changes. Deferred by the phase to DOCS-03 (per `02-05-SUMMARY.md`). Noted, not scored separately.

**Minor — Overview link label.** `src/app/docs/page.mdx:39` labels the OpenAPI page "Rebroadcast." The page describes the Helldivers Bot API. The label names a different endpoint family. Recommendation: rename to "Public API".

**Minor — Overview testing blurb.** `src/app/docs/page.mdx:47` lists unit and smoke tests only. The testing page also covers visual regression. Recommendation: add "visual regression" to the blurb.

### Pillar 2: Visuals (2/4)

**WARNING — Raw Mermaid source visible on in-scope pages.**
Eight ` ```mermaid ` fences sit on pages this phase rewrote or checked. `mdx-components.jsx:26-30` renders every `pre` as plain text, so readers see the diagram source. Live confirmation: `helldivers.bot/docs/architecture` contains `graph LR` and `setInterval 10s` as text. The phase's D-23 names this behavior. The mermaid parse check (`scripts/check-mermaid-fences.mjs`) only tests that the source parses. It does not test that the page renders a diagram. The gate passed, and the defect stayed.

Count of raw fences per in-scope page:

| Page | Raw fences | Lines |
|------|-----------:|-------|
| `/docs/architecture` | 1 | 46 |
| `/docs/data-flow` | 2 | 19, 104 |
| `/docs/database` | 2 | 87, 243 |
| `/docs/infrastructure` | 3 | 13, 214, 307 |
| `/docs/notifications`, `/docs/testing`, `/docs` | 0 | — |

Recommendation: keep one rendering path. Replace each fence with `<MermaidDiagram>` and a config file, as the notifications page does. Then add a render check to the gate.

**Note — Scope.** `predict/`, `utilities/`, `hd1-api/` and `authentication/` also contain raw fences. They are out of this phase's scope and are noted only.

### Pillar 3: Color (3/4)

No in-scope color defect was verified. Diagram colors come from `MermaidDiagram` and the config files. The raw fences (Pillar 2) contain inline `style` hex values (`architecture/page.mdx:68-69`). Once the fences become diagrams, these values leave the reader's view. Contrast of the diagram palette was not measured. The score is 3, not 4, because contrast was not checked.

### Pillar 4: Typography (3/4)

Headings map to one scale (`mdx-components.jsx:6-10`: `h2` at `text-xl`, `h3` at `text-lg`, both with `font-display`). Code and raw fences use `font-mono text-sm` (`mdx-components.jsx:26-27`). Typography is consistent across the five pages. The score is held at 3 because raw fences set long lines in mono text, which reads as code, not as documentation.

### Pillar 5: Spacing (3/4)

Heading margins are consistent (`h2` `mt-8 mb-4`, `h3` `mt-6 mb-2`). The notification comparison tables are wide. They rely on the page's own layout and were not checked at 375 px in this audit. Raw fences use `overflow-x-auto`. The score is held at 3 because the raw Mermaid lines overflow at mobile width and were not measured.

### Pillar 6: Experience Design (3/4)

**Strength — Diagram rendering is proven.** `02-MERMAID-RENDER.md` records PASS for all five diagrams at 1440 px and 768 px, on dev and on staging (`0.99.0-dev.709126d`). Missing nodes: 0. Render errors: 0. The detail panels for `lease`, `api_update` and `pushcheck` were read in the browser.

**WARNING — Dead in-page anchor.** `architecture/page.mdx:74` links to `/docs/notifications#pwa--offline`. Live HTML has no `id="pwa--offline"`. The reader lands on the top of the page. Fix as in Priority Fix 2.

**WARNING — Raw source in place of a diagram.** See Pillar 2. For a reader, the page offers a code block where a diagram was intended.

**Gap — Render check is not in the gate.** D-23 requires a browser render for the five diagrams. Later edits to the notification diagram labels (Priority Fix 3) need a new browser run. The phase plan does not add one to CI.

---

## Verified Without Defect

- Testing page (`testing/page.mdx`): unit-test layout rule matches `src/__tests__/unit/_meta/mirrorTree.test.mjs`. The NPM scripts table matches `package.json`. Coverage excludes match `vitest.config.mjs:30-35`. The smoke base URL and `SMOKE_ALLOW_SKIP` match `src/__tests__/smoke`. The euraika/aegis reference and the AI-assistant audience line are gone.
- Database page (`database/page.mdx`): model headings match `prisma/schema.prisma` (no `Review` or `App`). `worker_heartbeat` and `api_rate_limit` are present. Timestamps show `TIMESTAMP(3)`. No `TIMESTAMPTZ` remains.
- Infrastructure page (`infrastructure/page.mdx`): `withSentryConfig` sample matches `next.config.mjs:225`. `productionBrowserSourceMaps` is gone. Node 26 and uid 65532 match `Dockerfile.app`. The `tini` text at lines 114 and 120 applies to `Dockerfile.migrate`, which uses `node:26-alpine` and `tini` (`Dockerfile.migrate:33,42`). It is correct.
- Data-flow page: no `queryUpsert*`, `getApiURL` or `fetchInvalidHttps` names remain.

---

## Limits of This Audit

- No screenshots were taken. Layout findings for mobile widths come from code, not from a rendered page.
- Contrast, the 60/30/10 color split and focus order were not measured.
- Pre-existing site-wide issues (for example, raw fences on `predict/`, `utilities/`, `hd1-api/`, `authentication/`) are noted, not scored.

---

## Files Audited

- `src/app/docs/page.mdx`, `overviewConfig.mjs`, `overviewDefinition.mjs`
- `src/app/docs/architecture/page.mdx`, `dataFlowConfig.mjs`, `dataFlowDefinition.mjs`
- `src/app/docs/notifications/page.mdx`, `notificationFlowConfig.mjs`, `notificationFlowDefinition.mjs`, `inAppFlowConfig.mjs`, `inAppFlowDefinition.mjs`, `pushFlowConfig.mjs`, `pushFlowDefinition.mjs`
- `src/app/docs/data-flow/page.mdx`, `src/app/docs/database/page.mdx`, `src/app/docs/testing/page.mdx`, `src/app/docs/infrastructure/page.mdx`
- `src/sw.js`, `src/shared/components/MermaidDiagram/` (by reference), `mdx-components.jsx`, `next.config.mjs`, `Dockerfile.app`, `Dockerfile.migrate`, `prisma/schema.prisma`, `vitest.config.mjs`, `public/workers/cronLogic.js`
- Live: `https://helldivers.bot/docs`, `/docs/architecture`, `/docs/notifications` (HTTP fetch, 2026-11-15)
- Read for context: `02-CONTEXT.md`, `02-MERMAID-RENDER.md`, `02-05-SUMMARY.md`, `02-06-SUMMARY.md`, `02-07-SUMMARY.md`

## Orchestrator check (2026-11-15)

- **Fix 1 is unconfirmed.** The live production HTML of `/docs/architecture` (v0.99.0) contains no `<pre>` block. `graph LR` appears only inside the escaped page payload (`graph LR\n\n    subgraph …`). The browser render checks (02-MERMAID-RENDER.md) found no raw diagram text. Before any change, check in a browser whether the MDX `mermaid` fences show as text.
- **Fix 2 is confirmed.** `src/app/docs/architecture/page.mdx:74` says new service workers wait for client approval. `src/sw.js:6-7` sets `skipWaiting: true` and `clientsClaim: true`. This is a DOCS-02 accuracy defect for a follow-up docs PR.
- **Fix 3 is the known DOCS-03 item.** The notification diagrams label the update route `POST`. It was recorded in the 02-05 page check and left unchanged under D-07.
