# Archive Analytics Debate Synthesis

**Date:** 2026-03-30
**Topic:** What analytics features to build for /archives from h1_live_snapshot historic data
**Participants:** Claude Opus, Gemini, Sonnet (Claude), Codex (GPT-5.4)

## Debate Parameters

- **Audience:** Layered — casual players (glanceable) + stat nerds (deep dive)
- **Scope:** Discovery only — feature ideation, implementation deferred
- **Dimensions:** All — temporal, faction, engagement, events, cross-season, creative

## Consensus Ranking

### Tier 1: Strong Consensus (3-4/4 debaters)

| #   | Feature                       | Proposers | Complexity | Type       | Key Fields                        |
| --- | ----------------------------- | --------- | ---------- | ---------- | --------------------------------- |
| 1   | Friendly Fire Index           | ALL 4     | Low        | Both       | accidentals, kills                |
| 2   | Season Fingerprint/DNA        | ALL 4     | Medium     | Both       | All h1_live_snapshot, radar chart |
| 3   | Season Records & Superlatives | 3/4       | Low        | Glanceable | All aggregates, cross-season      |
| 4   | Momentum/Campaign Tracker     | 3/4       | Medium     | Both       | h1_snapshot points rate-of-change |
| 5   | Faction Threat Ranking        | 3/4       | Low        | Glanceable | defend/attack events per enemy    |
| 6   | Player Attrition Curve        | 3/4       | Medium     | Deep dive  | players, time, season_duration    |

### Tier 2: High Impact, Less Consensus

| #   | Feature                    | Proposers | Complexity | Type       | Key Fields                           |
| --- | -------------------------- | --------- | ---------- | ---------- | ------------------------------------ |
| 7   | Clutch Factor / Last Stand | 2/4       | High       | Both       | h1_event_snapshot point progressions |
| 8   | Peak Hour Heatmap          | 2/4       | Medium     | Deep dive  | players, time (hour/day), events     |
| 9   | Accuracy Trend             | 3/4       | Low        | Deep dive  | hits, shots                          |
| 10  | Perfect Storm Detector     | 1/4       | Medium     | Glanceable | compound stress metric               |
| 11  | Season Report Card         | 1/4       | Medium     | Both       | composite grade formula              |
| 12  | Christmas/Holiday Effect   | 2/4       | Medium     | Both       | players + external calendar          |
| 13  | Coordination Paradox       | 1/4       | Medium     | Deep dive  | players vs success rates             |
| 14  | Planet Heartbeat Waveforms | 1/4       | Medium     | Both       | h1_event_snapshot per-event          |
| 15  | Shots per Planet           | 1/4       | Low        | Glanceable | shots, completed_planets             |

## Recommended Phases

### Phase A: Quick Wins (1-2 days each)

- Friendly Fire Index (sparkline per season)
- Season Records (stat cards)
- Faction Threat Ranking (bar chart)
- Accuracy Trend (line chart)
- Shots per Planet (big number callout)

### Phase B: Core Analytics (2-4 days each)

- Season Report Card (composite grade + breakdown)
- Season Fingerprint (radar chart comparison)
- Player Attrition Curve (engagement decay)
- Momentum Tracker (liberation rate-of-change)
- Peak Hour Heatmap (7x24 grid)

### Phase C: Storytelling Features (3-5 days each)

- Clutch Factor (auto-detected comebacks)
- Perfect Storm Detector (worst moment)
- Coordination Paradox (player count sweet spot)
- Planet Heartbeat (event waveforms)

## Per-Participant Summaries

### Claude Opus (Systems thinker)

Focused on derived metrics and hidden patterns. Strongest proposals: Season Report Card (letter grades), Clutch Factor (comeback detection), Christmas Effect. Unique angle: "Attrition Curves" with decay half-life comparison.

### Gemini (Data-viz, bold)

Most provocative naming ("Meat Grinder," "Wall of Shame"). Strongest proposals: Galactic Momentum Oscilloscope, Shots per Planet (big bold number). Unique angle: Faction Dominance Radar as spider chart.

### Sonnet (UX storyteller)

Most narrative-focused. Strongest proposals: War Story Arc (cinematic timeline), Perfect Storm Detector, Planet Heartbeat. Unique angle: "Accuracy Collapse" as proxy for playerbase emotional state.

### Codex (Pragmatic engineer)

Most implementation-aware. Strongest proposals: War Pulse (instant summary), What Drove Campaign Points (correlation analysis). Unique angle: Difficulty vs Success Curve sweet spot, Event Impact Timeline (before/during/after analysis).

## Key Insights

1. **Friendly fire is the universal killer feature** — all 4 independently proposed it
2. **Season comparison is a core need** — every participant proposed some form of cross-season fingerprinting
3. **Storytelling features have the highest ceiling** but also highest complexity
4. **The "more players ≠ better" paradox** is the most counterintuitive finding possible
5. **Holiday/seasonal correlation** needs external calendar data but is worth it for community engagement
