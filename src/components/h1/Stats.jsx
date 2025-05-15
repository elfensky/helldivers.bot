export default function Stats() {
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: 'Epic Battle Event',
        startDate: '2023-10-15T18:00:00Z',
        endDate: '2023-10-15T20:00:00Z',
        location: {
            '@type': 'VirtualLocation',
            url: 'https://www.examplegame.com/events/epic-battle',
        },
        eventStatus: 'https://schema.org/EventScheduled',
        description: 'Join the epic battle event and compete with players worldwide.',
        additionalType: 'https://example.com/GameEvent',
        additionalProperty: [
            {
                '@type': 'PropertyValue',
                name: 'Player Count',
                value: 1500,
            },
            {
                '@type': 'PropertyValue',
                name: 'Progression',
                value: '50%',
            },
            {
                '@type': 'PropertyValue',
                name: 'Active',
                value: true,
            },
        ],
    };
}
