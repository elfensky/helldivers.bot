import Event from '@/components/h1/Event/Event';
import Wings from '@/components/layout/Wings/Wings';

export default function Active({ data }) {
    const events = [...data.defend_events, ...data.attack_events]
        // .filter((event) => event.status === 'active')
        .sort((a, b) => b.start_time - a.start_time);

    const active = events.filter((event) => event.status === 'active');

    const titleText = `${active} Active Events`.toString();

    if (active === 0) {
        return (
            <section id="current" className="flex flex-col gap-4">
                <Wings>{titleText}</Wings>

                <div className="flex flex-col gap-4">
                    <Event event={events[0]} />
                    <Event event={events[1]} />
                </div>
            </section>
        );
    }

    return (
        <section id="current" className="flex flex-col gap-4">
            <h2>{active.length} Active Events</h2>
            <div className="flex flex-col gap-4 sm:overflow-y-auto">
                <div className="flex flex-col gap-4 overflow-y-auto">
                    {active.map((event) => (
                        <Event key={event.event_id} event={event} />
                    ))}
                </div>
            </div>
        </section>
    );
}
