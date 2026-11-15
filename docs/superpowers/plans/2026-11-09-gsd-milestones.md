# GSD milestones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `.planning/` holds 12 milestones (M1–M7 shipped, M8 current, M9–M12 planned) that GSD and the page writer both read cleanly.

**Architecture:** One `##` section per open milestone, one `<details>` block plus `milestones/M<n>-ROADMAP.md` per shipped milestone. M7 is archived by GSD's own `milestone complete`; M1–M6 are written by hand in the same shape.

**Tech Stack:** GSD (`~/.claude/gsd-core/bin/gsd-tools.cjs`), the page writer (`~/vault/meta/scripts/project-pages.py`), Markdown.

**Spec:** `docs/superpowers/specs/2026-11-09-gsd-milestones-design.md`

## Global Constraints

- Labels M1–M12, titles exactly as in the spec's Milestones table; a title is at most 60 characters, a goal's first sentence at most 140.
- No phase folder renamed; no change under `.planning/architecture/` or `.planning/pages/`; no git tag; no `metrics` branch change.
- Commits as `andrei@lav.ren`. Commands: `G=~/.claude/gsd-core/bin/gsd-tools.cjs`.
- `milestone complete` runs once, for M7 only (approved 2026-11-09).

## Review Focus

- A `<summary>` line that the writer's `ARCHIVE_LINE` does not match: the writer refuses. Pinned by the writer run in Task 4.
- A phase list line inside a shipped `<details>` block written bold: the writer would count it in the current milestone. Shipped blocks use plain `- [x] Phase N: …` lines; Task 4 checks M8 has exactly phases 2–6.
- STATE.md after `milestone complete`: the command resets it for a new milestone. Task 2 sets M8 and phase 02; Task 4 checks `progress` names M8.
- MILESTONES.md date: the command writes today (2026-11-09), not 2026-10-25. Task 2 fixes it.
- `M7-ROADMAP.md` is a copy of the whole ROADMAP.md, so the writer would list phases 2–18 under M7. Task 2 trims it; Task 4 checks M7 has two items.

---

### Task 1: ROADMAP.md in milestone sections, M7 current

**Files:** Modify `.planning/ROADMAP.md`, `.planning/STATE.md`

- [ ] Add `## Milestones` (12 list lines, `- <emoji> **M<n> <title>** — Phases a–b (shipped|in progress|planned)`), move each phase list line and its `### Phase N:` details into `## 🚧 M7 · … (in progress)`, `## 📋 M8 · … (planned)` … `## 📋 M12 · …`, each with a `**Milestone goal:**` line. Rename `### Phase 01.1:` to `### Phase 1.1:`.
- [ ] STATE.md frontmatter: `milestone: M7`, `milestone_name: Production is stable on the Hetzner swarm`.
- [ ] Run `node $G roadmap analyze` → phases `['1', '1.1']`, scope `complete`. Run `node $G milestone complete M7 --dry-run` → stats 2 phases, 9 plans.
- [ ] Commit `docs(planning): split the roadmap into milestone sections`.

### Task 2: Archive M7 with GSD, then make M8 current

**Files:** `.planning/milestones/M7-*`, `.planning/MILESTONES.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`

- [ ] Run `node $G milestone complete M7 --name "Production is stable on the Hetzner swarm" --confirm`. Expected: `milestones/M7-ROADMAP.md`, `milestones/M7-REQUIREMENTS.md`, `milestones/M7-phases/01-stability-fixes-release/`, `milestones/M7-phases/01.1-production-on-the-hetzner-swarm/`, MILESTONES.md.
- [ ] MILESTONES.md: `(Shipped: 2026-10-25)`. `M7-ROADMAP.md`: the milestone-archive template header and only the M7 phases.
- [ ] ROADMAP.md: the M7 section becomes `<details><summary>✅ M7 · Production is stable on the Hetzner swarm (Phases 1–1.1) — SHIPPED 2026-10-25</summary>` with plain phase lines and archive links; M8 becomes `## 🚧 M8 · … (in progress)` and its list line 🚧.
- [ ] STATE.md: `milestone: M8`, `milestone_name: The site is documented, tested and findable`, `current_phase: 02`, Current Position phase 02.
- [ ] Commit `docs(planning): archive M7 with milestone complete`.

### Task 3: M1–M6 archives

**Files:** Create `.planning/milestones/M1-ROADMAP.md` … `M6-ROADMAP.md`; modify `.planning/MILESTONES.md`, `.planning/ROADMAP.md`

- [ ] Each archive: `# Milestone M<n>: <title>`, `**Status:** ✅ SHIPPED <date>`, `**Phases:**`, `**Versions:**`, `## Overview` (goal; one line that it predates GSD and has no plan, summary or requirements files), `## Phases` with bold lines `- [x] **Phase 0.x: <name>** - <goal> (completed <date>)`, `## Milestone Summary` (what was later replaced).
- [ ] ROADMAP.md: one `<details>` block per milestone, before M7's, plain phase lines and the archive link. MILESTONES.md: one entry each, newest first.
- [ ] Commit `docs(planning): patch in the shipped milestones M1 to M6`.

### Task 4: Overview, PROJECT.md, and verification in a clone

**Files:** Modify `.planning/ROADMAP.md` (Overview), `.planning/PROJECT.md`

- [ ] Overview names the milestone sequence; PROJECT.md names M8 as current.
- [ ] In `mktemp -d` clone at HEAD with origin `https://github.com/elfensky/helldivers.bot.git`: `validate consistency` passed with 0 warnings; `validate health` no new warning; `roadmap validate` no warning; `roadmap analyze` phases 2–6, no `checkbox_conflict`; `progress` names M8; writer (`--repo "$(pwd -P)"`) writes 12 milestone pages (every milestone has phases) and no refusal; `project.json` has 12 milestones in order, M7 with 2 items, M8 with phases 2–6.
- [ ] Commit `docs(planning): describe the milestone sequence`.

### Task 5: Land

- [ ] Verification gate (`npm ci`, `prisma generate`, lint, typecheck, test:unit, build with dummy env).
- [ ] PR into `develop`; council review (Claude Opus, GPT Astra, DeepSeek V4 Pro); fix findings; `gh pr merge <n> --rebase`; `git push origin --delete docs/gsd-milestones`.
- [ ] `/handbook-align-pages` from develop: data files PR. Journal bullet.
