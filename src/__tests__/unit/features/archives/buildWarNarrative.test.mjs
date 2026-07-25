import { describe, it, expect } from 'vitest';
import { buildWarNarrative } from '@/features/archives/buildWarNarrative.mjs';
import { PHRASES, pickVariant } from '@/features/archives/narrativePhrasing.mjs';
import { formatNumber } from '@/shared/utils/format/formatNumber.mjs';

const DAY = 86400;
const HOUR = 3600;
const WAR_START = 1_000_000;

/**
 * A season fixture covering every beat path:
 *  - war start (opening beat)
 *  - a faction (Illuminate) introduced mid-war → arrival beat
 *  - a standalone resolved defend + attack → field-report beats
 *  - a 4-event failed-defense cascade for the Bugs → one collapsed beat
 *  - a defeat outcome (Super Earth region-0 defend fails)
 */
function fixture() {
    // Bugs cascade: 4 failed defends, strictly decreasing regions, <1h gaps.
    const cascadeStart = WAR_START + 12 * DAY;
    const cascade = [4, 3, 2, 1].map((region, i) => ({
        type: 'defend',
        status: 'fail',
        enemy: 0,
        region,
        start_time: cascadeStart + i * 30 * 60, // 30 min apart
        end_time: cascadeStart + i * 30 * 60 + 20 * 60,
        season: 200,
    }));

    return {
        season: 200,
        war_start: WAR_START,
        // 0-based reveal slots indexed by enemy id: Bugs (0) start the war,
        // Illuminate (2) arrive second, Cyborgs (1) never appear (255).
        introduction_order: { order: [0, 255, 1] },
        status: [
            { enemy: 0, first_seen: WAR_START, status: 'active' },
            { enemy: 1, first_seen: null, status: 'hidden' },
            { enemy: 2, first_seen: WAR_START + 5 * DAY, status: 'active' },
        ],
        snapshots: [],
        events: [
            // Standalone resolved defend (Cyborgs) on day 1.
            {
                type: 'defend',
                status: 'success',
                enemy: 1,
                region: 6,
                start_time: WAR_START,
                end_time: WAR_START + HOUR,
                season: 200,
            },
            // Illuminate attack captured on day 6.
            {
                type: 'attack',
                status: 'success',
                enemy: 2,
                region: 11,
                start_time: WAR_START + 5 * DAY,
                end_time: WAR_START + 5 * DAY + HOUR,
                season: 200,
            },
            ...cascade,
            // Super Earth falls — region-0 defend fails on day 47 (defeat).
            {
                type: 'defend',
                status: 'fail',
                enemy: 2,
                region: 0,
                start_time: WAR_START + 46 * DAY,
                end_time: WAR_START + 47 * DAY,
                season: 200,
            },
        ],
    };
}

