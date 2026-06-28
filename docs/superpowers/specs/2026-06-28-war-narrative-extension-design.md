# War Narrative Extension — Design Spec

- **Date:** 2026-06-28
- **Status:** Approved design (pre-implementation)
- **Area:** Archives (`/archives`) — War Narrative section
- **Builds on:** the merged War Narrative feature (`buildWarNarrative.mjs`, v0.62.0) and the SHOW/HIDE button refinement (parked on `chore/narrative-toggle-button` — a prerequisite; see § Dependencies).
- **Grounding:** every file:line below is code-verified.
- **Review:** pressure-tested by a 5-way model debate (2026-06-29). Data flow, telemetry aggregation, player beats, and determinism verified correct; **feature 3 was reworked** from an inverted "territory pressure / darkest hour" reading to correct **offensive conquest milestones** (see § Feature 3), and a **coherence guard** was added (see that section).

## Problem / goal

The War Narrative ([buildWarNarrative.mjs](../../../src/features/archives/buildWarNarrative.mjs)) is deterministic templated prose built from `events` + intro order + cascades + war outcome. It is good but (a) each outcome has exactly **one** phrasing, so it reads samey, and (b) it ignores two rich data sources already on the page — **player counts** and **territory swings** — plus the season's **combat telemetry**. This extends it with four features, computed **server-side** so the app's hottest query stays untouched.

## Scope: four features

| # | Feature | Source | Adds | Seasons |
|---|---|---|---|---|
| 1 | Seeded phrasing variety | none | varies existing text (no new beats) | all |
| 2 | Player surge/collapse beats | `data.playerTimeseries` | ≤2 beats | S157+ (telemetry) |
| 3 | Conquest milestones (offensive) | `data.snapshots` + `data.points_max` | ≤2 beats | **all** |
| 4 | War by the numbers | new telemetry aggregate | 1 beat | S157+ (telemetry) |

New beats are capped (≤2 / ≤2 / 1 = **≤5**) so the already-long narrative stays punchy. The existing per-event field reports are left unchanged (out of scope).

## Architecture & data flow (server-side)

The archives **server page** computes the narrative and passes a ready `beats[]` to the client; `NarrativeSection` becomes a dumb renderer.

```
src/app/archives/page.jsx  (server component — verified no 'use client')
  ├─ data      = getCampaign(season)              // UNCHANGED; already has snapshots + playerTimeseries
  ├─ telemetry = getSeasonTelemetryTotals(season) // NEW, archives-only (feature 4); null when no telemetry
  └─ beats     = buildWarNarrative(data, telemetry) // pure fn → Array<{day,text}>
        → ArchivesClient ({ ...existing, narrativeBeats })   // 'use client'; threads the prop
            → NarrativeSection ({ beats: narrativeBeats })    // renders + SHOW/HIDE toggle
```

- `getCampaign` is **not** modified — it is called by `layout.jsx` (every page), the homepage, the OG image, four API routes, and rebroadcast. Keeping it untouched is the whole point of the server-side choice.
- `buildWarNarrative` stays a **pure function**, now `(data, telemetry) → beats[]`. Phrasing is keyed **per beat by that beat's own outcome** — event field reports by the event's `status` (won/lost), the closing victory/defeat + numbers beats by `getWarOutcome(data)`. No tone param is threaded.
- `NarrativeSection` prop changes `data` → `beats`; empty `beats` ⇒ renders `null` (hide-when-empty preserved). It no longer imports `buildWarNarrative` (smaller client component).
- Beats are plain `{ day:number, text:string }` — serializable across the server→client boundary; all heavy data lives server-side.

## Feature 1 — Seeded phrasing variety

A pool of **2-4** Ministry-voice variants per outcome (attack won/lost, defend won/lost, faction arrival, cascade, opening, victory, defeat), in a new `narrativePhrasing.mjs` that mirrors the structure + dark-comedy voice of [ministryContent.mjs](../../../src/features/ministry/ministryContent.mjs) (`MINISTRY_CONTENT[tone][category]` + `pickAlt`). Voice rules from that file apply: franchise-only, profanity-free, no real-world politics.

**Determinism (hard requirement — SSR-safe):** the picker is **seeded**, never `Math.random`. `pick(pool, seed) = pool[ hash(seed) % pool.length ]`, where `hash` is a tiny deterministic integer hash (e.g. `(season * 2654435761 + key) >>> 0`). The `key` is the `event_id` for event beats and a fixed per-type constant for singletons (opening/outcome). Same season data ⇒ byte-identical narrative every render (required because the component is server-rendered and re-rendered).

Adds **no beats** and **no data** — every existing beat's text just routes through the pool picker.

## Feature 2 — Player surge/collapse beats

Source: `data.playerTimeseries` = `[{ time, day, total, bugs, cyborgs, illuminate }]` (verified shape, [getCampaign.mjs](../../../src/db/queries/getCampaign.mjs)). Empty for pre-telemetry seasons ⇒ no beats.

