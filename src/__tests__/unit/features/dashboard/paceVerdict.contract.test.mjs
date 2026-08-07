/**
 * Contract: the two verdicts co-rendered on an event card can never disagree.
 *
 * `evaluateProgress` (PaceIndicator's ▲/▼) says 'behind' when
 * `points < points_max · elapsed/duration` (linear schedule, no lower buffer).
 * `eventForecast` (the Behind/On track wording) says `!onTrack` when
 * `remaining/(points/elapsed) > remainingTime`. At VERDICT_MARGIN = 0 these
 * are the same inequality:
 *
 *     (M − p)·e/p > T − e  ⟺  M·e > p·T  ⟺  p < M·e/T
 *
 * so `pace.status === 'behind'` ⟺ `!forecast.onTrack` for every moment where
 * both render. The 10% buffer only splits ahead/on_track INSIDE the on-track
 * half. This sweep pins the equivalence; if either module's predicate moves,
 * this file is the tripwire.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eventForecast, VERDICT_MARGIN } from '@/features/dashboard/eventForecast.mjs';
import { evaluateProgress } from '@/features/stats/evaluateProgress.mjs';
import { EVENT_STATUS } from '@/shared/enums/events.mjs';

const START = 1_750_000_000; // whole seconds — evaluateProgress floors Date.now()

/** @param {number} duration @param {number} elapsed @param {number} points */
function eventAt(duration, elapsed, points) {
    return {
        event: {
            status: EVENT_STATUS.ACTIVE,
            start_time: START,
            end_time: START + duration,
            points,
            points_max: 1_000_000,
        },
        now: START + elapsed,
    };
}

describe('pace/verdict contract', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('assumes margin 0 (the equivalence only holds there)', () => {
        expect(VERDICT_MARGIN).toBe(0);
    });

    const DURATIONS = [150 * 60, 48 * 3600]; // defend timer, assault timeout

    it("'behind' ⟺ !onTrack across the grid where both render", () => {
        let checked = 0;
        for (const duration of DURATIONS) {
            for (let ePct = 25; ePct <= 99; ePct += 2) {
                const elapsed = Math.round((duration * ePct) / 100);
                for (let pPct = 0; pPct <= 99; pPct += 3) {
                    const points = Math.round(1_000_000 * (pPct / 100));
                    const { event, now } = eventAt(duration, elapsed, points);
                    vi.setSystemTime(now * 1000);

                    const forecast = eventForecast(event, now);
                    const pace = evaluateProgress(event);
                    if (forecast.mode !== 'verdict' || pace === null) continue;

                    expect(pace.status === 'behind').toBe(!forecast.onTrack);
                    checked++;
                }
            }
        }
        expect(checked).toBeGreaterThan(2000); // the sweep actually ran
    });

    it('stalled events (0 points) read behind on both', () => {
        const { event, now } = eventAt(48 * 3600, 24 * 3600, 0);
        vi.setSystemTime(now * 1000);
        const forecast = eventForecast(event, now);
        expect(forecast).toMatchObject({
            mode: 'verdict',
            stalled: true,
            onTrack: false,
        });
        expect(evaluateProgress(event)?.status).toBe('behind');
    });

    it('below the 25% gate the verdict hides but pace still renders (designed fallback)', () => {
        const { event, now } = eventAt(48 * 3600, 3600, 10_000); // ~2% elapsed
        vi.setSystemTime(now * 1000);
        expect(eventForecast(event, now)).toEqual({
            mode: 'hidden',
            reason: 'too-early',
        });
        expect(evaluateProgress(event)).not.toBeNull();
    });
});
