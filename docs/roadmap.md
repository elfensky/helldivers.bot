# Roadmap

Execution order for open work. GitHub Issues stays the source of truth for
_what_ — this file is the source of truth for _when_, and for how to slice the
work into sessions.

Regenerate the state table when it drifts:
`gh issue list --state open --json number,title,milestone`

---

## How to use this file

Each entry below is one **session** — one fresh Claude conversation, start to
finish. Sessions are sized so the work fits in a single context window without
compaction. Don't chain two sessions in one conversation; don't split one
session across two.

Every entry carries three markers:

| Marker         | Meaning                                                                         |
| -------------- | ------------------------------------------------------------------------------- |
| **Prep**       | What to run _before_ touching code — see the prep ladder below                  |
| **Branch**     | `worktree` (feature, per § Worktree Workflow) or `direct` (chore/bugfix branch) |
| **Blocked by** | Sessions that must land first. No entry = startable today                       |

### The prep ladder

Stop at the first rung that applies.

1. **None** — the issue body is the spec. Read it, implement it. Most chores and
   all single-call-site bugfixes.
2. **Plan** — invoke `superpowers:writing-plans`. Use when the shape is settled
   but the work spans 5+ files or has an ordering that matters.
3. **Brainstorm** — invoke `superpowers:brainstorming` first, then plan. Use
   when the issue describes an _outcome_ rather than an implementation: new UI
   surfaces, anything with unresolved design questions, anything where the issue
   says "explore" or lists alternatives.
4. **Spec refresh** — the issue body is _wrong_, not just thin. Rewrite the
   issue against current reality before any of the above. Called out explicitly
   where it applies.

### Every session ends the same way

`npm run lint:fix` → `npm run lint` → `npm run typecheck` → `npm run test:unit`
→ `npm run build`. All four green, or the session reports why not. Then merge
per § Git Workflow (`--no-ff`, version bump + CHANGELOG move in the merge
commit), and close the issue with an implementation comment.

---

## Now — unblock the release

`develop` is **74 commits** and several versions (0.66.0 → 0.67.x) ahead of
`main`, which is still tagged `v0.65.3`. `main` is fully contained in `develop`
(0 commits behind), so the release PR is a clean fast-forward-free merge with no
conflicts to resolve. Nothing else should start until this ships, because every
subsequent version bump compounds the gap.

### S0 — Release the develop backlog

- **Prep:** none
- **Branch:** direct (release PR)
- **Blocked by:** —

PR `develop` → `main`, tag the version at the top of `CHANGELOG.md` on the merge
commit, push the tag, merge `main` back into `develop`. The production Docker
build only triggers on version tags — forgetting the tag means no deployment.

### S0a — Dependency security backlog ⚠️

- **Prep:** none
- **Branch:** direct (chore)
- **Blocked by:** —, but **ship it with or immediately after S0**

**23 open Dependabot alerts as of 2026-07-27: 13 high, 9 moderate, 1 low.** Not
previously tracked by any issue or milestone. Re-check the live count before
working it:

```
gh api repos/elfensky/helldivers.bot/dependabot/alerts --paginate \
  -q '[.[]|select(.state=="open")]|group_by(.security_advisory.severity)|.[]|"\(.[0].security_advisory.severity): \(length)"'
```

Two of the highs land squarely on paths this app uses, which is why this sits
next to the release rather than in Track A:

- **`better-auth`** — account takeover via pre-account hijacking. This app runs
  BetterAuth with Discord + GitHub OAuth (§ Architecture — Auth).
- **`next`** — SSRF in Server Actions and in rewrites, plus a Middleware/proxy
  bypass in App Router apps. This app is App Router, uses server actions
  throughout, and has a `/api/send` rewrite for the Umami proxy.

Also high: `postcss` path traversal, `brace-expansion` DoS, `fast-uri` host
confusion.

A Next.js bump is not a rubber stamp — run the full chain plus `npm run
test:smoke`, and re-verify the Umami proxy rewrite and the auth flow specifically,
since those are the two surfaces the advisories touch. If a major bump is
required, split it into its own session rather than bundling it with the rest.

---

## Track A — Housekeeping

Small, independent, no design questions. Good for short sessions or for warming
up in a codebase area before a bigger feature. Take these in any order.

### S1 — Co-locate unit tests ([#466](https://github.com/elfensky/helldivers.bot/issues/466))

- **Prep:** plan — 171 files move to ~7, and `vitest.config.mjs` include/exclude
  globs plus `_meta/mirrorTree.test.mjs` all change with them