Module `playerBeats.mjs`, `buildPlayerBeats(playerTimeseries) → beats[]`:
- `baseline = median(total over buckets)`.
- **Surge** = the bucket with the max `total`, emitted only if `max ≥ SURGE_FACTOR * baseline` (default `1.4`).
- **Collapse** = the bucket with the min `total` *after the opening ramp* (skip the first bucket, which is near-zero by construction), emitted only if `min ≤ COLLAPSE_FACTOR * baseline` (default `0.6`).
- **Cap ≤2** (one surge + one collapse). Each is time-anchored at its bucket `time` so it interleaves chronologically with the other beats.
- Text (seeded variants): surge → "The Helldivers rally — deployments surge to {N}." collapse → "The front grows quiet; deployments thin to {N}." (`N` via `formatNumber`).
- Guard: a flat war (no bucket clears the thresholds) yields no beats.

## Feature 3 — Conquest milestones

> **Corrected after a 5-way design review.** An earlier draft read high `points/points_max` as enemy *pressure* on Super Earth ("darkest hour" = max). That is **inverted** — verified against [computeMapState.mjs:36,58-59,74-78](../../../src/shared/utils/game/computeMapState.mjs#L36) (more points ⇒ sectors `CAPTURED` by SE; `DEFEATED` ⇒ enemy eliminated) and the HD1 API docs ([hd1-api page.mdx:112-114](../../../src/app/docs/hd1-api/page.mdx#L112): `points_max` = "points required to trigger a **homeworld assault**", `points_taken` = "points **gained by players**"). `points` is **Super Earth's offensive conquest progress** toward assaulting the *enemy* homeworld — high = SE **winning**. "Super-Earth-in-danger" lives on the **defensive** side (failed defends marching to region 0), which the **cascade beats already narrate**. So feature 3 narrates the **offensive advance** instead — correct *and* non-redundant with cascades.

Source: `data.snapshots` = `[{ time, data: [s0, s1, s2] }]` where each `s_enemy` is an `h1_status` row with `points` + `status` (`'hidden' | 'active' | 'defeated'`), plus season caps `data.points_max.points[enemy]` (verified, [getCampaign.mjs:129-135](../../../src/db/queries/getCampaign.mjs#L129-L135) / [FactionHealthChart.jsx:54-64](../../../src/features/archives/FactionHealthChart.jsx#L54-L64)). Works for **all** seasons.

Module `conquestBeats.mjs`, `buildConquestBeats(snapshots, pointsMax) → beats[]`:
- Per faction, conquest progress `frac = status === 'defeated' ? 1 : (points / pointsMax.points[enemy] || 0)` — 0–1, **high = Super Earth advancing**.
- **Breakthrough** = the earliest snapshot where any faction's `frac` first crosses `GATES_THRESHOLD` (default `0.9` — "at the gates", i.e. the homeworld-assault threshold per the chart's 10/11 framing). One beat, anchored at that snapshot → "The {Faction} are driven to the gates of their homeworld — the assault begins."
- **First homeworld falls** = the earliest snapshot where any faction first flips to `'defeated'`. One beat → "The {Faction} homeworld falls — the first front is won." (Complements the closing outcome beat, which names the *last* faction to fall.)
- **Cap ≤2**, time-anchored; if both milestones land on the same faction within the same day, keep only the "falls" beat.
- Guards: a war with no breakthrough and no defeated faction (lost early / little conquest) ⇒ no beats. The defensive collapse story is left to the cascade beats.

## Feature 4 — War by the numbers

A new **archives-only** query `src/db/queries/getSeasonTelemetryTotals.mjs`, `getSeasonTelemetryTotals(season)`:
- Telemetry fields are **cumulative per bucket**, so the season total is the **sum of the latest bucket per enemy** (`DISTINCT ON (enemy) … ORDER BY enemy, bucket DESC`, then sum across the 3 enemies) — mirrors [getCrossSeasonStats.mjs](../../../src/db/queries/getCrossSeasonStats.mjs). **Do not** sum all buckets (double-counts cumulative values).
- Returns `{ kills, deaths, accidentals, missions, successful_missions, completed_planets, total_unique_players } | null` (null when the season has no `h1_statistic` rows). **BigInt fields** (`kills`, `deaths`, `accidentals`) narrowed to `Number` before returning (server→client safety pattern from [computeTelemetryStats.mjs:27](../../../src/features/stats/computeTelemetryStats.mjs#L27)).
- React-cacheable (`cache()`), like the other queries.

Module `numbersBeat.mjs`, `buildNumbersBeat(telemetry, lastTime, day) → beat | null`: one beat anchored at `lastTime` (the last event), ordered **just before** the closing victory/defeat beat via the existing `order` tiebreaker so it reads as the penultimate line — "By the numbers: {kills} exterminated across {missions} missions; {accidentals} citizens met managed democracy ahead of schedule." (`formatNumber` for compact display). `null` when `telemetry` is null.

## Coherence guard (read quality)

After merge + chronological sort (the existing `time` then `order` comparator), an **adjacency pass** runs over the assembled beats so the new highlight beats don't read as whiplash:
- If two **new highlight beats** (player surge/collapse or conquest) fall **adjacent** (same day) with **opposite sentiment** — e.g. a player *surge* next to a *collapse* — drop the later of the two.
- Player surge and collapse are the global max/min of one series, so they are normally far apart; the guard is a cheap safety net, not a hot path.
- The existing per-event field reports are never dropped — only the ≤5 new highlight beats are eligible for suppression.

This is the readability mitigation the design review flagged: it keeps interleaved highlights from contradicting an immediate neighbor.

## Performance & page impact

- **`getCampaign` untouched** ⇒ zero impact on homepage, `layout.jsx` (every page), OG image, the four API routes, and rebroadcast. (Adding telemetry sums there would have taxed the entire app for an archives-only feature.)
- **`getSeasonTelemetryTotals`** runs **only** on archives page loads — one cheap `DISTINCT ON + SUM` over a single season's `h1_statistic`, React-cached per request. Negligible.
- **Narrative moves off the client** — removes today's unmemoized per-render recompute in `NarrativeSection` ([:23](../../../src/features/archives/NarrativeSection.jsx#L23)); the component stops importing `buildWarNarrative`. Net client cost is **lower** than today.
- **Payload:** ~a few KB of beat text added to the archives SSR response (content meant to be read). `snapshots`/`playerTimeseries` are already fetched and reused — no new query for features 2/3.

## File structure

| File | Responsibility | Action |
|---|---|---|
| `src/features/archives/buildWarNarrative.mjs` | orchestrator, `(data, telemetry) → beats[]`; calls the sub-generators + sorts | Modify |
| `src/features/archives/narrativePhrasing.mjs` | phrasing pools per outcome + deterministic seeded picker (feature 1) | Create |
| `src/features/archives/playerBeats.mjs` | surge/collapse from `playerTimeseries` (feature 2) | Create |
| `src/features/archives/conquestBeats.mjs` | breakthrough / first-homeworld-falls from `snapshots` (feature 3) | Create |
| `src/features/archives/numbersBeat.mjs` | telemetry summary beat (feature 4) | Create |
| `src/db/queries/getSeasonTelemetryTotals.mjs` | season telemetry sums (latest-bucket-per-enemy, BigInt→Number) | Create |
| `src/app/archives/page.jsx` | fetch telemetry, compute `beats` server-side, pass down | Modify |
| `src/features/archives/ArchivesClient.jsx` | thread `narrativeBeats` prop to `NarrativeSection` | Modify |
| `src/features/archives/NarrativeSection.jsx` | take `beats` prop (drop client-side `buildWarNarrative`) | Modify |

Splitting the beat generators into small pure modules keeps the 236-line `buildWarNarrative` from ballooning and makes each independently testable.

## Edge cases

- **Pre-telemetry season** (≤~156): no player beats, no numbers beat; phrasing variety + conquest beats still apply.
- **Flat/calm war:** thresholds (`SURGE_FACTOR`, `COLLAPSE_FACTOR`, `GATES_THRESHOLD`) yield no beats rather than fabricating drama (e.g. a war with no faction reaching the gates emits no conquest beat).
- **No events:** `buildWarNarrative` returns `[]` (existing) ⇒ section hidden.
- **Determinism:** same `(data, telemetry)` ⇒ identical beats (snapshot test).
- **`points_max` missing/zero for a faction:** `frac` guards with `|| 0`.

## Testing

- `narrativePhrasing` — picker is deterministic (same seed ⇒ same index) and pool-bounded; distinct seeds spread across the pool.
- `playerBeats` — detects a surge and a collapse on a synthetic series; emits nothing on a flat series; respects the ≤2 cap.
- `conquestBeats` — emits a breakthrough when a faction crosses the gates threshold and a "first homeworld falls" on the first `defeated`; nothing on a war with no conquest; respects the ≤2 cap + same-faction-same-day dedupe.
- coherence guard — drops the later of two opposite-sentiment new highlight beats that land adjacent (same day); never drops per-event beats.
- `numbersBeat` — formats from totals; returns `null` for `null` telemetry.
- `getSeasonTelemetryTotals` — aggregation logic (latest-bucket-per-enemy, BigInt narrowing) unit-tested against a small fixture; `null` for a telemetry-less season.
- `buildWarNarrative` integration — given season data (+telemetry), produces the expected beats in chronological order; a determinism/snapshot test.

## Dependencies

- The parked **SHOW/HIDE button** change (`chore/narrative-toggle-button`) edits the same `NarrativeSection.jsx`. Land it **first**, then this extension's `NarrativeSection` edit (swap `data`→`beats`) builds on the button version. If it's dropped, fold its button + always-visible-subtitle into this work instead.

## Out of scope

- Curating/trimming the existing per-event field reports.
- Visually restyling beat types (player/territory/numbers stay the same `<li>` as event beats).
- Any change to `getCampaign`, the live dashboard, or the rebroadcast wire format.
- Cross-season tone (`warTone.mjs`) — per-season outcome from `getWarOutcome(data)` drives tone here.
