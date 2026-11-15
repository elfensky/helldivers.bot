# GSD milestones for helldivers.bot — design

Date: 2026-11-09. Status: proposed.

## Intent

The GSD plan in `.planning/` holds the whole history and future of the project as milestones: completed milestones
for the past releases, the current milestone, and planned milestones for the future releases. The roadmap page on
projects.lav.ren then shows one row per milestone instead of the single row "v0.96.2".

## Goals, non-goals, anti-goals

- Goals: 12 milestones (7 completed, 1 current, 4 planned) that GSD and the page writer
  (`~/vault/meta/scripts/project-pages.py`) both read without a warning or a refusal.
- Non-goals: no new phases, no re-plan of phase 2, no change to `.planning/architecture/`, `.planning/pages/` or the
  `metrics` branch, no git tag.
- Anti-goals: a milestone label or date that is not true; a GSD phase number that changes; archives that GSD's own
  `milestone complete` would not write.

## Decisions (Andrei, 2026-11-09)

1. Past work: seven outcome milestones by release era, from 0.1.0.
2. Labels: a sequence, M1 to M12. Each goal names its release.
3. Future: five milestones over phases 2–18. Each one ends in a release to `main`. #617–#637 stay in Engineering Health.
4. Phases 1 and 1.1 become the completed milestone M7 through GSD's `milestone complete` (approved).

## Milestones

| Label | Title | Phases | Versions | State |
|---|---|---|---|---|
| M1 | The first site caches the war and draws the map | 0.1–0.4 | 0.1.0–0.8.0 | shipped 2025-12-09 |
| M2 | The rebuilt dashboard works on every screen | 0.5–0.8 | 0.10.0–0.29.2 | shipped 2026-04-08 |
| M3 | The archive holds every season in five tables | 0.9–0.12 | 0.30.0–0.52.9 | shipped 2026-06-21 |
| M4 | Developers can use a public API | 0.13–0.14 | 0.53.0–0.59.0 | shipped 2026-06-23 (v0.59.0) |
| M5 | The archives tell each season's story | 0.15–0.16 | 0.59.1–0.67.6 | shipped 2026-07-27 (v0.67.1) |
| M6 | The dashboard predicts the next events | 0.17–0.18 | 0.68.0–0.91.1 | shipped 2026-08-13 (v0.90.4) |
| M7 | Production is stable on the Hetzner swarm | 1, 1.1 | 0.92.0–0.96.4 | shipped 2026-10-25 (v0.96.4) |
| M8 | The site is documented, tested and findable | 2–6 | from 0.97.0 | in progress |
| M9 | Players can build and share loadouts | 7–9 | — | planned |
| M10 | Players can explore season analytics | 10–12 | — | planned |
| M11 | The site is accessible and polished | 13–15 | — | planned |
| M12 | Staging runs on the Pi and live updates are decided | 16–18 | — | planned |

## Approaches

One layout satisfies both readers; a throwaway clone proved it on 2026-11-09 (all five GSD checks clean, the
writer gave one row per milestone, the `milestone complete` dry run passed). Each milestone has its own `##` section
(`## 🚧 M8 · … (in progress)`, `## 📋 M9 · … (planned)`) with a `**Milestone goal:**` line, its phase list lines and
its `### Phase N:` details. A shipped milestone is a `<details>` block with the GSD summary line
`<summary>✅ M4 · … (Phases 0.13–0.14) — SHIPPED 2026-06-23</summary>` plus `milestones/M4-ROADMAP.md`.

- Rejected: milestone sections at `###` under `## Phases` (GSD's template). The writer reads only `##` sections, so
  every phase would land in the current milestone.
- Rejected: no phases in the past milestones. Their rows would have no page and no list of what shipped.

## Design

- M7 goes first, through `milestone complete M7 --confirm`: it copies ROADMAP.md and REQUIREMENTS.md to
  `milestones/`, moves `phases/01-*` and `phases/01.1-*` to `milestones/M7-phases/`, writes MILESTONES.md and
  resets STATE.md. Then: the MILESTONES.md date becomes 2026-10-25 (the command writes today), `M7-ROADMAP.md` keeps
  only the M7 part in the `templates/milestone-archive.md` shape, and the section collapses into `<details>`.
- M1–M6 are written by hand in the same shape: a `<details>` block in ROADMAP.md, `milestones/M<n>-ROADMAP.md` with
  bold phase lines (`- [x] **Phase 0.13: …** - … (completed …)`) and a MILESTONES.md entry. They have no plan,
  summary or requirements files, and each archive says so.
- STATE.md names `milestone: M8` with its `milestone_name`; the current phase stays 02. The ROADMAP Overview
  describes the milestone sequence; PROJECT.md names the current milestone.

## Calls left to the builder (marked as such)

- Past phases are numbered 0.1–0.18, so no number repeats GSD's phases 1–18. The writer accepts any number.
- A shipped date is the date of the milestone's last version (`git blame` on its CHANGELOG heading); the goal names
  the release that reached `main`.
- The 2–4 items per past milestone come from the CHANGELOG eras.
- The Progress table keeps its four columns: no reader needs a milestone column.
