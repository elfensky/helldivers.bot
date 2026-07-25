import { describe, it, expect } from 'vitest';
import { findAllCascades } from '@/shared/utils/game/seasonAnalytics.mjs';

/**
 * Helper to build a defend/fail event. `gapAfterPrevEndSec` defaults to
 * 1800 (30 minutes), well inside the 1-hour cascade window.
 */
function makeFailedDefend({ enemy, region, prevEndTime = null, durationSec = 7200 }) {
    const start_time = prevEndTime != null ? prevEndTime + 1800 : 0;
    const end_time = start_time + durationSec;
    return {
        type: 'defend',
        status: 'fail',
        enemy,
        region,
        start_time,
        end_time,
        event_id: Math.floor(Math.random() * 1_000_000),
    };
}

describe('findAllCascades', () => {
    it('returns [] for empty events', () => {
        expect(findAllCascades([])).toEqual([]);
        expect(findAllCascades(null)).toEqual([]);
        expect(findAllCascades(undefined)).toEqual([]);
    });

    it('returns [] when there are too few failed defends', () => {
        const e1 = makeFailedDefend({ enemy: 2, region: 8 });
        const e2 = makeFailedDefend({ enemy: 2, region: 7, prevEndTime: e1.end_time });
        expect(findAllCascades([e1, e2])).toEqual([]);
    });

    it('returns [] for a length-3 sequence that fails the gap rule', () => {
        const e1 = makeFailedDefend({ enemy: 2, region: 8 });
        // 2-hour gap (> 1-hour rule) → cascade breaks
        const e2 = {
            ...makeFailedDefend({ enemy: 2, region: 7 }),
            start_time: e1.end_time + 7200,
            end_time: e1.end_time + 7200 + 7200,
        };
        const e3 = {
            ...makeFailedDefend({ enemy: 2, region: 6 }),
            start_time: e2.end_time + 1800,
            end_time: e2.end_time + 1800 + 7200,
        };
        expect(findAllCascades([e1, e2, e3], { minLength: 3 })).toEqual([]);
    });

    it('detects a length-3 cascade for one faction', () => {
        const e1 = makeFailedDefend({ enemy: 2, region: 8 });
        const e2 = makeFailedDefend({ enemy: 2, region: 7, prevEndTime: e1.end_time });
        const e3 = makeFailedDefend({ enemy: 2, region: 6, prevEndTime: e2.end_time });
        const result = findAllCascades([e1, e2, e3], { minLength: 3 });
        expect(result).toHaveLength(1);
        expect(result[0].length).toBe(3);
        expect(result[0].faction).toBe('The Illuminate');
        expect(result[0].factionIndex).toBe(2);
        expect(result[0].regions).toEqual([8, 7, 6]);
        expect(result[0].startTime).toBe(e1.start_time);
        expect(result[0].endTime).toBe(e3.end_time);
        expect(result[0].durationSec).toBe(e3.end_time - e1.start_time);
        expect(result[0].firstEvent.event_id).toBe(e1.event_id);
        expect(result[0].lastEvent.event_id).toBe(e3.event_id);
        expect(result[0].events).toHaveLength(3);
    });

    it('ignores non-defend and non-fail events', () => {
        const events = [
            {
                type: 'attack',
                status: 'success',
                enemy: 0,
                region: 5,
                start_time: 0,
                end_time: 100,
            },
            {
                type: 'defend',
                status: 'success',
                enemy: 0,
                region: 4,
                start_time: 200,
                end_time: 300,
            },
            {
                type: 'defend',
                status: 'fail',
                enemy: 0,
                region: 3,
                start_time: 400,
                end_time: 500,
            },
        ];
        expect(findAllCascades(events)).toEqual([]);
    });

    it('breaks the cascade when region does not strictly decrease', () => {
        const e1 = makeFailedDefend({ enemy: 0, region: 5 });
        const e2 = makeFailedDefend({ enemy: 0, region: 5, prevEndTime: e1.end_time });
        const e3 = makeFailedDefend({ enemy: 0, region: 4, prevEndTime: e2.end_time });
        expect(findAllCascades([e1, e2, e3], { minLength: 3 })).toEqual([]);
    });

    it('keeps cascades from separate factions independent', () => {
        const b1 = makeFailedDefend({ enemy: 0, region: 4 });
        const b2 = makeFailedDefend({ enemy: 0, region: 3, prevEndTime: b1.end_time });
        const b3 = makeFailedDefend({ enemy: 0, region: 2, prevEndTime: b2.end_time });
        const i1 = {
            ...makeFailedDefend({ enemy: 2, region: 8 }),
            end_time: b1.end_time + 60,
        };
        const i2 = {
            ...makeFailedDefend({ enemy: 2, region: 7 }),
            start_time: i1.end_time + 600,
            end_time: i1.end_time + 600 + 7200,
        };
        const i3 = {
            ...makeFailedDefend({ enemy: 2, region: 6 }),
            start_time: i2.end_time + 600,
            end_time: i2.end_time + 600 + 7200,
        };
        const i4 = {
            ...makeFailedDefend({ enemy: 2, region: 5 }),
            start_time: i3.end_time + 600,
            end_time: i3.end_time + 600 + 7200,
        };

        const result = findAllCascades([b1, i1, b2, i2, b3, i3, i4], { minLength: 3 });
        expect(result).toHaveLength(2);
        expect(result[0].length).toBe(4);
        expect(result[0].factionIndex).toBe(2);
        expect(result[1].length).toBe(3);
        expect(result[1].factionIndex).toBe(0);
    });

    it('emits multiple cascades from the same faction when separated by a gap', () => {
        const a1 = makeFailedDefend({ enemy: 0, region: 5 });
        const a2 = makeFailedDefend({ enemy: 0, region: 4, prevEndTime: a1.end_time });
        const a3 = makeFailedDefend({ enemy: 0, region: 3, prevEndTime: a2.end_time });
        const gapEnd = a3.end_time + 86400;
        const b1 = {
            ...makeFailedDefend({ enemy: 0, region: 6 }),
            start_time: gapEnd,
            end_time: gapEnd + 7200,
        };
        const b2 = makeFailedDefend({ enemy: 0, region: 5, prevEndTime: b1.end_time });
        const b3 = makeFailedDefend({ enemy: 0, region: 4, prevEndTime: b2.end_time });

        const result = findAllCascades([a1, a2, a3, b1, b2, b3], { minLength: 3 });
        expect(result).toHaveLength(2);
        expect(result.every((c) => c.length === 3 && c.factionIndex === 0)).toBe(true);
    });

    it('respects custom minLength', () => {
        const e1 = makeFailedDefend({ enemy: 1, region: 4 });
        const e2 = makeFailedDefend({ enemy: 1, region: 3, prevEndTime: e1.end_time });
        const e3 = makeFailedDefend({ enemy: 1, region: 2, prevEndTime: e2.end_time });
        expect(findAllCascades([e1, e2, e3])).toHaveLength(0); // default 4 rejects a 3-run
        expect(findAllCascades([e1, e2, e3], { minLength: 3 })).toHaveLength(1);
        expect(findAllCascades([e1, e2, e3], { minLength: 2 })).toHaveLength(1);
    });

    it('sorts by length DESC, then speed DESC, then end_time DESC', () => {
        const a1 = {
            type: 'defend',
            status: 'fail',
            enemy: 0,
            region: 5,
            start_time: 0,
            end_time: 10800,
            event_id: 1,
        };
        const a2 = {
            type: 'defend',
            status: 'fail',
            enemy: 0,
            region: 4,
            start_time: 12000,
            end_time: 22800,
            event_id: 2,
        };
        const a3 = {
            type: 'defend',
            status: 'fail',
            enemy: 0,
            region: 3,
            start_time: 24000,
            end_time: 34800,
            event_id: 3,
        };
        const b1 = {
            type: 'defend',
            status: 'fail',
            enemy: 2,
            region: 5,
            start_time: 100000,
            end_time: 103600,
            event_id: 4,
        };
        const b2 = {
            type: 'defend',
            status: 'fail',
            enemy: 2,
            region: 4,
            start_time: 104000,
            end_time: 107600,
            event_id: 5,
        };
        const b3 = {
            type: 'defend',
            status: 'fail',
            enemy: 2,
            region: 3,
            start_time: 108000,
            end_time: 111600,
            event_id: 6,
        };

        const result = findAllCascades([a1, a2, a3, b1, b2, b3], { minLength: 3 });
        expect(result).toHaveLength(2);
        expect(result[0].factionIndex).toBe(2);
        expect(result[1].factionIndex).toBe(0);
    });

    it('is independent of input order when end_time values tie', () => {
        // Sorting on end_time alone is a partial order: on a tie, cascade membership
        // would depend on the caller's array order, so /stats (getCascadeLeaderboard)
        // and /archives (getCampaign) could disagree and the deep link would miss.
        // The event_id tiebreak makes the result a function of the input *set*.
        const tied = [
            {
                type: 'defend',
                status: 'fail',
                enemy: 0,
                region: 5,
                start_time: 0,
                end_time: 3600,
                event_id: 10,
            },
            {
                type: 'defend',
                status: 'fail',
                enemy: 0,
                region: 4,
                start_time: 3700,
                end_time: 7200,
                event_id: 11,
            },
            // same end_time as the previous event
            {
                type: 'defend',
                status: 'fail',
                enemy: 0,
                region: 3,
                start_time: 3800,
                end_time: 7200,
                event_id: 12,
            },
            {
                type: 'defend',
                status: 'fail',
                enemy: 0,
                region: 2,
                start_time: 7300,
                end_time: 10800,
                event_id: 13,
            },
        ];

        const forward = findAllCascades(tied, { minLength: 3 });
        const reversed = findAllCascades([...tied].reverse(), { minLength: 3 });
        const shuffled = findAllCascades([tied[2], tied[0], tied[3], tied[1]], {
            minLength: 3,
        });

        const shape = (cascades) =>
            cascades.map((c) => c.events.map((e) => e.event_id).join('>'));

        expect(shape(reversed)).toEqual(shape(forward));
        expect(shape(shuffled)).toEqual(shape(forward));
    });
});
