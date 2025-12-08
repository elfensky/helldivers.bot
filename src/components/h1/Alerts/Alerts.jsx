import './Alerts.css';

import Image from 'next/image';
import humanizeDuration from 'humanize-duration';
// https://developers.google.com/search/docs/appearance/structured-data/event
import map from '@/enums/map';
import factions from '@/enums/factions';

export default function Alerts({ data }) {
    const attackEvents = (data?.attack_events || []).map((event) => ({
        ...event,
        type: 'attack',
    }));

    const defendEvents = (data?.defend_events || []).map((event) => ({
        ...event,
        type: 'defend',
    }));

    const active = [...attackEvents, ...defendEvents]
        .filter((event) => event.status === 'active')
        .sort((a, b) => b.end_time - a.end_time);

    console.log(active);

    return (
        <ul className="flex flex-row gap-10">
            {active.map((event) => (
                <Alert key={event.event_id} event={event} />
            ))}
        </ul>
    );
}

function Alert({ event }) {
    const remaining = new Date(event.end_time * 1000) - new Date();
    const abs_remaining = Math.abs(remaining);
    let human_remaining = null;

    if (abs_remaining < 3600000) {
        human_remaining = humanizeDuration(abs_remaining, {
            units: ['m', 's'],
            maxDecimalPoints: 0,
        });
    } else if (abs_remaining < 86400000) {
        human_remaining = humanizeDuration(abs_remaining, {
            units: ['h', 'm'],
            maxDecimalPoints: 0,
        });
    } else {
        human_remaining = humanizeDuration(abs_remaining, {
            units: ['d', 'h'],
            maxDecimalPoints: 0,
        });
    }

    const percent = (event.points / event.points_max) * 100;
    const progress = util_evaluate_progress(event);

    return (
        <li className="flex w-[33vw] min-w-[300px] rounded-lg first:ml-4 last:mr-4 sm:min-w-[400px] first:sm:ml-12 last:sm:mr-12 first:lg:ml-24 last:lg:mr-24">
            <article className="flex w-full flex-row gap-4 px-4 py-1">
                <div className="flex flex-col justify-around">
                    <Image
                        src={`/icons/faction${event?.enemy}.webp`}
                        alt="Logo of Helldivers Bot, which is a cartoon depiction of a spy sattelite"
                        className="max-h-6 max-w-6"
                        width={128}
                        height={128}
                        priority={true}
                    />

                    <Image
                        src={`/icons/${event.type}.webp`}
                        alt={`${event.type} Event Icon`}
                        className="max-h-6 max-w-6"
                        width={256}
                        height={256}
                        priority={true}
                    />
                </div>

                <div className="flex flex-col justify-around">
                    <h3>{event.type} Event</h3>
                    <p>{progress}</p>
                </div>

                <div className="flex flex-grow flex-col justify-around">
                    <span>Due in {human_remaining}</span>
                    <div className="relative">
                        {/* <meter value={percent} max="100" className="w-full" title="event progress percentage"></meter> */}
                        <progress
                            value={percent}
                            max="100"
                            className="h-5 w-full"
                        ></progress>
                        <span className="absolute left-1 text-black">
                            {event.points} / {event.points_max}
                        </span>
                        <span className="absolute right-1 text-black">
                            {percent.toFixed(2)}%
                        </span>
                    </div>
                </div>
            </article>
        </li>
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
    //     return `tbd`;
    // }
    // if (event.status === 'fail') {
    //     return `Lost ${pointDifference.toFixed(0)} points`;
    // }

    // if (event.status === 'success') {
    //     const remaining_minutes = Math.abs(120 - Math.floor(elapsedTime / 60));
    //     const win_text =
    //         remaining_minutes > 1 ?
    //             `${remaining_minutes} minutes`
    //             : `${remaining_minutes} minute`;

    //     return `Won with ${win_text} to spare.`;
    // }
    // if (event.status === 'failure') {
    //     return `Lost ${pointDifference.toFixed(0)} points`;
    // }
}

function schema(event, type) {
    if (type === 'attack') {
        const capital = map[event.enemy][11].capital;
        return {
            '@context': 'https://schema.org',
            '@type': 'Event',
            name: `Attacking ${capital}`,
            image: ['https://helldivers.bot/icons/attack.webp'],
        };
    }
    if (type === 'defend') {
        // console.log(map[event.region][]);
        const capital = map[event.enemy][event.region].capital;
        const region = map[event.enemy][event.region].region;
        const faction = factions[event.enemy].name;

        return {
            '@context': 'https://schema.org',
            '@type': 'Event',
            name: `Defend ${capital}`,
            description: `Cowardly ${faction} has attacked the innocent city of ${capital} in the ${region}. Get together and defend against this xeno threat!`,
            startDate: new Date(event.start_time * 1000),
            endDate: new Date(event.end_time * 1000),
            image: ['https://helldivers.bot/icons/defend.webp'],
            organizer: {
                '@type': 'Organization',
                name: `${faction}`,
                url: `${factions[[event.enemy]].url}`,
            },
            offers: {
                '@type': 'Offer',
                url: 'https://helldivers.bot/campaign',
                price: 0,
                priceCurrency: 'EUR',
                availability: 'https://schema.org/InStock',
                validFrom: new Date(event.start_time * 1000),
            },
        };
    }
}
