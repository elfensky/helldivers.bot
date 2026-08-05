import { describe, it, expect } from 'vitest';
import { eventForecast, VERDICT_MARGIN } from '@/features/dashboard/eventForecast.mjs';

const NOW = 1_800_000_000;
const H = 3600;

/** 6h event, 2h elapsed. Override points to steer the rate. */
function makeEvent(overrides = {}) {
    return {
        status: 'active',
        start_time: NOW - 2 * H,
        end_time: NOW + 4 * H,
        points: 40_000,
        points_max: 120_000,
        ...overrides,
    };
}

describe('eventForecast', () => {
    it('is on track when the pace so far beats the deadline', () => {
        // 40k in 2h → 20k/h; 80k remaining → 4h ETA vs 4h left → within margin
        const v = eventForecast(makeEvent(), NOW);
        expect(v.mode).toBe('verdict');
        expect(v.etaHours).toBeCloseTo(4, 5);
        expect(v.onTrack).toBe(true);
        expect(v.stalled).toBe(false);
    });

    it('is behind when the ETA overshoots the deadline beyond the margin', () => {
        // 20k in 2h → 10k/h; 100k remaining → 10h ETA vs 4h left
        const v = eventForecast(makeEvent({ points: 20_000 }), NOW);
        expect(v.onTrack).toBe(false);
        expect(v.etaHours).toBeCloseTo(10, 5);
    });

    it('stays on track right up to the margin boundary', () => {
        // Measured VERDICT_MARGIN is 0, so this is the deadline itself; the
        // arithmetic stays written against the constant so re-calibrating the
        // script (see its header) does not silently invalidate the test.
        const remainingH = 4;
        const etaTargetH = remainingH * (1 + VERDICT_MARGIN) - 0.01;
        // rate = points/elapsed = points/2h ; eta = (120k-points)/rate = etaTarget
        // → points = 120k * 2 / (2 + etaTarget)
        const points = Math.round((120_000 * 2) / (2 + etaTargetH));
        const v = eventForecast(makeEvent({ points }), NOW);
        expect(v.onTrack).toBe(true);
    });

    it('reports a stalled event as behind with no ETA', () => {
        const v = eventForecast(makeEvent({ points: 0 }), NOW);
        expect(v).toEqual({
            mode: 'verdict',
            etaHours: null,
            remainingHours: 4,
            onTrack: false,
            stalled: true,
        });
    });

    it('returns the deadline distance alongside the fill ETA', () => {
        // A loss lands on end_time and a win lands on etaHours; the card needs
        // both to say which one it is talking about.
        const v = eventForecast(makeEvent(), NOW);
        expect(v.remainingHours).toBeCloseTo(4, 5);
    });

    it('hides the verdict until the event clears the elapsed-fraction gate', () => {
        // 6h event: the gate sits at 1h30m elapsed.
        const justUnder = makeEvent({
            start_time: NOW - 1.4 * H,
            end_time: NOW + 4.6 * H,
        });
        expect(eventForecast(justUnder, NOW)).toEqual({
            mode: 'hidden',
            reason: 'too-early',
        });
        const justOver = makeEvent({
            start_time: NOW - 1.6 * H,
            end_time: NOW + 4.4 * H,
        });
        expect(eventForecast(justOver, NOW).mode).toBe('verdict');
    });

    it('hides non-active, expired, complete and zero-elapsed events', () => {
        expect(eventForecast(makeEvent({ status: 'success' }), NOW).mode).toBe('hidden');
        expect(eventForecast(makeEvent({ end_time: NOW - 1 }), NOW)).toEqual({
            mode: 'hidden',
            reason: 'expired',
        });
        expect(eventForecast(makeEvent({ points: 120_000 }), NOW)).toEqual({
            mode: 'hidden',
            reason: 'complete',
        });
        expect(eventForecast(makeEvent({ start_time: NOW }), NOW)).toEqual({
            mode: 'hidden',
            reason: 'no-data',
        });
        expect(eventForecast(null, NOW)).toEqual({ mode: 'hidden', reason: 'no-event' });
    });
});
