import './war.css';
//db
import { tryCatch } from '@/utils/tryCatch.mjs';
import { getCampaign } from '@/db/queries/getCampaign';
import { getSeasonList } from '@/db/queries/getSeasonList';
//utils
import { computeMapState } from '@/utils/computeMapState.mjs';
//components
import { WarOutcome } from '@/components/h1/War/War';
import WarTimeline from '@/components/h1/WarTimeline/WarTimeline';
import SeasonSelector from '@/components/h1/SeasonSelector/SeasonSelector';

// Force dynamic rendering - skip build-time evaluation (requires database)
export const dynamic = 'force-dynamic';

export const metadata = {
    metadataBase: 'https://helldivers.bot/war',
    title: 'War History | Helldivers Bot - past campaign data',
    description:
        'Browse historical Helldivers 1 war data. View past seasons, campaign outcomes, and event logs.',
};

export default async function WarHistoryPage({ searchParams }) {
    const params = await searchParams;
    const seasonParam = params?.season ? parseInt(params.season, 10) : null;

    const { data: allSeasons, error: seasonsError } = await tryCatch(getSeasonList());

    if (seasonsError !== null) {
        console.error('getSeasonList failed:', seasonsError);
        return (
            <div className="flex min-h-full w-full flex-col justify-center">
                Unable to load season list. Please try again later.
            </div>
        );
    }

    // Exclude the current (active) season — it's shown on the homepage
    const activeSeason = allSeasons?.[0]?.season;
    const seasons = allSeasons?.filter((s) => s.season !== activeSeason) || [];

    // Default to the most recent completed season if no season param
    const resolvedSeason = seasonParam ?? seasons[0]?.season ?? null;

    const { data, error } = await tryCatch(getCampaign(resolvedSeason));

    if (error !== null) {
        console.error('getCampaign failed:', error);
        return (
            <div className="flex min-h-full w-full flex-col justify-center">
                Unable to load campaign data. Please try again later.
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex min-h-full w-full flex-col justify-center">
                No data available.
            </div>
        );
    }

    const currentSeason = data.season;
    const mapState = computeMapState(data.live, []);

    return (
        <div className="gutters z-10 flex max-w-full flex-col gap-4 overflow-hidden">
            <JsonLd />

            <SeasonSelector seasons={seasons} currentSeason={currentSeason} />

            <WarOutcome data={data} />
            <WarTimeline data={data} defaultMapState={mapState} />
        </div>
    );
}

function JsonLd() {
    // Static JSON-LD structured data for SEO — no user input, safe to inline
    const structuredData = [
        {
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            applicationCategory: ['GameUtility', 'GameInformation', 'Entertainment'],
            url: 'https://helldivers.bot/war',
            name: 'War History | Helldivers Bot',
            author: 'Andrei Lavrenov',
            description:
                'Browse historical Helldivers 1 war data. View past seasons, campaign outcomes, and event logs.',
            offers: {
                '@type': 'Offer',
                price: 0.0,
                priceCurrency: 'EUR',
            },
        },
        {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
                {
                    '@type': 'ListItem',
                    position: 1,
                    name: 'War History',
                    item: 'https://helldivers.bot/war',
                },
            ],
        },
    ];

    return (
        <script
            type="application/ld+json"
            // eslint-disable-next-line react/no-danger -- static structured data, no user input
            dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
    );
}
