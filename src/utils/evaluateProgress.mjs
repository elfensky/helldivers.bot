export function evaluateProgress(event) {
    const currentTime = Math.floor(Date.now() / 1000);

    const totalTime = event.end_time - event.start_time;
    const elapsedTime = currentTime - event.start_time;
    const remainingTime = event.end_time - currentTime;

    const expectedRate = event.points_max / totalTime;
    const currentRate = event.points / elapsedTime;
    const expectedPoints = expectedRate * elapsedTime;
    const remainingPoints = event.points_max - event.points;
    const requiredRate = remainingPoints / remainingTime;

    // 10% buffer
    const buffer = expectedPoints * 0.1;
    let status;
    if (event.points > expectedPoints + buffer) {
        status = 'Ahead';
    } else if (event.points < expectedPoints) {
        status = 'Behind';
    } else {
        status = 'On track';
    }

    const pointDifference = Math.abs(expectedPoints - event.points);

    if (event.status === 'active') {
        return `${status} by ${pointDifference.toFixed(0)} points`;
    }

    return null;
}
