import './war.css';
import { redirect } from 'next/navigation';
//db
import { tryCatch } from '@/utils/tryCatch.mjs';
import { getCampaign } from '@/db/queries/getCampaign';
import { fetchAndSeedSeason } from '@/db/queries/fetchAndSeedSeason';
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

    // Get the active season to derive the selector range
    const { data: activeCampaign, error: activeError } = await tryCatch(getCampaign());

    if (activeError !== null || !activeCampaign) {
        console.error('getCampaign (active) failed:', activeError);
        return (
            <div className="flex min-h-full w-full flex-col justify-center">
                Unable to load campaign data. Please try again later.
            </div>
        );
    }

    const activeSeason = activeCampaign.season;
    // All past seasons in descending order
    const seasons = Array.from({ length: activeSeason - 1 }, (_, i) => activeSeason - 1 - i);

    // Default to the most recent completed season if no season param
    const resolvedSeason = seasonParam ?? seasons[0] ?? null;

    // Populate ?season in URL so the link is always shareable
    if (seasonParam === null && resolvedSeason !== null) {
        redirect(`/war?season=${resolvedSeason}`);
    }

    // Fetch requested season from DB
    let { data, error } = await tryCatch(getCampaign(resolvedSeason));

    // If season not in DB, fetch from official API and seed it
    if (!error && !data && resolvedSeason !== null) {
        const { error: seedError } = await tryCatch(fetchAndSeedSeason(resolvedSeason));
        if (seedError) {
            console.error('fetchAndSeedSeason failed:', seedError);
            return (
                <div className="flex min-h-full w-full flex-col justify-center">
                    Unable to fetch season {resolvedSeason} from the official API.
                </div>
            );
        }
        // Re-query after seeding
        ({ data, error } = await tryCatch(getCampaign(resolvedSeason)));
    }

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
                No data available for season {resolvedSeason}.
            </div>
        );
    }

    const currentSeason = data.season;
    const mapState = computeMapState(data.live, []);

    return (
        <div className="gutters flex flex-col gap-4 pb-4">
            <JsonLd />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-4">
                <SeasonSelector seasons={seasons} currentSeason={currentSeason} />
                <WarOutcome data={data} />
            </div>
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
