import { formatNumber } from '@/shared/utils/format/formatNumber.mjs';

/**
 * Evaluate event pace vs a LINEAR expected schedule.
 *
 * Assumes a constant rate of progress from start to end: `expectedRate =
 * points_max / (end_time - start_time)`. Real player activity rarely follows
 * a linear curve — expect optimistic reads during early-season player surges
 * (actual rate > linear) and pessimistic reads late in a season as engagement
 * tapers (actual rate < linear). This is intentional; treat the output as
 * "how we're doing against a simple yardstick," not "will we make it."
 *
 * A ±10% buffer around the linear target keeps small fluctuations from
 * flipping the label between 'ahead' and 'on_track'. 'behind' has no buffer
 * — any shortfall is reported.
 *
 * Returns null if the event is not active or the time window is degenerate.
 *
 * @param {{ start_time: number, end_time: number, points: number, points_max: number, status: string }} event
 * @returns {{ status: 'ahead'|'behind'|'on_track', delta: number, deltaPercent: number, currentRate: number, requiredRate: number, label: string } | null}
 */
export function evaluateProgress(event) {
    if (event.status !== 'active') return null;

    const currentTime = Math.floor(Date.now() / 1000);
    const totalTime = event.end_time - event.start_time;
    const elapsedTime = currentTime - event.start_time;
    const remainingTime = event.end_time - currentTime;

    // Guard against division by zero at event boundaries
    if (totalTime <= 0 || elapsedTime <= 0) return null;

    const expectedRate = event.points_max / totalTime;
    const currentRate = event.points / elapsedTime;
    const expectedPoints = expectedRate * elapsedTime;
    const remainingPoints = event.points_max - event.points;
    const requiredRate = remainingTime > 0 ? remainingPoints / remainingTime : Infinity;

    const buffer = expectedPoints * 0.1;
    let status;
    if (event.points > expectedPoints + buffer) {
        status = 'ahead';
    } else if (event.points < expectedPoints) {
        status = 'behind';
    } else {
        status = 'on_track';
    }

    const delta = Math.abs(Math.round(expectedPoints - event.points));
    const deltaPercent =
        expectedPoints > 0 ?
            Math.round(((event.points - expectedPoints) / expectedPoints) * 100)
        :   0;

    return {
        status,
        delta,
        deltaPercent,
        currentRate,
        requiredRate,
        label: status === 'on_track' ? 'On track' : `${formatNumber(delta)} ${status}`,
    };
}
