import './war.css';
//db
import { tryCatch } from '@/utils/tryCatch.mjs';
import { queryGetRebroadcastStatus } from '@/db/queries/rebroadcast';
import { getCampaign } from '@/db/queries/getCampaign';
//components
import Galaxy from '@/components/h1/Galaxy/Galaxy';
import War from '@/components/h1/War/War';
import Timeline from '@/components/h1/Timeline/Timeline';
//
import Script from 'next/script';

export const metadata = {
    metadataBase: 'https://helldivers.bot/war',
    title: 'War | Helldivers Bot - status of the current in-game campaign',
    description:
        'Live dashboard showing the progresso of the in-game Helldivers campaign, with player stats, map of the regions and a timeline of events.',
};

export default async function Campaign() {
    const rebroacast_status = await tryCatch(queryGetRebroadcastStatus());
    // const query = await tryCatch(getCampaign());
    const { data: query, error: queryError } = await tryCatch(getCampaign());

    if (queryError !== null) {
        return (
            <div className="flex min-h-full w-full flex-col-reverse justify-center sm:flex-row">
                Error: {queryError.message}
            </div>
        );
    }

    const data = query;

    if (!query) {
        return (
            <div className="flex min-h-full w-full flex-col-reverse justify-center sm:flex-row">
                Loading...
            </div>
        );
    }

    return (
        <div className="gutters z-10 flex w-screen flex-col-reverse justify-between gap-4 overflow-hidden xl:fixed xl:top-[80px] xl:max-h-[calc(100vh-80px-16px)] xl:flex-row xl:flex-wrap">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
            />
            {/* USE SUSPENSE HERE */}
            <War data={data} />
            <Timeline data={data} />
            <Galaxy data={data} />
            {/* <Script src="/scripts/reload.js" /> */}
        </div>
    );
}

// https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
const schema = [
    {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        applicationCategory: ['GameUtility', 'GameInformation', 'Entertainment'],
        url: 'https://helldivers.bot/war',

        name: 'War | Helldivers Bot',
        author: 'Andrei Lavrenov',
        description:
            'Live dashboard showing the progresso of the in-game Helldivers campaign, with player stats, map of the regions and a timeline of events.',

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
    },
    {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            {
                '@type': 'ListItem',
                position: 1,
                name: 'War',
                item: 'https://helldivers.bot/war',
            },
        ],
    },
];
