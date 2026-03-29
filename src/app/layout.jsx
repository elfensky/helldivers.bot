import './layout.css';
//nextjs
import Script from 'next/script';
import { Space_Grotesk, Inter } from 'next/font/google';
//components
import Header from '@/components/layout/Header/Header';
import Footer from '@/components/layout/Footer/Footer';
import BottomNav from '@/components/layout/BottomNav/BottomNav';

const spaceGrotesk = Space_Grotesk({
    subsets: ['latin'],
    variable: '--font-space-grotesk',
    display: 'swap',
});

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-inter',
    display: 'swap',
});

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
    metadataBase: new URL('https://helldivers.bot'),
    title: 'Helldivers Bot - Live war dashboard for the original Helldivers',
    description:
        'Live Helldivers 1 war dashboard showing campaign progress, faction stats, active events, and an interactive galaxy map.',
    openGraph: {
        type: 'website',
        url: 'https://helldivers.bot',
    },
    twitter: {
        card: 'summary_large_image',
    },
};

export default function RootLayout({ children }) {
    const isProduction = process.env.NODE_ENV === 'production';

    return (
        <html
            dir="ltr"
            lang="en"
            className={`${spaceGrotesk.variable} ${inter.variable}`}
        >
            {/* <head>
                <script
                    crossOrigin="anonymous"
                    src="//unpkg.com/react-scan/dist/auto.global.js"
                />
            </head> */}
            <body id="body" className="flex min-h-screen min-w-full flex-col antialiased">
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
                />

                <a
                    href="#main"
                    className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-[var(--color-primary)] focus:px-4 focus:py-2 focus:text-[var(--color-on-primary)]"
                >
                    Skip to content
                </a>
                <div
                    className="fixed inset-0 z-[999] flex items-center justify-center bg-[var(--color-surface-0)] p-4 text-center text-sm text-[var(--color-text-muted)] min-[200px]:hidden"
                    role="alert"
                >
                    <p className="m-0">Please use a larger screen to view this site.</p>
                </div>
                <Header />
                <main
                    id="main"
                    className="flex min-h-screen w-full flex-col pb-[48px] md:pb-0"
                >
                    {children}
                </main>
                <Footer />
                <BottomNav />

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
