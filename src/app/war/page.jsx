import './war.css';
//db
import { tryCatch } from '@/utils/tryCatch.mjs';
import { getCampaign } from '@/db/queries/getCampaign';
import { getSeasonList } from '@/db/queries/getSeasonList';
//utils
import { computeMapState } from '@/utils/computeMapState.mjs';
//components
import War from '@/components/h1/War/War';
import Timeline from '@/components/h1/Timeline/Timeline';
import WarTimeline from '@/components/h1/WarTimeline/WarTimeline';
import Link from 'next/link';

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

    const { data: seasons, error: seasonsError } = await tryCatch(getSeasonList());

    if (seasonsError !== null) {
        console.error('getSeasonList failed:', seasonsError);
        return (
            <div className="flex min-h-full w-full flex-col justify-center">
                Unable to load season list. Please try again later.
            </div>
        );
    }

    const { data, error } = await tryCatch(getCampaign(seasonParam));

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
        <div className="gutters z-10 flex w-screen flex-col gap-4 overflow-hidden">
            <JsonLd />

            <SeasonSelector seasons={seasons} currentSeason={currentSeason} />

            <div className="flex flex-col-reverse justify-between gap-4 xl:flex-row xl:flex-wrap">
                <War data={data} showOutcome={true} />
                <Timeline data={data} />
                <WarTimeline data={data} defaultMapState={mapState} />
            </div>
        </div>
    );
}

function SeasonSelector({ seasons, currentSeason }) {
    if (!seasons || seasons.length === 0) return null;

    return (
        <nav className="flex flex-wrap items-center gap-2">
            <span className="text-sm opacity-70">Season:</span>
            {seasons.map((s) => (
                <Link
                    key={s.season}
                    href={`/war?season=${s.season}`}
                    className={`rounded px-3 py-1 text-sm ${
                        s.season === currentSeason ?
                            'bg-[var(--orange)] text-black'
                        :   'bg-white/10 hover:bg-white/20'
                    }`}
                >
                    {s.season}
                </Link>
            ))}
        </nav>
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
