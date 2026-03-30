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
            {/* <div className="flex flex-col gap-4 sm:overflow-y-scroll"> */}
            {events ?
                <div className="flex h-[calc(100vh-80px-24px-12px)] flex-col gap-4 sm:overflow-y-scroll">
                    {events.map((event) => (
                        <Event key={event.event_id} event={event} />
                    ))}
                </div>
            :   null}
            {/* </div> */}
        </section>
    );
}
