# Phase 2 Production Check (plan 02-12)

Date: 2026-11-15. Production runs V2 = 0.99.0 (tag v0.99.0, merge commit c139d9aff053d7b564a11802fc08f1a9f685a557). Recorded route: `Release 2 route: strip` (`02-RELEASE-RECORD.md`).

## D-15 (3)

Probe time 2026-11-15, about 13:25Z. The chunk URLs come from the live production HTML. Every request carried a cache-busting query string.

| Chunk URL (path under https://helldivers.bot) | `.map` URL answer | Chunk answer | `sourceMappingURL=` lines in the chunk |
|---|---|---|---|
| `/_next/static/chunks/004_lzqyoo2h6.js` | 404 | 200 | 0 |
| `/_next/static/chunks/04o2_8fpjurm0.js` | 404 | 200 | 0 |
| `/_next/static/chunks/0cz1d0mv5g_q7.js` | 404 | 200 | 0 |

Release-1 baseline for contrast: the map of the release-1 chunk, `/_next/static/chunks/43shl_15f_d1y.js.map`, answered 200 (`02-RELEASE-RECORD.md`, "map probe status"). On V2 the same URL answers 404.

Result: the strip works in production. No public browser map answers; the chunks carry no `sourceMappingURL` comment.

## Docs live

Pages fetched from production with a query string on 2026-11-15; every page answered 200.

| Page | String | Expected | Result |
|---|---|---|---|
| /docs/data-flow | `Poller lease` | present | present (4) |
| /docs/infrastructure | `Deployment topology` | present | present (5) |
| /docs/infrastructure | `cleanup-ghcr.yml` | present | present (2) |
| /docs/database | `api_rate_limit` | present | present (4) |
| /docs/database | `TIMESTAMPTZ` | absent | absent (0) |
| /docs/testing | `mirrorTree.test.mjs` | present | present (2) |
| /docs/testing | `euraika` (any case) | absent | absent (0) |
| /docs/notifications | `in memory` (any case) | absent | absent (0) |

Result: the corrected docs are live (DOCS-02).

