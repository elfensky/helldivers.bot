//db
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { getCampaign } from '@/db/queries/getCampaign';
import { fetchAndSeedSeason } from '@/db/queries/fetchAndSeedSeason';
//components
import JsonLd from '@/shared/components/JsonLd';
import ArchivesClient from '@/features/archives/ArchivesClient';

// Force dynamic rendering - skip build-time evaluation (requires database)
export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Archives | Helldivers Bot — campaign records approved by High Command',
    description:
        'Browse the official Super Earth archives. All campaign records have been verified and approved by High Command. Any resemblance to defeat is purely clerical error.',
    alternates: { canonical: '/archives' },
    openGraph: { url: '/archives' },
};

export default async function WarHistoryPage({ searchParams }) {
    const params = await searchParams;
    const seasonParam = params?.season ? parseInt(params.season, 10) : null;

    // Get the active season to derive the selector range
    const { data: activeCampaign, error: activeError } = await tryCatch(getCampaign());

    if (activeError !== null || !activeCampaign) {
        console.error('getCampaign (active) failed:', activeError);
        return (
            <div className="gutters flex min-h-full w-full flex-col items-center justify-center py-12">
                Unable to load campaign data. Please try again later.
            </div>
        );
    }

    const activeSeason = activeCampaign.season;
    // All past seasons in descending order
    const seasons = Array.from(
        { length: activeSeason - 1 },
        (_, i) => activeSeason - 1 - i,
    );

    // Default to the most recent completed season if no season param
    const resolvedSeason = seasonParam ?? seasons[0] ?? null;

    // Fetch requested season from DB
    let { data, error } = await tryCatch(getCampaign(resolvedSeason));

    // If season not in DB, fetch from official API and seed it
    if (!error && !data && resolvedSeason !== null) {
        const { error: seedError } = await tryCatch(fetchAndSeedSeason(resolvedSeason));
        if (seedError) {
            console.error('fetchAndSeedSeason failed:', seedError);
            return (
                <div className="gutters flex min-h-full w-full flex-col items-center justify-center py-12">
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
            <div className="gutters flex min-h-full w-full flex-col items-center justify-center py-12">
                Unable to load campaign data. Please try again later.
            </div>
        );
    }

    if (!data) {
        return (
            <div className="gutters flex min-h-full w-full flex-col items-center justify-center py-12">
                No data available for season {resolvedSeason}.
            </div>
        );
    }

    const currentSeason = data.season;

    return (
        <div className="gutters pb-4">
            <h1 className="sr-only">War History</h1>
            <JsonLd data={archivesStructuredData} />
            <ArchivesClient
                data={data}
                seasons={seasons}
                currentSeason={currentSeason}
            />
        </div>
    );
}

const archivesStructuredData = [
    {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        applicationCategory: ['GameUtility', 'GameInformation', 'Entertainment'],
        url: 'https://helldivers.bot/archives',
        name: 'Archives | Helldivers Bot',
        author: 'Andrei Lavrenov',
        description:
            'Browse the official Super Earth archives. All campaign records have been verified and approved by High Command.',
        operatingSystem: 'All',
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
                name: 'Archives',
                item: 'https://helldivers.bot/archives',
            },
        ],
    },
];
