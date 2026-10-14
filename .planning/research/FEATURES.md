# Feature Research

**Domain:** Game-companion web app for Helldivers 1 (live war dashboard, 160-season archive, notifications, public API) — this pass covers four target areas of the next milestone: Loadout Builder, Archive Analytics, Site Features/Easter Eggs, Accessibility, plus a verdict on all 11 Icebox items.
**Researched:** 2026-08-28
**Confidence:** MEDIUM-HIGH — grounded directly in the 27 GitHub issues that define scope (HIGH confidence, primary source) and in web research on DIM, Path of Building, Overframe, and HD2 companion sites (helldivers.io, Democracy Hub, HelldiversCompanion.com) for ecosystem precedent (MEDIUM confidence — public docs/wikis, not source-level verification).

## Context this research assumes

Everything below assumes the decisions already locked in `PROJECT.md` / `docs/roadmap.md`: squad mode is committed (not stretch) despite living in "Phase E"; the hash codec must support squad shapes from day one; Archive Analytics builds all planned features and hides empty telemetry rather than dropping features; every Icebox issue must reach shipped-or-closed, not stay parked indefinitely. This document does not relitigate those — it evaluates the *features*, not the sequencing (sequencing is `docs/roadmap.md`'s job).

---

## 1. Loadout Builder (milestone #19, umbrella #162, issues #339–#350)

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Item picker for stratagems/weapons/perks (#339, #342) | Baseline of every loadout tool in every game genre (DIM, Path of Building, Overframe, Democracy Hub) | HIGH (`XL`, #342) | ~60 stratagems / ~20 weapons / 12 perks is a *small* catalog vs. Destiny or PoE — keeps the picker itself simple even though the component count is large |
| Shareable URL, no account required (#341) | Universal in this genre — DIM short links, PoB pastebin codes, every HD2 tool's "share build" button | MEDIUM (`S`, but load-bearing) | Already correctly scoped as hash-in-URL, not server storage — see §4 |
| Read-only shared view distinct from editable view (#342) | DIM: "open it up… edit and save"; PoB: import always creates a local editable copy, never mutates the pasted code | LOW (spec already splits Editor vs Shared modes with "Edit Copy") | Universal pattern across every tool researched — zero risk here |
| Item stat display (cooldown, damage, magazine size, etc.) (#343) | Democracy Hub, Path of Building, u.gg all show per-item stats inline — a bare icon picker with no numbers reads as unfinished in 2026 | MEDIUM (`M`) | Correctly scoped as compact, not a full damage calculator (see anti-features) |
| Mobile-first layout | This project's whole dashboard is mobile-first already (CLAUDE.md); Helldivers players are a console-adjacent, phone-browsing audience | Folded into #342 | Consistent with existing site convention, not a new constraint |
| Stratagem d-pad input-code display (#339, #342 `InputCode`) | Not table stakes for loadout tools *in general*, but table stakes *for this specific game mechanic* — a Helldivers loadout without the call-in code is missing the one thing players actually need to memorize | LOW-MEDIUM | Treat as table stakes despite being genre-specific: the input code is the actual "how do I use this" information, everything else is flavor |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| 4-player squad mode with one shareable URL (#350) | Genuinely rare — DIM is single-character, Path of Building is single-character, Overframe is single-build, Democracy Hub's "Randomiser" does team slot-locking but has no shareable multi-player *link*. No strong reference implementation exists to copy | HIGH (`XL`) | Real differentiator *if* the UX is good, but there's no precedent to lean on — budget for iteration, not a one-shot build (see §4) |
| Curated faction guides (#344) | Precedent exists (u.gg tier lists, Democracy Hub "Featured community builds," PoB community pastes) but for HD1 specifically nobody else is doing this — differentiates mainly by being the *only* curated HD1 content, not by novel mechanics | MEDIUM (`M`) | Content risk, not code risk — brainstorm is correctly flagged as "it's content, not code" |
| Local-first favorites with optional account sync (#345/#346) | DIM and Overframe both gate loadout *saving* behind a platform account; this design works fully without one and syncs opportunistically. Matches the project's own "no account required" core value better than either reference tool | LOW (`S`) + MEDIUM (`M` for sync) | Genuinely better default than the precedent apps, not just parity |
| OG image for shared loadouts (#348) | None of DIM, Path of Building, or Overframe render a rich per-build social preview — they fall back to a generic site card. A custom OG image showing the actual 4 stratagems is a real edge for a Discord-distributed community | HIGH (`L`) | This *exceeds* the reference precedent rather than catching up to it — see §4 |

### Anti-Features

| Feature | Why It Seems Good | Why Problematic | Alternative |
|---------|--------------------|------------------|-------------|
| Forced account creation to save/share a loadout | DIM and Overframe both eventually push users toward a platform account for full functionality | Contradicts the stated core value ("no account required — the URL IS the data") and adds an auth wall to a feature whose whole point is frictionless sharing | Keep localStorage as the default; account sync stays additive, never required (already the plan in #345/#346) |
| Server-side loadout database with vanity slugs, moderation queue, browse/discover pages | DIM effectively does this for shared links (server-stored, GC'd after a week if unvisited) | Adds a CRUD surface, spam/abuse vector, and moderation burden this project has no staffing for | Hash-in-URL is sufficient at this game's playerbase size; curated guides (#344) cover "discovery" without needing user-submitted content |
| Real-time collaborative squad editing (multiple people live-editing one shared URL, WebSocket sync) | Sounds like the natural extension of "squad mode" | None of DIM, PoB, or Overframe do this for any multiplayer game — it requires conflict resolution infrastructure disproportionate to a 4-slot form | #350 already specs this correctly as async: one person builds, shares a static link, others copy it. Keep it that way |
| A build "optimizer"/solver (DIM's Loadout Optimizer, Democracy Hub's Enemy Simulator/damage calculator) | Looks like the natural high-end feature once stats exist (#343) | HD1's item pool (~90 items total) is far smaller than Destiny's or Path of Exile's — the effort of building a constraint solver or DPS simulator vastly exceeds the value it returns at this scale | Curated guides (#344) deliver most of the "what should I bring" value at a fraction of the engineering cost. Not currently proposed in any open issue — flag it if it ever is |

### Feature Dependencies

```
#339 (catalogs) ──┬──requires──> #341 (hash codec) ──requires──> #342 (builder page)
#340 (tokens)  ────┘                                                    │
                                                                          ├──> #343 (stats)
                                                                          ├──> #344 (guides)
                                                                          ├──> #345 (favorites) ──> #346 (account sync)
                                                                          ├──> #347 (nav) + #348 (OG image)
                                                                          └──> #349 (a11y pass) ──> #350 (squad mode)
```

**#341 requires #339 for item ID scheme, not the reverse.** The catalog's decision to use string IDs (not array indices) is what makes the hash codec resilient to later catalog edits — getting this backwards (encoding by index) would make every shared URL break the moment an item is added or reordered.

**#350 requires the hash codec to already anticipate squad shape.** This is the one hard sequencing constraint in the whole track: encoding solo now and bolting on squad later would either need a second incompatible URL format or a breaking migration of every link already shared in the wild. #341 is correctly scoped to solve this up front.

---

## 2. Archive Analytics (milestone #16, issues #179, #180, #270, #269, #462, #453, #247)

This isn't "companion app" territory so much as historical-stats/game-recap territory — the closer analogs are sports stat sites, esports "clutch factor" trackers, chess.com game review, and Spotify Wrapped-style recap features, not other Helldivers tools (no HD1/HD2 companion site found does historical season analytics at all — this is genuinely novel within the genre).

**The binding constraint for this whole area is data coverage, not feature design:** `h1_status`/`h1_event` cover all 160 seasons; `h1_statistic` (players, kills, missions, telemetry) covers only seasons 157–160 (2.5%). The project's own decision — build every feature, hide the card when its season has no telemetry rather than rendering zeros — is correct and matches how sports/stats sites already handle sparse historical data (a "N/A" or omitted stat, never a fabricated zero).

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Per-season summary numbers (players, kills, missions, events) | Baseline for any historical-archive product | Existing, extends `ArchiveStats` | Already partially shipped |
| Two-season side-by-side comparison (#269) | Table stakes for any "browse history" feature — sports sites, chess.com, etc. all support comparing two records | MEDIUM (plan) | Correctly narrowed to selector + layout after overlay/deltas were split into #179/#462 |
| Graceful empty states for missing telemetry, not zeros | Table stakes *given this project's data reality* — a chart showing "0 kills" for 156 of 160 seasons is a bug, not a thin result, and would actively mislead | Already policy | Every telemetry-backed component needs a pinned test for its empty state, not just the happy path |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Momentum Tracker (rate-of-change chart) | Only one of the five Phase B features that works on **all 160 seasons** — highest reach-to-effort ratio in the whole track | MEDIUM | Roadmap already sequences this first within #179 for exactly this reason — confirmed correct |
| Season Report Card (letter grade) | Precedent: Spotify Wrapped-style single gamified score, sports "power rankings" — genuinely shareable, scroll-stopping content for a stats archive | MEDIUM | Partial-data seasons (event win rate universal, kill/mission efficiency telemetry-only) need the formula to degrade gracefully, not just hide entirely — worth resolving in the S17 spec refresh |
| Season Fingerprint radar chart | Precedent: esports hero/character stat radars (Overwatch, fighting-game tier comparisons) | MEDIUM (Recharts already a dependency) | 4 of 6 axes are telemetry-only — same partial-data question as the Report Card |
| Storytelling classifiers (Clutch Factor, Perfect Storm, Coordination Paradox) | Precedent: "moneyball"-style narrative stats, esports clutch-round trackers (Valorant/CS win-rate-in-final-round tools) | HIGH — the *definitions* are the hard part, not the rendering | Correctly flagged to brainstorm thresholds before writing code; this is where most of the "wow factor" and return-visit value in the whole milestone lives |
| War Playback (scrub a season, animated map) | No HD1 or HD2 companion tool found does a chronological season replay — closest precedent is chess.com/lichess game replay or weather-radar loop, not a competitor product | HIGH | Genuinely differentiating within the genre specifically *because* nobody else has it, not because it's a well-trodden pattern |
| Comparison against global (all-season) averages (#462) | Precedent: chess.com percentile framing, sports "above/below league average" | LOW-MEDIUM once the aggregation query exists | Cheap context layer on top of work #179/#269 already do |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Individual player leaderboards / player profiles | Destiny (light.gg), Warframe (Overframe), PoE all have per-player leaderboards via authenticated official APIs | HD1's official API is squad/faction-wide, not per-player-identifiable; no confirmed leaderboard data source exists (#233 is still an open research question, not a shipped integration) | Don't scope this until #233's spike confirms a data source exists (see §3) |
| Live-recomputed analytics on every archive page load | Feels simpler than a caching layer | 160 seasons of history recomputed per request (grades, radars, classifiers) is wasted work that will only grow — this is a request-time-cost anti-pattern, not a feature | Precompute/cache season-level aggregates; recompute only when a season closes or telemetry backfills |
| Backfilling or estimating missing historical telemetry to "complete" the picture | Tempting once telemetry-only charts look sparse across 156/160 seasons | The telemetry literally wasn't polled at the time — any estimate is fabricated data presented as history | Never do this; the "hide when empty" policy already correctly forecloses it |

### Feature Dependencies

```
S17 spec refresh (issue bodies reference dead schema) ──requires──> everything in this track
#179 Momentum Tracker (all 160 seasons) ──ships first, no dependency on telemetry
#179 Report Card / Fingerprint / Attrition / Heatmap ──requires──> telemetry policy resolved (partial-data formula)
#180 storytelling classifiers ──requires──> #179 landing (shares aggregation helpers)
#270 War Playback ──requires──> #179 (map state helpers, same computeMapStateAtEvent)
#269 two-season compare ──best done after──> #179 (radar overlay lands there)
#462 global averages ──independent, but reuses #269/#179 aggregation queries
#453 narrative phrasing ──independent, shares vocabulary with #471 (Site Features track)
```

---

## 3. Site Features & Easter Eggs (milestone #18, issues #238, #392, #471, #27)

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Admin broadcast/announcement capability (#238) | Any live-service companion app with push infra eventually needs an MOTD/announcement channel — comparable to game-status Discord bots' "announcement" commands | LOW-MEDIUM | Infra (`web-push`, Sonner) already exists; this is a thin admin UI + auth-gated action, not new plumbing |
| User dashboard hygiene: show API key once, track usage, fix styling (#27) | Baseline API-product UX — every API platform (Stripe, GitHub, etc.) shows a secret once at creation and surfaces usage | LOW | Not a differentiator, just correctness for a public-API product this project already ships |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|--------------------|------------|-------|
| Ministry of Truth propaganda easter egg (#392) | Genre-appropriate — "Super Earth propaganda" in-universe voice is a well-known, beloved running joke across both Helldivers games and their communities | LOW (content-only) | High payoff-to-effort ratio; directly reinforces the site's own brand voice rather than being generic delight |
| Faction-specific vernacular (#471) | No comparable companion tool differentiates faction copy this way — most just swap a noun | LOW-MEDIUM | Shares vocabulary with #453 (war narrative) — build once, consume from both, per the existing note on the issue |

### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Full CMS/blog for admin announcements (post history, scheduling, audience segmentation) | Feels like the natural next step once a broadcast UI exists | #238's stated scope is a single compose-and-send form; a CMS is a different, much larger product | Ship the simple broadcast form; revisit only if actual admin usage demands more |
| Expanding the Ministry of Truth easter egg into a persistent site-wide "propaganda mode" theme | Tempting once the redacted-stats voice exists and is well-received | Scope creep beyond #392's contained ask (redacted stat cards only); risks fighting the site's actual design system | Keep it scoped to the specific empty-telemetry cards it was written for |

---

## 4. Accessibility (milestone #10, issues #42, #148, #124)

This area is closer to **compliance baseline than competitive feature** — WCAG contrast and ARIA patterns aren't things users "expect" the way they expect a share button; they're things whose absence actively breaks the product for a subset of users, and whose presence competitors rarely bother with (game-companion fan sites are notoriously weak on accessibility — this is a low bar to clear, not a hard-won edge). Treat all three issues as table stakes for a public product, not differentiators, even though clearing them will incidentally exceed most of the genre.

| Feature | Category | Complexity | Notes |
|---------|----------|------------|-------|
| WCAG contrast via `prefers-contrast` (#42) | Table stakes | LOW-MEDIUM | `prefers-contrast: more` preserves the current aesthetic as default and only serves compliant values to users who opt in at the OS level — correctly avoids a visual regression for everyone else |
| WAI-ARIA patterns for tabs/bottom-nav/alerts/map (#148) | Table stakes | MEDIUM (plan) | Each component maps to a documented WAI-ARIA Authoring Practice — no design ambiguity, just implementation discipline |
| Design polish (#124) | **Risk of anti-feature via scope creep** | Unbounded unless scoped | The issue itself has no concrete acceptance criteria; roadmap already flags "scope this before touching it, or it expands to fill whatever time it's given" — treat the footer `href=""` fixes as the real bug and everything else ("skull/wing decorative elements," "rotating logo") as optional flourish to timebox hard |

---

## 5. Icebox — per-issue recommendation (milestone #12, 11 issues)

Every issue here needs a terminal state (build or close-with-reason) per `PROJECT.md`. Verdicts below weigh genre precedent against this project's actual constraints (solo-maintained, stability-first, KISS).

| Issue | Precedent found? | Recommendation | Reason |
|-------|-------------------|-----------------|--------|
| **#43** 3D three.js map + gyroscope | Yes — Democracy Hub (HD2) ships a 3D galactic war map | **CLOSE** | The existing 2D SVG map has significant tuned, tested positioning logic (CLAUDE.md's explicit map-sizing rules); a 3D rewrite duplicates working functionality at very high effort for novelty value only. Democracy Hub is a larger, more-resourced project — the ROI doesn't transfer to a solo-maintained site |
| **#139** Discord bot rewrite | Yes — near-universal in game communities; most HD2 companion tools ship one | **CLOSE this issue, don't close the idea** | The issue is a vague "rewrite" of unspecified stale scope, not a spec. Real value exists now that the public API (v0.59.0) is stable and could power a bot — but this specific issue should be closed and re-filed with concrete scope when actually picked up, not built against a stale description |
| **#140** SwiftUI iOS app w/ Live Activities | Yes — DiversHub (HD2) ships exactly this concept | **CLOSE** | The existing PWA (Serwist, installable, push notifications, offline fallback) already delivers most of a native app's value. A second native codebase for Live-Activities polish is disproportionate maintenance for a solo-maintained project — genre precedent exists but comes from teams, not one person |
| **#28** Reviews system | Weak/none — DIM/PoB/Overframe have build ratings or favorites, not a generic site "reviews" feature | **CLOSE** | No clean analog for a standalone reviews subsystem in this genre. If the underlying want is "let users rate loadouts," that's better served by lightweight favorite/upvote counts inside the Loadout Builder (#345/#346) than by resurrecting a separate reviews table |
| **#184** Ultrawide layout | N/A — general responsive-design hygiene, not genre-specific | **BUILD** | Well-specified, low-risk, clear acceptance criteria already written. Folds naturally into Track B's design-polish work rather than needing dedicated research |
| **#145** Contested-region viz (capture % + battle animations) | Mixed — progress-percentage overlays are common in stats tools; particle/battle animations have no found precedent in any companion app | **PARTIAL BUILD** | The percentage/progress-bar half is real value and is already effectively being delivered via #247 (region-tab progress). Close the "explosions/ship flyovers" half specifically — no precedent, real perf risk on a map with already-tuned sizing rules, purely decorative |
| **#147** Nebula clouds | None found in any companion app | **CLOSE** | The issue documents three failed implementation attempts (SVG viewBox clipping, hydration mismatches, CSS gradient boundary issues) with no working approach identified. Zero ecosystem precedent, purely decorative, no information value — textbook scope to cut |
| **#141** Helmet avatar asset | N/A — not a feature, a single image asset | **CLOSE the backlog item; do the asset ad hoc if wanted** | Doesn't warrant tracking as a milestone decision either way — a 10-minute asset swap isn't research-worthy |
| **#444** Custom HD1 server via DNS redirect | None — no companion app operates as a private server for a live console game | **CLOSE** | The issue's own gating question (TLS cert pinning likely kills it on console) plus real legal/ToS exposure (impersonating official infrastructure) make this the single highest-risk item in the entire Icebox — not worth even a spike |
| **#189** CrowdSec rate-limit verification | N/A — infra/security task, not a feature | **CLOSE with existing reason** | Already correctly shelved: requires an nginx→OpenResty migration not currently justified. Reopen only if the reverse proxy changes for unrelated reasons (e.g., the Track G staging-swarm work) |
| **#233** Leaderboard reverse-engineering | Yes — Destiny, Warframe, PoE all have official leaderboard APIs their fan tools consume; HD1's equivalent is unconfirmed | **BUILD (as a small, time-boxed spike, not a full build)** | Low cost — it's traffic probing and documentation, not implementation. If a leaderboard endpoint is found, it unlocks a genuinely differentiating feature (#233 unblocks real leaderboards) most HD1 tools don't have. Treat like the SSE spike in Track F: a spike that concludes "no such endpoint exists" is still a successful, terminal outcome |

**Net Icebox verdict: 6 close, 1 build outright (#184), 1 partial build (#145), 1 close-and-respec (#139), 1 close-with-existing-reason (#189), 1 spike (#233).** Nothing stays parked indefinitely.

---

## 6. What loadout-sharing tools get right (and one thing they don't)

Grounded in DIM (Destiny Item Manager), Path of Building (Path of Exile), and Overframe (Warframe) — the three mature reference implementations for build/loadout sharing.

**URL format — self-contained beats server-stored, and this project already chose correctly.** Two patterns exist in the wild: Path of Building's base64 "build code" is self-contained (no server round-trip to view), while DIM's shared links are server-stored and garbage-collected after a week if nobody opens them. helldivers.bot's `?b=<base64>` design (#341) matches PoB's model — the right choice, because it avoids a storage/moderation surface and an expiry policy the project doesn't need at this data volume, and it matches the stated core value that "the URL IS the data."

**Codec versioning is validated best practice, not just internal preference.** Path of Building embeds a version marker in its build code specifically so old codes keep importing after the tool evolves. This directly confirms the project's own #341 decision to add "a version/prefix marker so the codec can evolve" — that instinct is correct and matches the one mature precedent that has actually had to live through format changes.

**Partial-loadout tolerance is a place this project should be more forgiving than the precedent apps, and its plan already is.** Neither DIM nor Path of Building really supports sharing an intentionally incomplete build as a first-class case — PoB expects a full character. #341's test coverage explicitly includes "roundtrip partial loadout with nulls," which is the right call for Helldivers specifically: players very often share "just these 4 stratagems" without having settled on a weapon yet.

**Squad/team sharing has no strong precedent to copy — budget for iteration, not a one-shot design.** DIM is single-character. Path of Building is single-character. Overframe is single-build. Democracy Hub's team "Randomiser" has slot-locking but no shareable multi-player *link*. #350 is genuinely inventing this pattern rather than following one. Two concrete implications: (1) don't expect to nail the squad UX on the first pass — there's no reference implementation to validate against, so plan for post-launch iteration; (2) the array-shape detection scheme (`arr[0]` is an array vs. a string, to distinguish squad from solo hashes) is a reasonable ad hoc trick, but it should be paired with the explicit version marker above rather than relied on alone — shape-sniffing is fragile the moment a solo loadout legitimately needs an array-valued field.

**Read/edit-mode separation is universal and low-risk.** DIM's "open it up… edit and save" and this project's planned Editor-vs-Shared-with-"Edit Copy" split (#342) both guarantee that opening a shared link never mutates the original. Every reference tool does this the same way — zero design risk here.

**OG/social preview is the one place this project's plan exceeds every precedent.** None of DIM, Path of Building, or Overframe render a rich per-build social card — all three fall back to a generic site preview. #348's plan to render the actual 4 stratagems, weapon, and perk into a custom OG image is a genuine edge over the reference apps, and it matters disproportionately here because Discord (where link previews render inline) is this community's dominant distribution channel.

---

## MVP Definition (mapped to the already-decided Loadout Builder phase order)

### Launch With (v1) — matches S8–S15 in `docs/roadmap.md`

- [ ] Static catalogs + design tokens (#339/#340) — nothing downstream can start without item IDs
- [ ] Hash codec supporting squad shape from day one (#341) — the one irreversible decision in the track
- [ ] Builder page with editor/shared modes (#342) — the entire interactive surface
- [ ] Item stats (#343), curated guides (#344), favorites (#345) — table stakes for a 2026-era loadout tool
- [ ] Nav entry + OG image (#347/#348) — no shipped feature is discoverable or shareable without these
- [ ] Accessibility pass (#349) — non-negotiable for a public page, not deferred to "later"

### Add After Validation (v1.x)

- [ ] Account sync for favorites (#346) — additive once local-first favorites prove the UX
- [ ] Squad mode (#350) — committed for this milestone, but correctly sequenced last since it depends on everything else and has no reference implementation to de-risk it early

### Future Consideration (not currently in any open issue — do not build speculatively)

- Build optimizer/solver — poor ROI given HD1's small item pool; curated guides already cover this need
- Server-stored/discoverable loadout database — unnecessary at this playerbase size; revisit only if hash-URL sharing proves insufficient in practice

## Feature Prioritization Matrix (cross-track, high level)

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Loadout Builder core (catalogs → page → share) | HIGH | HIGH | P1 |
| Loadout OG image | MEDIUM-HIGH | MEDIUM | P1 |
| Momentum Tracker (Archive Analytics) | MEDIUM | LOW | P1 (best reach-to-effort in the analytics track) |
| Squad mode | HIGH (differentiator) | HIGH | P1 (committed, sequenced last) |
| Storytelling classifiers (Clutch Factor et al.) | HIGH (engagement) | HIGH | P2 |
| War Playback | HIGH (novelty) | HIGH | P2 |
| WCAG/ARIA compliance | Compliance-critical | LOW-MEDIUM | P1 |
| Admin broadcast (#238) | MEDIUM | LOW | P2 |
| Easter eggs (#392/#471) | LOW-MEDIUM (delight) | LOW | P3 |
| Icebox items marked BUILD (#184, #145-partial, #233-spike) | LOW-MEDIUM | LOW-MEDIUM | P3 |

## Competitor Feature Analysis

| Feature | DIM / Path of Building / Overframe | HD2 companion sites (Democracy Hub, HelldiversCompanion) | Our Approach |
|---------|--------------------------------------|-------------------------------------------------------------|--------------|
| Loadout sharing | Self-contained code (PoB) or server-stored short link (DIM) | Share links present, exact format not published | Hash-in-URL, base64, versioned (matches PoB's model) |
| Squad/team builds | Not supported | Randomizer with slot-locking, no shareable multi-player link | Full 4-player shareable squad URL — no precedent to copy, genuine differentiator |
| Item stats in builder | Yes (all three) | Yes (Democracy Hub) | Table stakes, matching |
| Build optimizer/solver | Yes (DIM Loadout Optimizer) | Yes (Democracy Hub Enemy Simulator) | Deliberately not building — poor ROI at HD1's item-pool scale |
| Social preview image | Generic site card only, all three | Not confirmed | Custom per-loadout OG image — exceeds precedent |
| Historical season analytics | N/A (not archive products) | None found | Genuinely novel within the Helldivers genre — closest analogs are sports stats sites, not other game companion tools |

## Sources

- Primary: GitHub issues #162, #339–#350 (Loadout Builder); #179, #180, #270, #269, #462, #453, #247 (Archive Analytics); #238, #392, #471, #27 (Site Features); #42, #148, #124 (Accessibility); #43, #139, #140, #28, #184, #145, #147, #141, #444, #189, #233 (Icebox) — read directly via `gh issue view`, 2026-08-28
- `.planning/PROJECT.md`, `docs/roadmap.md` — project context and existing sequencing/data-coverage policy
- [DIM Share Loadouts wiki](https://github.com/DestinyItemManager/DIM/wiki/Share-Loadouts) — server-stored short-link model, edit-copy pattern, GC policy (MEDIUM confidence — GitHub wiki)
- [Path of Building build-code/pastebin sharing](https://pobapi.readthedocs.io/index.html) — self-contained versioned build code (MEDIUM confidence — third-party API docs)
- [Overframe](https://overframe.gg/) — build sharing and player-sync model for Warframe (MEDIUM confidence — general web search)
- [Democracy Hub](https://democracy-hub.net/) — HD2 loadout builder, 3D map, team randomizer, enemy simulator (MEDIUM confidence — direct site fetch, 2026-08-28)
- [helldivers.io / HelldiversCompanion.com / DiversHub coverage via web search] — HD2 companion-site feature landscape (MEDIUM confidence — search summaries, not primary review)

---
*Feature research for: helldivers.bot Loadout Builder, Archive Analytics, Site Features, Accessibility, and Icebox disposition*
*Researched: 2026-08-28*
