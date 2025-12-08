import Image from 'next/image';
import humanizeDuration from 'humanize-duration';
// https://developers.google.com/search/docs/appearance/structured-data/event
import map from '@/enums/map';
import factions from '@/enums/factions';

export default function Event({ event }) {
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
        <article
            id={`event-${event.event_id}`}
            key={event.event_id}
            style={{ minHeight: '133px' }}
            className={`event relative flex flex-col gap-2 overflow-hidden rounded-sm p-2 ${event.type} ${event.status}`}
        >
            <div className="flex gap-2">
                <Image
                    src={`/icons/faction${event?.enemy}.webp`}
                    alt="Logo of Helldivers Bot, which is a cartoon depiction of a spy sattelite"
                    width={128}
                    height={128}
                    className="max-h-6 max-w-6"
                    priority={true}
                />
                <h3>
                    {event.status === 'success' ? 'Won ' : null}
                    {event.status === 'fail' ? 'Failed ' : null}
                    {event.status === 'active' ? 'Active ' : null}
                    {event.type} Event
                </h3>
            </div>
            <div className="z-20 flex flex-col text-sm">
                <p className="flex flex-col justify-between gap-2">
                    {remaining > 0 ?
                        <span>Due in {human_remaining}</span>
                    :   <span>Finished {human_remaining} ago</span>}
                </p>

                <p>{progress}</p>

                <div className="relative">
                    {/* <meter value={percent} max="100" className="w-full" title="event progress percentage"></meter> */}
                    <progress value={percent} max="100" className="h-5 w-full"></progress>
                    <span className="absolute left-1 text-black">
                        {event.points} / {event.points_max}
                    </span>
                    <span className="absolute right-1 text-black">
                        {percent.toFixed(2)}%
                    </span>
                </div>
            </div>

            <Image
                src={`/icons/${event.type}.webp`}
                alt={`${event.type} Event Icon`}
                className="absolute -bottom-5 right-0 z-0 h-[80%] w-auto opacity-65"
                width={256}
                height={256}
                priority={true}
            />
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify(schema(event, event.type)),
                }}
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
        if (event.region === 0) {
            event.enemy = 3;
        }

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
