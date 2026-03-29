export const metadata = {
    title: 'Discord | Helldivers Bot',
    description:
        'The Helldivers Bot Discord integration — a bot providing in-game event updates and statistics.',
};

export default function BotPage() {
    return (
        <div className="gutters flex min-h-[50vh] flex-col items-center justify-center gap-4">
            <script
                type="application/ld+json"
                // Safe: schema is a hardcoded constant, not user input
                dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
            />
            <h1 className="text-3xl font-[family-name:var(--font-display)] text-[var(--color-text)]">
                Discord Bot
            </h1>
            <p className="text-[var(--color-text-muted)]">Coming Soon</p>
        </div>
    );
}

const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Helldivers Bot',
    url: 'https://helldivers.bot',
    description:
        'A website dedicated to the Helldivers video game, featuring in-game Stats, an API and a Discord bot.',
    mainEntity: [
        {
            '@type': 'VideoGame',
            name: 'Helldivers',
            url: 'https://helldivers.bot',
            gamePlatform: 'PC, PlayStation',
            applicationCategory: 'Action, Shooter',
            description:
                'Helldivers is a top-down cooperative shooter game where players fight to protect Super Earth from Xeno threats.',
            publisher: {
                '@type': 'Organization',
                name: 'Arrowhead Game Studios',
                url: 'https://arrowheadgamestudios.com',
            },
        },
        {
            '@type': ['VideoGame', 'WebApplication'],
            name: 'Helldivers 1 Bot',
            applicationCategory: 'Wiki, Multimedia, News, Info, Discord Bot, Chat bot',
            // applicationCategory: 'GameApplication',
            operatingSystem: 'Discord',
            url: 'https://helldivers.bot/discord',
            description:
                'A Discord bot that provides updates about in-game events and statistics.',
            softwareVersion: '1.0.0',
            creator: {
                '@type': 'Person',
                name: 'Andrei Lavrenov',
                url: 'https://lavrenov.io',
            },
            offers: {
                '@type': 'Offer',
                price: '0.00',
                priceCurrency: 'EUR',
                availability: 'http://schema.org/InStock',
                url: 'https://helldivers.bot/discord',
            },
            // aggregateRating: {
            //     '@type': 'AggregateRating',
            //     ratingValue: '0.8',
            //     bestRating: '1',
            //     ratingCount: '1',
            // },
        },
        {
            '@type': 'WebAPI',
            name: 'Helldivers 1 API',
            url: 'https://helldivers.bot/api',
            description:
                'An API providing access to Helldivers campaign status and statistics. Written in JavaScript and powered by Next.js.',
            documentation: 'https://helldivers.bot/docs',
            provider: {
                '@type': 'Person',
                name: 'Andrei Lavrenov',
                url: 'https://lavrenov.io',
            },
        },
    ],
};
