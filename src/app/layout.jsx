import './layout.css';
//nextjs
import Script from 'next/script';
//components
import Header from '@/components/layout/Header/Header';
import Footer from '@/components/layout/Footer/Footer';

// function getMetaURL() {
//     switch (process.env.NODE_ENV) {
//         case 'development':
//             return new URL('http://localhost:3000');
//         case 'staging':
//             return new URL('https://staging.helldivers.bot');
//         case 'production':
//             return new URL('https://helldivers.bot');
//         default:
//             throw new Error('Unknown NODE_ENV');
//     }
// }

export const metadata = {
    metadataBase: 'https://helldivers.bot',
    title: 'Home | Helldivers Bot - A web application dedicated to the original Helldivers video game, featuring in-game Stats, an API and a Discord bot.',
    description:
        'Display in-game events and current campaign progress, alongside server as an api',
};

export default function RootLayout({ children }) {
    const isProduction = process.env.NODE_ENV === 'production';

    return (
        <html dir="ltr" lang="en">
            {/* <head>
                <script
                    crossOrigin="anonymous"
                    src="//unpkg.com/react-scan/dist/auto.global.js"
                />
            </head> */}
            <body
                id="body "
                className="min-w-screen flex min-h-screen flex-col antialiased"
            >
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
                />

                <Header />
                <main className="flex min-h-screen w-screen flex-col pt-[50px] sm:pt-[80px]">
                    {children}
                </main>
                <Footer />

                {isProduction ?
                    <Script
                        // src="https://umami.lavrenov.io/script.js"
                        src="/stats.js"
                        data-website-id="9a916711-2868-43d2-9932-964fc9528824"
                        strategy="afterInteractive"
                        data-host-url="https://umami.lavrenov.io"
                    />
                :   null}
            </body>
        </html>
    );
}

const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite', // '@type': ['WebSite', 'WebApplication', 'VideoGame']
    applicationCategory: ['GameUtility', 'GameInformation', 'Entertainment'],
    url: 'https://helldivers.bot',

    name: 'Helldivers Bot',
    // author: 'Andrei Lavrenov',
    author: {
        '@type': 'Person',
        name: 'Andrei Lavrenov',
        url: 'https://lavrenov.io',
    },
    description:
        'A website that provides dedicated real-time in-game status updates for the original Helldivers videogame.',

    // only possible for specific @types
    // aggregateRating: {
    //     '@type': 'AggregateRating',
    //     ratingValue: 5.0,
    //     ratingCount: 3,
    // },

    offers: {
        '@type': 'Offer',
        price: 0.0,
        priceCurrency: 'EUR',
        // availability: 'http://schema.org/InStock',
        // url: 'https://helldivers.bot/campaign',
    },

    // image: "https://helldivers.bot/url-to-dynamically-generated-map-status"

    // mainEntity: [
    //     {
    //         '@type': 'VideoGame',
    //         name: 'Helldivers',
    //         url: 'https://helldivers.bot',
    //         gamePlatform: 'PC, PlayStation',
    //         applicationCategory: 'Action, Shooter',
    //         description:
    //             'Helldivers is a top-down cooperative shooter game where players fight to protect Super Earth from Xeno threats.',
    //         publisher: {
    //             '@type': 'Organization',
    //             name: 'Arrowhead Game Studios',
    //             url: 'https://arrowheadgamestudios.com',
    //         },
    //     },
    //     {
    //         '@type': 'SoftwareApplication',
    //         name: 'Helldivers 1 Bot',
    //         applicationCategory: 'Discord Bot, Chat bot',
    //         operatingSystem: 'Discord',
    //         url: 'https://helldivers.bot/discord',
    //         description:
    //             'A Discord bot that provides updates about in-game events and statistics.',
    //         softwareVersion: '1.0.0',
    //         creator: {
    //             '@type': 'Person',
    //             name: 'Andrei Lavrenov',
    //             url: 'https://lavrenov.io',
    //         },
    //         offers: {
    //             '@type': 'Offer',
    //             price: '0.00',
    //             priceCurrency: 'EUR',
    //             availability: 'http://schema.org/InStock',
    //             url: 'https://helldivers.bot/discord',
    //         },
    //         // aggregateRating: {
    //         //     '@type': 'AggregateRating',
    //         //     ratingValue: '0.8',
    //         //     bestRating: '1',
    //         //     ratingCount: '1',
    //         // },
    //     },
    //     {
    //         '@type': 'WebAPI',
    //         name: 'Helldivers 1 API',
    //         url: 'https://helldivers.bot/api',
    //         description:
    //             'An API providing access to Helldivers campaign status and statistics. Written in JavaScript and powered by Next.js.',
    //         documentation: 'https://helldivers.bot/docs',
    //         provider: {
    //             '@type': 'Person',
    //             name: 'Andrei Lavrenov',
    //             url: 'https://lavrenov.io',
    //         },
    //     },
    // ],
};

// const toAddToJsonLd = {
//     potentialAction: [
//         {
//             '@type': 'ViewAction',
//             target: 'https://helldivers.bot/view/{content_id}',
//             'query-input': 'required name=content_id',
//         },
//         {
//             '@type': 'SearchAction',
//             target: 'https://helldivers.bot/search?q={search_term_string}',
//             'query-input': 'required name=search_term_string',
//         },
//         {
//             '@type': 'RegisterAction',
//             target: 'https://helldivers.bot/register',
//         },
//         {
//             '@type': 'LikeAction',
//             target: 'https://helldivers.bot/like/{content_id}',
//             'query-input': 'required name=content_id',
//         },
//         {
//             '@type': 'DislikeAction',
//             target: 'https://helldivers.bot/dislike/{content_id}',
//             'query-input': 'required name=content_id',
//         },
//         {
//             '@type': 'ShareAction',
//             target: 'https://helldivers.bot/share/{content_id}',
//             'query-input': 'required name=content_id',
//         },
//     ],
// };