- **Branch:** worktree (mechanically large, benefits from isolation)
- **Blocked by:** S0

Do this **before** any feature work, not after. It follows directly from the
mirror-tree work merged in v0.67.0, the constraints are already researched in
the issue body (`.dockerignore`, `pageExtensions`, `output: 'standalone'` all
checked), and every feature session that lands first adds more test files to
move.

### ~~S2 — Stale-issue triage~~ ✅ done 2026-07-27

Resolved before the roadmap shipped. Outcome:

| Issue                                                                                      | Outcome                                                                                                                  |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| [#274](https://github.com/elfensky/helldivers.bot/issues/274) Auto-generated war narrative | **Closed** — fully implemented. Follow-up lives in [#453](https://github.com/elfensky/helldivers.bot/issues/453)         |
| [#157](https://github.com/elfensky/helldivers.bot/issues/157) Timeline intro-order viz     | **Closed, split.** Event Log half shipped; map half became [#469](https://github.com/elfensky/helldivers.bot/issues/469) |
| [#269](https://github.com/elfensky/helldivers.bot/issues/269) Season comparison            | **Narrowed** to the two-season selector + side-by-side layout. Overlay → #179, delta badges → #462                       |

### S2a — Archives map: hide factions until introduced ([#469](https://github.com/elfensky/helldivers.bot/issues/469))

- **Prep:** plan — the risk is in the blast radius, not the logic
- **Branch:** worktree

`computeMapState` renders a not-yet-introduced faction identically to a wiped-out
one (both `LOST` at 0%), so scrubbing an archives timeline to Day 1 looks like a
total defeat. `introduction_order` is already in the DB and already returned by
`getCampaign()` — the map just ignores it.

**Verified in the browser** (season 160, Day 2): all 11 Cyborg sectors render
`sector lost` with computed styles byte-identical to a genuinely lost sector,
while Bugs and Illuminate show mixed captured/in_progress. Full evidence in the
issue — no query or schema change needed, the data is already on the client.

**Constraint:** `computeMapState` is shared with the live dashboard and the OG
image path. Gate in the archives-only caller (`computeMapStateAtEvent`) rather
than widening the shared contract, and verify the live map is unchanged.

### S3 — `getWarOutcome` null-slot crash ([#459](https://github.com/elfensky/helldivers.bot/issues/459))

- **Prep:** none
- **Branch:** direct (bugfix)

Latent — unreachable via `getCampaign` today. Fix plus one regression test.

### S4 — Post-deploy SEO verification ([#389](https://github.com/elfensky/helldivers.bot/issues/389))

- **Prep:** none
- **Branch:** direct (chore)
- **Blocked by:** S0 — it verifies what's live in production

Rich Results, Schema validator, Search Console. Verification pass, likely
zero-to-small code change.

---

## Track B — Accessibility & Design Polish

Milestone [#10](https://github.com/elfensky/helldivers.bot/milestone/10). Four
issues, mostly independent. Sequenced by dependency: tokens before the
components that consume them.

### S5 — Design token WCAG compliance ([#42](https://github.com/elfensky/helldivers.bot/issues/42))

- **Prep:** none — the issue names the failing pairs
- **Branch:** direct

Contrast-ratio fixes in the `@theme` block in `src/app/layout.css`. Goes first
because #148 and #124 both restyle on top of these tokens. Verify via DevTools
`getComputedStyle()` per § DevTools Verification.

### S6 — Critical ARIA patterns ([#148](https://github.com/elfensky/helldivers.bot/issues/148))

- **Prep:** plan
- **Branch:** worktree
- **Blocked by:** S5

FactionTabs, BottomNav, Alerts, Map. Four distinct widget patterns across four
components — the plan is mostly "which ARIA pattern per component", settled by
the WAI-ARIA Authoring Practices, so no brainstorm needed. Verify keyboard nav
programmatically in DevTools, not by eye.

### S7 — Design polish ([#124](https://github.com/elfensky/helldivers.bot/issues/124))

- **Prep:** brainstorm — 589-char body, no concrete acceptance criteria
- **Branch:** worktree
- **Blocked by:** S5

Scope this one before touching it, or it expands to fill whatever time it's
given.

---

## Track C — Loadout Builder

Milestone [#19](https://github.com/elfensky/helldivers.bot/milestone/19),
umbrella [#162](https://github.com/elfensky/helldivers.bot/issues/162). Thirteen
issues, zero closed — the largest greenfield arc, and the only one whose spec is
currently accurate. Self-contained: static JSON catalogs, no schema change, no
new API surface until S13.

The umbrella's own A–E phases are the dependency order. Don't reorder them —
#341's hash format and #339's item IDs are the contract everything downstream
encodes against.

| Session | Issue                                                                                                                                                                         | Prep                                                      | Branch   | Blocked by |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------- | ---------- |
| **S8**  | [#339](https://github.com/elfensky/helldivers.bot/issues/339) Static item catalogs `L` + [#340](https://github.com/elfensky/helldivers.bot/issues/340) design tokens `XS`     | brainstorm                                                | worktree | S0         |
| **S9**  | [#341](https://github.com/elfensky/helldivers.bot/issues/341) Hash encode/decode + tests `S`                                                                                  | plan — **must accommodate squad from day one**, see below | direct   | S8         |
| **S10** | [#342](https://github.com/elfensky/helldivers.bot/issues/342) Page route + LoadoutBuilder client `XL`                                                                         | brainstorm → plan                                         | worktree | S9         |
| **S11** | [#343](https://github.com/elfensky/helldivers.bot/issues/343) Item stats display `M`                                                                                          | none                                                      | worktree | S10        |
| **S12** | [#344](https://github.com/elfensky/helldivers.bot/issues/344) Curated faction guides `M`                                                                                      | brainstorm — it's content, not code                       | worktree | S10        |
| **S13** | [#345](https://github.com/elfensky/helldivers.bot/issues/345) localStorage favorites `S` + [#346](https://github.com/elfensky/helldivers.bot/issues/346) account sync API `M` | plan                                                      | worktree | S10        |
| **S14** | [#347](https://github.com/elfensky/helldivers.bot/issues/347) Nav entry `XS` + [#348](https://github.com/elfensky/helldivers.bot/issues/348) OG image `L`                     | none                                                      | worktree | S10        |
| **S15** | [#349](https://github.com/elfensky/helldivers.bot/issues/349) Accessibility + polish pass `M`                                                                                 | none                                                      | worktree | S11–S14    |
| **S16** | [#350](https://github.com/elfensky/helldivers.bot/issues/350) Squad mode `XL` — **committed, not stretch**                                                                    | brainstorm → plan                                         | worktree | S15        |

**Why S8 brainstorms:** the catalog is `L` and every later session encodes
against its item IDs. Getting the ID scheme and stat fields wrong is expensive to
walk back — the issue already flags "string IDs (not indices) for resilience".

**Why S10 brainstorms:** `XL`, and it's the whole interactive surface. Nothing
downstream is safe to start until its component boundaries exist.

**Squad mode is committed, and that changes S9.** The rationale is synergy —
HD1 weapons and stratagems interact across a squad, so a shareable 4-player
loadout is a real feature, not a bolt-on. Since it's happening, **S9 must design
the hash format to hold four loadouts from the start.** Encoding one loadout now
and bolting on a squad format later means either a second incompatible format or
a migration of every URL already shared in the wild — and shared URLs are the
whole point of the feature, so they can't be broken.

Concretely, S9 should settle: a version/prefix marker so the codec can evolve, a
solo hash that stays short (solo is the common case and the URL is user-facing),
and a squad hash that is unambiguously distinguishable from solo. S16 then
_implements_ squad mode against a format that already anticipates it, rather than
renegotiating the contract.

---

## Track D — Archive Analytics

Milestone [#16](https://github.com/elfensky/helldivers.bot/milestone/16).
**Do not start any of this until S17 lands.**

### S17 — Spec refresh for Phases B/C/D ⚠️

- **Prep:** spec refresh — this session _is_ the prep
- **Branch:** none — issue rewriting only
- **Blocked by:** S2 (triage may delete some of it)

[#179](https://github.com/elfensky/helldivers.bot/issues/179),
[#180](https://github.com/elfensky/helldivers.bot/issues/180) and
[#270](https://github.com/elfensky/helldivers.bot/issues/270) were written
against a schema that no longer exists. They reference `h1_live_snapshot`,
`h1_snapshot` and `h1_event_snapshot`; the current normalized schema is
`h1_season` / `h1_status` / `h1_statistic` / `h1_event` / `h1_event_progress`
(see § Architecture — Stack). Every field mapping in those three bodies is
wrong.

Rewrite each against the real tables. While you're there, record the data
reality below in each issue — not to cut features, but so nobody plans one
without knowing its reach.

#### Measured coverage (queried 2026-07-27)

| Table          | Seasons | Notes                                               |
| -------------- | ------: | --------------------------------------------------- |
| `h1_season`    | **160** | seasons 1–160                                       |
| `h1_status`    | **160** | liberation points over time — the campaign backbone |
| `h1_event`     | **160** | events incl. `players_at_start`                     |
| `h1_statistic` |   **4** | seasons 157–160 only — **2.5%**                     |

Everything in `h1_statistic` — players, total_unique_players, kills, deaths,
accidentals, hits, shots, missions, successful_missions, completed_planets,
total_mission_difficulty — exists for four seasons. Re-run the check before
relying on these numbers; the telemetry side grows by one season per war.

Which means, per planned feature:

| Reach         | Features                                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------------- |
| **All 160**   | Momentum Tracker, Clutch Factor, Planet Heartbeat, Perfect Storm, event win rates, cascade severity, war duration |
| **4 seasons** | Season Fingerprint (4 of 6 axes are telemetry), Peak Hour Heatmap, Player Attrition Curve                         |
| **Partial**   | Season Report Card — event win rate is universal, mission/kill efficiency is not                                  |

#### Policy: build all, hide when empty

**Decision (2026-07-27):** build every feature. Do not re-sequence around
coverage and do not drop the telemetry-backed ones. They rely on the existing
convention — telemetry-backed components hide when empty rather than rendering
zeros — and their reach improves every season as telemetry accumulates.

Two things follow, and S17 should write both into the issues:

1. **Every telemetry-backed component needs an explicit empty state**, and a test
   that pins it. A chart that renders zeros for 156 of 160 seasons is a bug, not
   a thin result.
2. **Anything comparing two seasons must handle mixed coverage** — if one side
   has telemetry and the other doesn't, drop those rows for both rather than
   rendering a half-empty table. Relevant to
   [#269](https://github.com/elfensky/helldivers.bot/issues/269) and
   [#462](https://github.com/elfensky/helldivers.bot/issues/462).

### S18 — Phase B: Core Analytics ([#179](https://github.com/elfensky/helldivers.bot/issues/179))

- **Prep:** plan (brainstorm already happened — the original 4-way AI debate;
  [#177](https://github.com/elfensky/helldivers.bot/issues/177) references a
  synthesis at `docs/debates/2026-03-30-archive-analytics/` that is **not in the
  repo** — treat the issue bodies as the surviving record)
- **Branch:** worktree
- **Blocked by:** S17

Five features: Season Report Card, Season Fingerprint (radar), Player Attrition
Curve, Momentum Tracker, Peak Hour Heatmap. Estimated L (8–16h) as a group —
**split into 2–3 sessions** by feature if the first one runs long. Charts go
through Recharts, already a dependency.

Start with **Momentum Tracker** — it's the only one of the five that works on all
160 seasons, so it's the one most archive visits will actually see. The other
four render for seasons 157–160 and need the empty state built alongside them,
not after.

Note the Season Fingerprint radar carries #269's old overlay requirement
("compare up to 3 seasons") — that's why #269 was narrowed rather than closed.

### S19 — Phase C: Storytelling ([#180](https://github.com/elfensky/helldivers.bot/issues/180))

- **Prep:** brainstorm → plan
- **Branch:** worktree
- **Blocked by:** S18

Clutch Factor, Perfect Storm Detector, Coordination Paradox, Planet Heartbeat.
These are classifiers over historic data — the _definitions_ are the hard part,
not the rendering. Brainstorm the thresholds before writing any code.

### S20 — Phase D: War Playback ([#270](https://github.com/elfensky/helldivers.bot/issues/270))

- **Prep:** brainstorm → plan
- **Branch:** worktree
- **Blocked by:** S18

Scrub a season chronologically, map evolving, play/pause/speed. Reintroduces the
horizontal timeline scrubber removed in the archives redesign — recoverable from
git history, so start by finding that commit.

### Independent — anytime after S17

| Issue                                                                                                                  | Prep | Branch   | Note                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------- | ---- | -------- | --------------------------------------------------------------------------------------------------- |
| [#453](https://github.com/elfensky/helldivers.bot/issues/453) War narrative phrasing variety + `defendWon` grammar fix | none | direct   | Includes a real grammar bug; smallest win in this milestone                                         |
| [#462](https://github.com/elfensky/helldivers.bot/issues/462) Season stats vs global averages                          | plan | worktree | Owns delta badges. Baseline population is an open question in the issue — settle it before building |
| [#269](https://github.com/elfensky/helldivers.bot/issues/269) Two-season side-by-side comparison                       | plan | worktree | Narrowed to the 2nd selector + layout. Best done **after** S18, since the radar overlay lands there |
| [#247](https://github.com/elfensky/helldivers.bot/issues/247) Event progress in region tab                             | none | worktree |                                                                                                     |

> [#298](https://github.com/elfensky/helldivers.bot/issues/298) (SSE) also sits
> in this milestone but is scheduled **last of everything** — see Track F.

---

## Track E — Site Features & Easter Eggs

Milestone [#18](https://github.com/elfensky/helldivers.bot/milestone/18). Three
issues, all independent, all optional. Pull one when you want something small
and fun between tracks.

| Issue                                                                                          | Prep                                    | Branch   |
| ---------------------------------------------------------------------------------------------- | --------------------------------------- | -------- |
| [#238](https://github.com/elfensky/helldivers.bot/issues/238) Admin: send custom notifications | plan                                    | worktree |
| [#392](https://github.com/elfensky/helldivers.bot/issues/392) Ministry of Truth easter egg     | brainstorm — it's a writing problem     | worktree |
| [#27](https://github.com/elfensky/helldivers.bot/issues/27) User Dashboard improvements        | brainstorm — 456-char body, no criteria | worktree |

---

## Track F — SSE rewrite (last)

[#298](https://github.com/elfensky/helldivers.bot/issues/298). Scheduled after
every other track, and gated behind a throwaway spike. It replaces the
`useLiveData` polling architecture (§ Architecture — Live polling) with
server-sent events, touching the live dashboard, notifications, BroadcastChannel
leader election and the PWA offline path at once — the highest-blast-radius
change on the board, against a polling setup that works today.

### S21 — SSE spike

- **Prep:** invoke `superpowers:prototype` — this is a throwaway, not a branch
  that ships
- **Branch:** worktree, **discarded at the end regardless of outcome**
- **Blocked by:** all other tracks

The spike exists to answer questions, not to produce code. Timebox it, and write
the answers into #298 before deleting the branch:

- Does SSE survive the deployment topology — reverse proxy, CrowdSec, and any
  idle-connection timeout between the browser and the app?
- What happens to an SSE connection when the tab is backgrounded, when the
  device sleeps, and when the PWA is offline? Polling degrades gracefully here
  today; SSE has to be shown to.
- How does the BroadcastChannel leader election interact with a persistent
  connection — one stream for the leader, or one per tab?
- What is the actual measured win over 10-second polling? If the honest answer
  is "a few seconds of latency," that is the finding, and it may end the track.

**A spike that concludes "don't do this" is a successful spike.** Record that in
#298 and close it.

### S22 — SSE implementation

- **Prep:** plan, informed entirely by S21's findings
- **Branch:** worktree
- **Blocked by:** S21 answering yes

Expect multiple sessions. Do not start until S21's findings are written down,
and do not let any part of this leak into an earlier track's session.

---

## Icebox — do not schedule

Milestone [#12](https://github.com/elfensky/helldivers.bot/milestone/12), 10
issues, all labelled `shelved`: 3D/three.js map, Discord bot rewrite, SwiftUI
app, reviews system, ultrawide layout, contested-region viz, faction nebula
clouds, custom HD1 server ([#444](https://github.com/elfensky/helldivers.bot/issues/444),
unmilestoned but shelved), CrowdSec verification, leaderboard reverse-engineering.

Leave them. They're a parking lot, not a backlog.

## Engineering Health — never closes

Milestone [#17](https://github.com/elfensky/helldivers.bot/milestone/17) is a
permanent catch-all for bugs, fixes, and optimizations. **Do not close it at 0
open issues.** New bugs land here by default.

---

## Suggested order, condensed

```
S0  release the backlog      ← blocks everything
S0a dependency security ⚠️   ← 13 high alerts, incl. auth + Next.js
S1  co-locate tests          ← before feature work adds more test files
S2  stale-issue triage       ← ✅ done 2026-07-27
S2a #469 map faction reveal
S3  #459 null crash
S5  #42 design tokens        ← before S6/S7
S8  …S15  Loadout Builder    ← the main feature arc
S16 squad mode              ← committed; S9 must design the hash for it
S17 Archive Analytics spec refresh ⚠️  ← before any Track D code
S18 …S20  Archive Analytics
S21 SSE spike (throwaway)   ← last; may conclude "don't"
S22 SSE implementation      ← only if S21 says yes
```

S4, S6, S7, Track E and the Track D independents slot in wherever there's
appetite. Track C and Track D touch disjoint parts of the codebase, so they can
run in parallel worktrees if two sessions are in flight.
