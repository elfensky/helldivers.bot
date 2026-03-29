// 'use client';
import './Timeline.css';
//
import Event from '@/components/h1/Event/Event';

export default function Timeline({ data }) {
    const events = (data?.events || []).sort((a, b) => b.start_time - a.start_time);

    if (events.length === 0) {
        return null;
    }

    return (
        <section id="timeline" className="flex flex-col gap-4">
            <h2>Timeline</h2>
            {events ?
                <ul className="flex h-[calc(100vh-80px-24px-12px)] list-none flex-col gap-4 p-0 sm:overflow-y-scroll">
                    {events.map((event) => (
                        <li key={event.event_id}>
                            <Event event={event} />
                        </li>
                    ))}
                </ul>
            :   null}
        </section>
    );
}
