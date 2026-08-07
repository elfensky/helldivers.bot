# Roadmap

Execution order for open work. GitHub Issues stays the source of truth for
_what_ — this file is the source of truth for _when_, and for how to slice the
work into sessions.

**Last reconciled against the code: 2026-08-07** (`develop` @ `v0.90.8`,
`main` @ `v0.90.5`). Regenerate the state table when it drifts:
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

## Now — post-release triage

### ~~S0 — Release the develop backlog~~ ✅ done 2026-08-06

The 23-version backlog shipped. `main` went 0.67.1 → **v0.90.4** (PR #498) and
then **v0.90.5** the same day, fixing the migrate image's arm64 build that
v0.90.4's release exposed. `develop` is now a handful of commits ahead of
`main`, which is the gap this file said to hold it at.

**The lesson stays on the page, because it is a cadence rule, not a one-off:**
release when the gap is a handful of versions, not when it is twenty-three. The
same blocker had already been cleared once (v0.65.3 → v0.67.1) and reopened at
three times the size. Next release when the develop/main gap reaches ~5
versions, not when something forces it.

#### Dependabot is clear — that section is retired

Verified 2026-08-05: **0 open Dependabot alerts** against `main`, and
`npm audit` on `develop` reports **0 vulnerabilities**. The v0.67.1 release
cleared the 23-alert backlog, and v0.90.0's dependency pass cleared both high
advisories that appeared after it. Re-check at release time, but there is no
standing security debt:

```
gh api repos/elfensky/helldivers.bot/dependabot/alerts --paginate \
  -q '[.[]|select(.state=="open")]|length'   # expect 0
npm audit --audit-level=moderate             # expect 0
```

### S0a — Post-release error triage ← **start here**

- **Prep:** none — v0.90.5 tagged 2026-08-06, so `dpl=0-90-5` events have been
  landing since; the ~48h window closes 2026-08-08
- **Branch:** direct (bugfix)
- **Blocked by:** — (S0 shipped)

GlitchTip's unresolved list is dominated by errors that may already be fixed.
Re-count now that the release is live and act on what survives.

| Finding                                                                                              | Events | Status after release                                                        |
| ---------------------------------------------------------------------------------------------------- | -----: | --------------------------------------------------------------------------- |
| React #418 hydration mismatch on `/` ([#496](https://github.com/elfensky/helldivers.bot/issues/496)) |   ~266 | **One cause fixed in v0.90.3, still re-count** — see below                  |
| `Map.groupBy is not a function` ([#495](https://github.com/elfensky/helldivers.bot/issues/495))      |      1 | **Still broken** — the code is unchanged on develop; fix regardless         |
| `ChunkLoadError` (~25 issues, ~60 events)                                                            |    ~60 | **Expected to drop** — stale-chunk reloads; a 23-version gap maximizes them |
| Notification toggle stuck loading ([#485](https://github.com/elfensky/helldivers.bot/issues/485))    |      — | **Unknown** — filed against 0.67.1, re-verify in production                 |

`Map.groupBy` (#495) is the one that does **not** wait: `groupEventsByDay.mjs`
and `groupCascadesBySeason.mjs` still call it on the client, so Firefox 115 ESR
(the last Firefox for Windows 7/8) lost the timeline before the release and
still loses it on v0.90.5. Fix it regardless of what the re-count says.

**Diagnostics — done in v0.90.3, one blocker left.** Sourcemaps were not
reaching GlitchTip for three reasons, none of them the wiring (which was always
correct) and none of them a missing debug-ID feature (GlitchTip is 6.1.4 and
its `chunk-upload` endpoint accepts `artifact_bundles`):

1. `SENTRY_PROJECT` held the project's display name (`helldivers.bot`) instead
   of its slug (`helldiversbot`), so `releases new` 404'd on every build. Fixed
   in `.env.development` and in the repository secret.
2. `silent: true` in `withSentryConfig` suppresses `console.error`, not just
   info, so both failures were invisible in every CI build. Removed.
3. **Still open — [#497](https://github.com/elfensky/helldivers.bot/issues/497).**
   The GlitchTip server cannot write its own upload directory:
   `[Errno 13] Permission denied: '/code/uploads/file_blobs'`. A host-side
   volume-ownership fix, not a repo fix.

**Frames will stay minified until #497 lands.** If #418 survives the release,
fix #497 before trying to debug it — that is the whole point of having done
this first.

**#496 — one contributing cause already fixed.** `DefeatedCard` (dashboard,
present at v0.67.1) formatted its date with a pinned locale but no pinned
timezone and no `suppressHydrationWarning`: a UTC server renders
`Jul 23, 2025` where a Europe/Warsaw visitor renders `Jul 24, 2025`, which is
exactly the reporter profile on the issue. Fixed in v0.90.3, with a sibling in
`EventLogCard`'s absolute time line on `/archives`. `NextWaveCard`, the suspect
the issue named, is **cleared** — it did not exist at v0.67.1, and its
`suppressHydrationWarning` does hold across two adjacent text children.
This is not proof it produced all ~266 events, so the re-count still governs.

The remaining `ReferenceError`s in GlitchTip (`factions is not defined`,
`eventVerdict is not defined`, `NextWaveCard is not defined`) carry deployment
ids `0-72-0` / `0-83-1` / `0-85-0` — versions that only ever existed on
`develop`. They are local dev HMR artifacts, not production. Ignore them.

---

## Track A — Housekeeping

Small, independent, no design questions. Good for short sessions or for warming
up in a codebase area before a bigger feature. Take these in any order.

### S1 — Co-locate unit tests ([#466](https://github.com/elfensky/helldivers.bot/issues/466))

- **Prep:** plan — 171 files move to ~7, and `vitest.config.mjs` include/exclude
  globs plus `_meta/mirrorTree.test.mjs` all change with them
- **Branch:** worktree (mechanically large, benefits from isolation)
- **Blocked by:** — (S0 shipped)

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

### S3a — Space Mono never loads ([#476](https://github.com/elfensky/helldivers.bot/issues/476))

- **Prep:** none to diagnose, but **measure before merging** — this is a
  site-wide typography change, not a one-line import
- **Branch:** worktree (visual blast radius across every mono element)

`layout.css` declares `--font-mono: 'Space Mono', monospace` but `layout.jsx`
only imports `Space_Grotesk` and `Inter`, so every mono element — card points,
countdowns, pace indicators, bar labels, StatGrid values — has always rendered
in the browser default. Verified against season 160: `document.fonts` carries no
Space Mono, and `0`/`M`/`i` all measure 8.4297px on a real `.sector-card-points`.

**The decision is which way to resolve it, and that is a design call.** Loading
the real face changes the width of every mono element on the site; Space Mono is
wider and more distinctive than the default, so column fits and the
`flex-wrap` on `.sector-card-meta` shift with it. The alternative — dropping
`'Space Mono'` from the declaration — admits that the design has been tuned
against the fallback for its whole life, and is the smaller change.

Either way, measure the affected rows before and after rather than merging on
the assumption that the intended font is the right one.

### S4 — Post-deploy SEO verification ([#389](https://github.com/elfensky/helldivers.bot/issues/389))

- **Prep:** none
- **Branch:** direct (chore)
- **Blocked by:** — (S0 shipped 2026-08-06; production is now v0.90.5)

Rich Results, Schema validator, Search Console. Verification pass, likely
zero-to-small code change.

### Parked — prediction follow-ups waiting on data, not on appetite

The prediction arc (#472–#490) closed with three issues that are deliberately
**not schedulable**: they are blocked on the game producing more seasons, and
no amount of session time moves them. Do not pick these up on a quiet day —
check the gate first, and if it isn't met, put them back.

| Issue                                                                                         | Unblocks when                        |
| --------------------------------------------------------------------------------------------- | ------------------------------------ |
| [#481](https://github.com/elfensky/helldivers.bot/issues/481) Attack ETA attempt 4b           | ~S165+ reached                       |
| [#484](https://github.com/elfensky/helldivers.bot/issues/484) Sector ETA measured range       | script 13's gate becomes evaluable   |
| [#487](https://github.com/elfensky/helldivers.bot/issues/487) Defend attempt 6                | ~30+ progress-tracked assaults exist |
| [#477](https://github.com/elfensky/helldivers.bot/issues/477) Assault ETA band width (Icebox) | ~S172                                |

`docs/superpowers/predictions-handoff.md` is the living record for all of these
— read it before touching any prediction work, per CLAUDE.md.

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
| **S8**  | [#339](https://github.com/elfensky/helldivers.bot/issues/339) Static item catalogs `L` + [#340](https://github.com/elfensky/helldivers.bot/issues/340) design tokens `XS`     | brainstorm                                                | worktree | —          |
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

#### Measured coverage (queried 2026-07-27, still current 2026-08-05)

The current season is **still 160** and still active, so no new season has
closed since the measurement below — the counts stand as written.

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

Milestone [#18](https://github.com/elfensky/helldivers.bot/milestone/18). Four
issues, all independent, all optional. Pull one when you want something small
and fun between tracks.

| Issue                                                                                          | Prep                                                 | Branch   |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------- |
| [#238](https://github.com/elfensky/helldivers.bot/issues/238) Admin: send custom notifications | plan                                                 | worktree |
| [#392](https://github.com/elfensky/helldivers.bot/issues/392) Ministry of Truth easter egg     | brainstorm — it's a writing problem                  | worktree |
| [#471](https://github.com/elfensky/helldivers.bot/issues/471) Faction-specific vernacular      | brainstorm — the vocabulary table is the deliverable | worktree |
| [#27](https://github.com/elfensky/helldivers.bot/issues/27) User Dashboard improvements        | brainstorm — 456-char body, no criteria              | worktree |

**#471 and [#453](https://github.com/elfensky/helldivers.bot/issues/453) touch
the same copy.** Whichever lands second should consume the other's vocabulary
source rather than defining a second one — #453 owns the narrative phrasing
pools, and #471 introduces per-faction wording the narrative also wants.

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

## Track G — Staging deploy (gated on the homelab)

### S23 — Staging deploy to the Pi swarm ([#474](https://github.com/elfensky/helldivers.bot/issues/474))

- **Prep:** none — the pipeline is already scaffolded on `feature/deploy-rpi-staging`; the
  remaining work is homelab setup, not code (see `deploy/README.md` and the issue checklist)
- **Branch:** `feature/deploy-rpi-staging` (exists). The `*_FILE` secrets bridge is done +
  tested; the deploy job, stack file, and Kuma banner script are DRAFT until a real run
- **Blocked by:** the 3-Pi staging swarm + a self-hosted runner being up (external — tracked
  in the `hardenup` refocus, [drunikbe/hardenup#1](https://github.com/drunikbe/hardenup/issues/1))

Gated on the homelab, not on appetite. Once `docker node ls` shows a healthy 3-manager swarm
and the self-hosted runner is registered: create the Swarm secrets, finalize the Cloudflare
Tunnel, set the GitHub Actions secrets, then let the first `develop` push validate it
end-to-end. Multi-arch (arm64) image builds already merged (v0.67.5).

## Engineering Health — never closes

Milestone [#17](https://github.com/elfensky/helldivers.bot/milestone/17) is a
permanent catch-all for bugs, fixes, and optimizations. **Do not close it at 0
open issues.** New bugs land here by default.

---

## Suggested order, condensed

```
S0  release the backlog      ← ✅ done 2026-08-06 (main @ v0.90.5)
S0a post-release triage      ← re-count GlitchTip; #495 fixes regardless
S1  co-locate tests          ← before feature work adds more test files
S2  stale-issue triage       ← ✅ done 2026-07-27
S2a #469 map faction reveal
S3  #459 null crash
S3a #476 Space Mono          ← measure before merging
S5  #42 design tokens        ← before S6/S7
S8  …S15  Loadout Builder    ← the main feature arc
S16 squad mode              ← committed; S9 must design the hash for it
S17 Archive Analytics spec refresh ⚠️  ← before any Track D code
S18 …S20  Archive Analytics
S21 SSE spike (throwaway)   ← last; may conclude "don't"
S22 SSE implementation      ← only if S21 says yes
S23 staging deploy          ← gated on the homelab Pi swarm, not appetite
```

S4, S6, S7, Track E and the Track D independents slot in wherever there's
appetite. Track C and Track D touch disjoint parts of the codebase, so they can
run in parallel worktrees if two sessions are in flight.

**Track A has not moved since 2026-07-27.** S1, S2a, S3, S3a and S4 were all
startable then and are all still open now — the ~23 versions that shipped in
between went entirely to unplanned prediction work. That is a fine outcome for
one arc and a bad pattern for three; if the next arc is also unplanned, add it
to this file when it starts rather than reconstructing it afterwards.
