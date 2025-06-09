import './Timeline.css';
import { tryCatch } from '@/utils/tryCatch.mjs';
import { getCampaign } from '@/db/queries/getCampaign';

export default async function Timeline() {
    const query = await tryCatch(getCampaign());
    const data = query?.data;

    const events = [...data.defend_events, ...data.attack_events];
    events.sort((a, b) => b.start_time - a.start_time);

    return (
        <div className="flex max-h-[80vh] flex-col gap-4 overflow-y-auto">
            {events.map((event) => generateEvent(event))}
        </div>
    );
}

function generateEvent(event) {
    let type = null;
    if (event?.region) {
        type = 'Defend';
    } else {
        type = 'Attack';
    }
    const start = new Date(event.start_time * 1000).toLocaleString();
    const end = new Date(event.end_time * 1000).toLocaleString();

    return (
        <article className={`flex flex-col gap-2 rounded-sm p-2 ${type} ${event.status}`}>
            <h3>{type} Event</h3>
            Started at {start}
            <br />
            Finished at {end}
            <br />
            {event.status}
        </article>
    );
}
