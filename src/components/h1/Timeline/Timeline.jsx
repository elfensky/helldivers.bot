// 'use client';
import './Timeline.css';
import { timeAgo, timeUntil } from '@/utils/time';

export default function Timeline({ data }) {
    const events = [...data.defend_events, ...data.attack_events];
    events.sort((a, b) => b.start_time - a.start_time);

    return (
        <section
            id="timeline"
            className="flex flex-col gap-4"
            // className="flex flex-col gap-8 sm:max-h-[86vh] sm:overflow-y-auto sm:p-0"
        >
            <h2
                className="text-3xl uppercase"
                style={{ fontFamily: 'Insignia, sans-serif' }}
            >
                Timeline
            </h2>
            <div className="flex flex-col gap-4 sm:overflow-y-auto">
                {events ?
                    <div id="timeline" className="flex flex-col gap-4 overflow-y-auto">
                        {events.map((event) => generateEvent(event))}
                    </div>
                :   null}
            </div>
        </section>
    );
}

function generateEvent(event) {
    let type = null;
    if (event?.region) {
        type = 'Defend';
    } else {
        type = 'Attack';
    }

    const start = timeAgo(event.start_time * 1000);
    const end = timeAgo(event.end_time * 1000);
    // const start = new Date(event.start_time * 1000).toLocaleString('en-GB');
    // const end = new Date(event.end_time * 1000).toLocaleString('en-GB');

    const percent = (event.points / event.points_max) * 100;
    const progress = util_evaluate_progress(event);
    // console.log(event, progress);

    return (
        <article
            id="event"
            key={event.event_id}
            className={`relative flex flex-col gap-2 overflow-hidden rounded-sm p-2 ${type} ${event?.status} ${event?.status === 'active' ? 'active' : ''}`}
        >
            <div className="flex gap-2">
                <img
                    src={`/icons/faction${event?.enemy}.webp`}
                    alt="Logo of Helldivers Bot, which is a cartoon depiction of a spy sattelite"
                    width={20}
                    height={20}
                />
                <h3>{type} Event</h3>
            </div>
            <div className="z-20 flex flex-col gap-2 text-sm">
                <div className="flex justify-between gap-2">
                    <span>Started {start}</span>
                    {end.includes('ago') ?
                        <span>Finished {end}</span>
                    :   <span>Finishes in {end}</span>}
                </div>

                <div>{progress}</div>

                <div className="relative">
                    <progress value={percent} max="100" className="h-5 w-full"></progress>
                    <span className="absolute left-1 text-black">
                        {event.points} / {event.points_max}
                    </span>
                    <span className="absolute right-1 text-black">
                        {percent.toFixed(2)}%
                    </span>
                </div>
            </div>

            <img
                src={`/icons/${type}.webp`}
                alt={`${type} Event Icon`}
                className="absolute -bottom-5 right-0 z-0 h-[80%] opacity-65"
            />
        </article>
    );
}

function util_evaluate_progress(event) {
    // Get the current time as a timestamp
    const currentTime = Math.floor(Date.now() / 1000);

    // Calculate total time in milliseconds
    const totalTime = event.end_time - event.start_time;
    // console.log('totalTime', totalTime);

    // Calculate elapsed time in milliseconds
    const elapsedTime = currentTime - event.start_time;
    // console.log('elapsedTime', elapsedTime);

    // Calculate remaining time in milliseconds
    const remainingTime = event.end_time - currentTime;
    // console.log('remainingTime', remainingTime);

    // Calculate the expected rate of progress (points per millisecond)
    const expectedRate = event.points_max / totalTime;

    // Calculate the current rate of progress (points per millisecond)
    const currentRate = event.points / elapsedTime;

    // Calculate the expected points by now
    const expectedPoints = expectedRate * elapsedTime;

    // Calculate the remaining points
    const remainingPoints = event.points_max - event.points;

    // Calculate the required rate for the remaining time (points per millisecond)
    const requiredRate = remainingPoints / remainingTime;

    // 10% buffer
    const buffer = expectedPoints * 0.1;
    // Determine the progress status
    let status;
    if (event.points > expectedPoints + buffer) {
        status = 'Ahead';
    } else if (event.points < expectedPoints) {
        status = 'Behind';
    } else {
        status = 'On track';
    }

    // Determine if the current rate is sufficient
    // let rateStatus;
    // if (currentRate >= requiredRate) {
    //     rateStatus = 'on track to meet your goal';
    // } else {
    //     rateStatus = 'need to increase your rate to meet your goal';
    // }

    let pointDifference = Math.abs(expectedPoints - event.points);

    const progress = {
        expectedRate: expectedRate.toFixed(6), // Adjust precision as needed
        currentRate: currentRate.toFixed(6),
        expectedPoints: expectedPoints.toFixed(0),
        remainingPoints: remainingPoints.toFixed(0),
        requiredRate: requiredRate.toFixed(6),
        status: status,
        // rateStatus: rateStatus,
    };

    if (event.status === 'active') {
        return `${status} by ${pointDifference.toFixed(0)} points`;
    }
    // if (event.status === 'success') {
    //     const remaining_minutes = 120 - Math.floor(elapsedTime / 60);
    //     const win_text =
    //         remaining_minutes > 1 ?
    //             `${remaining_minutes} minutes`
    //         :   `${remaining_minutes} minute`;

    //     return `Won with ${win_text} to spare.`;
    // }
    // if (event.status === 'failure') {
    //     return `Lost ${pointDifference.toFixed(0)} points`;
    // }
}