describe('buildWarNarrative', () => {
    it('returns [] for empty/missing event data', () => {
        expect(buildWarNarrative(null)).toEqual([]);
        expect(buildWarNarrative(undefined)).toEqual([]);
        expect(buildWarNarrative({})).toEqual([]);
        expect(buildWarNarrative({ events: [] })).toEqual([]);
    });

    it('opens with a day-1 war-begins beat', () => {
        const beats = buildWarNarrative(fixture());
        expect(beats[0].day).toBe(1);
        expect(beats[0].text).toContain('The war begins');
    });

    it('emits beats in chronological (non-decreasing day) order', () => {
        const beats = buildWarNarrative(fixture());
        for (let i = 1; i < beats.length; i++) {
            expect(beats[i].day).toBeGreaterThanOrEqual(beats[i - 1].day);
        }
    });

    it('computes day offsets as floor((t - war_start)/86400) + 1', () => {
        const beats = buildWarNarrative(fixture());
        // Illuminate arrival is anchored to first_seen = war_start + 5 days → day 6.
        const arrival = beats.find((b) => b.text.includes('Illuminate'));
        expect(arrival).toBeDefined();
        expect(arrival.day).toBe(6);
    });

    it('splices a faction-arrival beat for mid-war introductions', () => {
        const beats = buildWarNarrative(fixture());
        const arrival = beats.find(
            (b) =>
                b.text.includes('Illuminate') &&
                /enter the war|join the war/.test(b.text),
        );
        expect(arrival).toBeDefined();
    });

    it('does not emit an arrival beat for the first-introduced faction', () => {
        const beats = buildWarNarrative(fixture());
        // Bugs are introduced first → already on the field at war start, so no
        // separate "Bugs enter the war" arrival beat.
        const bugsArrival = beats.find(
            (b) => b.text.includes('Bugs') && /enter the war|join the war/.test(b.text),
        );
        expect(bugsArrival).toBeUndefined();
    });

    it('collapses a cascade run into one dramatic beat', () => {
        const beats = buildWarNarrative(fixture());
        const cascadeBeats = beats.filter((b) =>
            /devastating cascade|The line breaks/.test(b.text),
        );
        // The 4 failed Bugs defends collapse into exactly one beat.
        expect(cascadeBeats).toHaveLength(1);
        expect(cascadeBeats[0].text).toContain('4 regions');
        // Cascade starts on day 13 (war_start + 12 days).
        expect(cascadeBeats[0].day).toBe(13);
        // The cascade's individual failed-defend events are NOT also narrated
        // as separate field reports.
        const bugsRegionFalls = beats.filter((b) => b.text.includes('falls to the Bugs'));
        expect(bugsRegionFalls).toHaveLength(0);
    });

    it('caps the chronicle with the war outcome beat', () => {
        const beats = buildWarNarrative(fixture());
        const last = beats[beats.length - 1];
        // Region-0 defend failed → defeat, attributed to the Illuminate.
        expect(last.text).toMatch(/Super Earth falls|Super Earth's defeat/);
        expect(last.text).toContain('Illuminate');
    });

    it('caps a victory with a triumphant, faction-attributed beat', () => {
        // All 3 homeworlds captured → victory; no region-0 failure.
        const data = {
            season: 201,
            war_start: WAR_START,
            introduction_order: { order: [0, 1, 2] },
            status: [],
            snapshots: [],
            events: [0, 1, 2].map((enemy, i) => ({
                type: 'attack',
                status: 'success',
                enemy,
                region: 11,
                start_time: WAR_START + i * DAY,
                end_time: WAR_START + i * DAY + HOUR,
                season: 201,
            })),
        };
        const beats = buildWarNarrative(data);
        const last = beats[beats.length - 1];
        expect(last.text).toMatch(/The war is won|Super Earth endures/);
    });

    it('falls back to the earliest event when war_start is absent', () => {
        const data = fixture();
        delete data.war_start;
        const beats = buildWarNarrative(data);
        // Opening beat anchored to the earliest event (which equals the old
        // WAR_START) → still day 1, no negative or zero days anywhere.
        expect(beats[0].day).toBe(1);
        for (const b of beats) expect(b.day).toBeGreaterThanOrEqual(1);
    });

    it('strips the leading article from cascade faction names (no "The The Illuminate")', () => {
        // Illuminate is "The Illuminate" in the factions enum; emit() carries
        // that full name on cascade.faction, so the beat must resolve the name
        // from cascade.factionIndex through factionName() to avoid doubling.
        const start = WAR_START + 3 * DAY;
        const data = {
            season: 202,
            war_start: WAR_START,
            introduction_order: { order: [0, 1, 2] },
            status: [],
            snapshots: [],
            events: [8, 6, 4, 2].map((region, i) => ({
                type: 'defend',
                status: 'fail',
                enemy: 2,
                region,
                start_time: start + i * 30 * 60,
                end_time: start + i * 30 * 60 + 20 * 60,
                season: 202,
            })),
        };
        const beats = buildWarNarrative(data);
        const cascade = beats.find((b) =>
            /devastating cascade|The line breaks/.test(b.text),
        );
        expect(cascade).toBeDefined();
        expect(cascade.text).toMatch(/Illuminate (push through|sweep)/);
        // No beat should ever contain a doubled article from an unstripped name.
        for (const b of beats) expect(b.text).not.toMatch(/\bthe the\b/i);
    });

    it('produces no NaN days and every beat carries text', () => {
        const beats = buildWarNarrative(fixture());
        for (const b of beats) {
            expect(Number.isNaN(b.day)).toBe(false);
            expect(typeof b.text).toBe('string');
            expect(b.text.length).toBeGreaterThan(0);
        }
    });
});

describe('buildWarNarrative — extension (generators + telemetry)', () => {
    const extData = {
        season: 157,
        war_start: 0,
        introduction_order: { order: [0, 1, 2] },
        status: [
            { enemy: 0, first_seen: 0, status: 'active', points: 0, points_taken: 0 },
        ],
        points_max: { points: [1000, 1000, 1000] },
        snapshots: [],
        playerTimeseries: [],
        events: [
            {
                type: 'defend',
                status: 'success',
                enemy: 0,
                region: 5,
                start_time: 86400,
                end_time: 90000,
                event_id: 1,
            },
            {
                type: 'defend',
                status: 'fail',
                enemy: 0,
                region: 4,
                start_time: 172800,
                end_time: 176400,
                event_id: 2,
            },
        ],
    };

    it('is deterministic — same input yields identical output', () => {
        expect(buildWarNarrative(extData, null)).toEqual(
            buildWarNarrative(extData, null),
        );
    });

    it('omits the numbers beat when telemetry is null', () => {
        const texts = buildWarNarrative(extData, null).map((b) => b.text);
        expect(texts.some((t) => /By the numbers|ledger of war/i.test(t))).toBe(false);
    });

    it('appends a numbers beat when telemetry is present', () => {
        const texts = buildWarNarrative(extData, {
            kills: 1000,
            missions: 50,
            accidentals: 9,
        }).map((b) => b.text);
        expect(texts.some((t) => /By the numbers|ledger of war/i.test(t))).toBe(true);
    });

    it('stays in chronological day order with the new beats', () => {
        const days = buildWarNarrative(extData, {
            kills: 1,
            missions: 1,
            accidentals: 0,
        }).map((b) => b.day);
        expect(days).toEqual([...days].sort((a, b) => a - b));
    });
});

describe('buildWarNarrative — highlight beats through the orchestrator', () => {
    const SEASON = 210;

    /**
     * Fixture that drives every highlight-beat path through the public
     * interface: a surge (day 4), a collapse (day 6), a conquest breakthrough
     * (day 5), a homeworld fall (day 7), and a defeat outcome (day 8).
     * playerTimeseries totals: [100,100,100,200,40] → median 100;
     * 200 ≥ 1.4×100 → surge; 40 ≤ 0.6×100 → collapse (not index 0).
     */
    function highlightFixture() {
        return {
            season: SEASON,
            war_start: WAR_START,
            introduction_order: { order: [0, 1, 2] },
            status: [{ enemy: 0, first_seen: WAR_START, status: 'active' }],
            points_max: { points: [1000, 0, 0] },
            // Slots 1/2 use non-null "active, 0 points" placeholders rather than
            // null: getWarOutcome's anySnapshotDefeated check does
            // `factionData.every((f) => f.status === ...)` over every length-3
            // snapshot with no null-guard, so a null slot throws. max=0 keeps
            // these placeholders from ever crossing the breakthrough threshold.
            snapshots: [
                {
                    time: WAR_START + 2 * DAY,
                    data: [
                        { points: 500, status: 'active' },
                        { points: 0, status: 'active' },
                        { points: 0, status: 'active' },
                    ],
                },
                {
                    time: WAR_START + 4 * DAY, // frac 0.95 ≥ 0.9 → breakthrough, day 5
                    data: [
                        { points: 950, status: 'active' },
                        { points: 0, status: 'active' },
                        { points: 0, status: 'active' },
                    ],
                },
                {
                    time: WAR_START + 6 * DAY, // defeated → homeworld falls, day 7
                    data: [
                        { points: 1000, status: 'defeated' },
                        { points: 0, status: 'active' },
                        { points: 0, status: 'active' },
                    ],
                },
            ],
            playerTimeseries: [
                { time: WAR_START, day: 1, total: 100 },
                { time: WAR_START + 1 * DAY, day: 2, total: 100 },
                { time: WAR_START + 2 * DAY, day: 3, total: 100 },
                { time: WAR_START + 3 * DAY, day: 4, total: 200 }, // surge
                { time: WAR_START + 5 * DAY, day: 6, total: 40 }, // collapse
            ],
            events: [
                {
                    type: 'defend',
                    status: 'success',
                    enemy: 0,
                    region: 5,
                    start_time: WAR_START,
                    end_time: WAR_START + HOUR,
                    event_id: 1,
                    season: SEASON,
                },
                // Region-0 defend fails on day 8 → defeat outcome caps the log.
                {
                    type: 'defend',
                    status: 'fail',
                    enemy: 0,
                    region: 0,
                    start_time: WAR_START + 7 * DAY,
                    end_time: WAR_START + 7 * DAY + HOUR,
                    event_id: 2,
                    season: SEASON,
                },
            ],
        };
    }

    it('emits a surge beat on the peak day with the seeded phrase', () => {
        const beats = buildWarNarrative(highlightFixture());
        const expected = pickVariant(
            PHRASES.surge,
            SEASON,
            (WAR_START + 3 * DAY) | 0,
        )(formatNumber(200));
        const surge = beats.find((b) => b.text === expected);
        expect(surge).toBeDefined();
        expect(surge.day).toBe(4);
    });

    it('emits a collapse beat on the trough day with the seeded phrase', () => {
        const beats = buildWarNarrative(highlightFixture());
        const expected = pickVariant(
            PHRASES.collapse,
            SEASON,
            (WAR_START + 5 * DAY) | 0,
        )(formatNumber(40));
        const collapse = beats.find((b) => b.text === expected);
        expect(collapse).toBeDefined();
        expect(collapse.day).toBe(6);
    });

    it('emits conquest breakthrough and homeworld-fall beats on their crossing days', () => {
        const beats = buildWarNarrative(highlightFixture());
        const breakthrough = pickVariant(PHRASES.breakthrough, SEASON, 0)('Bugs');
        const falls = pickVariant(PHRASES.homeworldFalls, SEASON, 10)('Bugs');
        const bt = beats.find((b) => b.text === breakthrough);
        const hf = beats.find((b) => b.text === falls);
        expect(bt).toBeDefined();
        expect(bt.day).toBe(5);
        expect(hf).toBeDefined();
        expect(hf.day).toBe(7);
    });

    it('emits no surge/collapse beats when player counts are steady', () => {
        const data = highlightFixture();
        data.playerTimeseries = [
            { time: WAR_START, day: 1, total: 100 },
            { time: WAR_START + 1 * DAY, day: 2, total: 101 },
            { time: WAR_START + 2 * DAY, day: 3, total: 99 },
        ];
        const texts = buildWarNarrative(data).map((b) => b.text);
        const surge = pickVariant(
            PHRASES.surge,
            SEASON,
            (WAR_START + 1 * DAY) | 0,
        )(formatNumber(101));
        expect(texts).not.toContain(surge);
    });

    it('dedupes same-faction same-day breakthrough+fall into the fall beat only', () => {
        const data = highlightFixture();
        // Slots 1/2 non-null (see highlightFixture comment) — avoids the
        // getWarOutcome null-slot crash on length-3 snapshots.
        data.snapshots = [
            {
                time: WAR_START + 4 * DAY,
                data: [
                    { points: 950, status: 'active' },
                    { points: 0, status: 'active' },
                    { points: 0, status: 'active' },
                ],
            },
            {
                time: WAR_START + 4 * DAY + HOUR, // same war day → dedupe
                data: [
                    { points: 1000, status: 'defeated' },
                    { points: 0, status: 'active' },
                    { points: 0, status: 'active' },
                ],
            },
        ];
        const texts = buildWarNarrative(data).map((b) => b.text);
        const breakthrough = pickVariant(PHRASES.breakthrough, SEASON, 0)('Bugs');
        const falls = pickVariant(PHRASES.homeworldFalls, SEASON, 10)('Bugs');
        expect(texts).not.toContain(breakthrough);
        expect(texts).toContain(falls);
    });

    it('clamps a late highlight beat so the outcome still caps the chronicle', () => {
        const data = highlightFixture();
        // Telemetry buckets extend 12 days past the final event — the exact
        // scenario the a6fa57e clamp exists for.
        data.playerTimeseries = [
            { time: WAR_START, day: 1, total: 100 },
            { time: WAR_START + 1 * DAY, day: 2, total: 100 },
            { time: WAR_START + 2 * DAY, day: 3, total: 100 },
            { time: WAR_START + 20 * DAY, day: 21, total: 40 }, // late collapse
        ];
        data.snapshots = [];
        const beats = buildWarNarrative(data);
        const collapse = pickVariant(
            PHRASES.collapse,
            SEASON,
            (WAR_START + 20 * DAY) | 0,
        )(formatNumber(40));
        const collapseIdx = beats.findIndex((b) => b.text === collapse);
        expect(collapseIdx).toBeGreaterThan(-1);
        // The outcome beat is last — the clamped collapse must sort before it.
        expect(collapseIdx).toBeLessThan(beats.length - 1);
        expect(beats[beats.length - 1].text).toMatch(
            /Super Earth falls|Super Earth's defeat/,
        );
    });

    it('clamps a late highlight beat DAY label to the last war day', () => {
        const data = highlightFixture();
        data.playerTimeseries = [
            { time: WAR_START, day: 1, total: 100 },
            { time: WAR_START + 1 * DAY, day: 2, total: 100 },
            { time: WAR_START + 2 * DAY, day: 3, total: 100 },
            { time: WAR_START + 20 * DAY, day: 21, total: 40 },
        ];
        data.snapshots = [];
        const beats = buildWarNarrative(data);
        const collapse = pickVariant(
            PHRASES.collapse,
            SEASON,
            (WAR_START + 20 * DAY) | 0,
        )(formatNumber(40));
        const beat = beats.find((b) => b.text === collapse);
        expect(beat).toBeDefined();
        // Last event ends on day 8 — a beat cannot be dated after the war ends.
        expect(beat.day).toBeLessThanOrEqual(8);
    });

    it('numbers beat threads formatNumber output and is dated on the last war day', () => {
        const data = highlightFixture();
        const telemetry = { kills: 25_000_000, missions: 50, accidentals: 9 };
        const beats = buildWarNarrative(data, telemetry);
        const numbers = beats.find((b) => /25\.0M|25,000,000/.test(b.text));
        expect(numbers).toBeDefined();
        const outcome = beats.find((b) =>
            /Super Earth falls|Super Earth's defeat/.test(b.text),
        );
        expect(outcome).toBeDefined();
        // {day, text} is all the public output carries — the numbers beat is
        // anchored at lastTime/lastDay same as the outcome beat.
        expect(numbers.day).toBe(outcome.day);
    });

    it('emits no breakthrough or homeworld-fall beats when no faction crosses the gates or falls', () => {
        const data = highlightFixture();
        data.snapshots = [
            {
                time: WAR_START + 2 * DAY,
                data: [
                    { points: 500, status: 'active' }, // frac 0.5, well under 0.9
                    { points: 0, status: 'active' },
                    { points: 0, status: 'active' },
                ],
            },
            {
                time: WAR_START + 4 * DAY,
                data: [
                    { points: 500, status: 'active' },
                    { points: 0, status: 'active' },
                    { points: 0, status: 'active' },
                ],
            },
        ];
        const texts = buildWarNarrative(data).map((b) => b.text);
        const breakthrough = pickVariant(PHRASES.breakthrough, SEASON, 0)('Bugs');
        const falls = pickVariant(PHRASES.homeworldFalls, SEASON, 10)('Bugs');
        expect(texts).not.toContain(breakthrough);
        expect(texts).not.toContain(falls);
    });

    it('a single-sample player timeseries emits no surge/collapse beats', () => {
        const withOneSample = highlightFixture();
        withOneSample.playerTimeseries = [{ time: WAR_START, day: 1, total: 100 }];
        const withNone = highlightFixture();
        withNone.playerTimeseries = [];
        expect(buildWarNarrative(withOneSample)).toEqual(buildWarNarrative(withNone));
    });
});

describe('buildWarNarrative — arrival beats are capped by the chronicle', () => {
    const DAY_S = 86400;

    /**
     * Reproduces the live season-160 shape: a faction whose `first_seen` falls
     * AFTER the last event resolved. Without clamping, its arrival beat sorts
     * past the closing outcome beat and renders as the last line on the page.
     */
    function lateArrivalFixture() {
        return {
            season: 160,
            war_start: 0,
            // 0-based slots: Bugs (0) start the war, Cyborgs (1) arrive later.
            introduction_order: { order: [0, 1, 255] },
            status: [
                { enemy: 0, first_seen: 0, status: 'active' },
                // Day 3 — later than the last event's end_time (day 2).
                { enemy: 1, first_seen: 3 * DAY_S, status: 'active' },
            ],
            points_max: { points: [1000, 1000, 1000] },
            snapshots: [],
            playerTimeseries: [],
            events: [
                // Region-0 defend failure → getWarOutcome reports a defeat.
                {
                    type: 'defend',
                    status: 'fail',
                    enemy: 0,
                    region: 0,
                    start_time: 1 * DAY_S,
                    end_time: 2 * DAY_S,
                    event_id: 1,
                },
            ],
        };
    }

    it('emits the late arrival but never after the closing outcome beat', () => {
        const beats = buildWarNarrative(lateArrivalFixture());

        const arrival = beats.find((b) => /enter the war|join the war/.test(b.text));
        expect(arrival).toBeDefined();

        // The outcome is always the final word of the chronicle.
        const last = beats[beats.length - 1];
        expect(/enter the war|join the war/.test(last.text)).toBe(false);
        expect(/prevail|falls|defeat|rebranding/i.test(last.text)).toBe(true);
    });

    it('clamps the arrival day to the last event day', () => {
        const beats = buildWarNarrative(lateArrivalFixture());
        const arrival = beats.find((b) => /enter the war|join the war/.test(b.text));
        // first_seen is day 4 by the 1-based dayOf formula; the last event ends
        // on day 3, so the label must be pulled back rather than reported raw.
        expect(arrival.day).toBe(3);
    });
});
