import './Alerts.css';

import Image from 'next/image';
import humanizeDuration from 'humanize-duration';
import { evaluateProgress } from '@/utils/evaluateProgress';

export default function Alerts({ data }) {
    const active = (data?.events || [])
        .filter((event) => event.status === 'active')
        .sort((a, b) => b.end_time - a.end_time);

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
    const progress = evaluateProgress(event);

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
