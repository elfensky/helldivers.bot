import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

export const metadata = {
    title: 'Home | Helldivers Bot',
    description:
        'Display in-game events and current campaign progress, alongside server as an api',
};

export default function RootLayout({ children }) {
    return (
        <html lang="en" className="bg-blue-950">
            <body
                className={`${geistSans.variable} ${geistMono.variable} min-w-screen flex min-h-screen flex-col antialiased`}
            >
                <Header />
                <main className="flex-grow">{children}</main>
                <Footer />
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
                />
            </body>
        </html>
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
            '@type': 'SoftwareApplication',
            name: 'Helldivers 1 Bot',
            applicationCategory: 'Discord Bot, Chat bot',
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
            aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: '0.8',
                bestRating: '1',
                ratingCount: '1',
            },
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
