/**
 * Evaluate event pace vs linear schedule.
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

    const STATUS_LABELS = { ahead: 'Ahead', behind: 'Behind', on_track: 'On track' };

    return {
        status,
        delta,
        deltaPercent,
        currentRate,
        requiredRate,
        label:
            status === 'on_track' ?
                'On track'
            :   `${STATUS_LABELS[status]} by ${delta} points`,
    };
}
