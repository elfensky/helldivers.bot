import { cookies } from 'next/headers';
import JsonLd from '@/shared/components/JsonLd';
import HomeClient from '@/features/dashboard/HomeClient';
import { getCampaign } from '@/db/queries/getCampaign.mjs';
import { getPlayersAvg24h } from '@/db/queries/getPlayersAvg24h.mjs';
import { getKillsTrend } from '@/db/queries/getKillsTrend.mjs';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { FACTION_KEY, validateFaction } from '@/shared/preferences/faction.mjs';
import {
    REGIONS_VIEW_KEY,
    validateRegionsView,
} from '@/shared/preferences/regionsView.mjs';
import { SORT_ORDER_KEY, validateSortOrder } from '@/shared/preferences/sortOrder.mjs';

export const metadata = {
    title: 'Helldivers Bot — Live Galactic Campaign Dashboard',
    description:
        'Track Managed Democracy across the galaxy. Live Helldivers 1 campaign dashboard with faction stats, active events, and an interactive galaxy map for the war against the Bugs, Cyborgs, and Illuminate.',
    alternates: { canonical: '/' },
    openGraph: {
        title: 'Helldivers Bot — Live Galactic Campaign Dashboard',
        description:
            "Don't miss a moment of the action! Follow the Helldivers' campaign progress as they battle for peace, liberty, and managed democracy.",
        url: '/',
    },
};

const structuredData = [
    {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        applicationCategory: ['GameApplication', 'GameUtility', 'Entertainment'],
        url: 'https://helldivers.bot',
        name: 'Helldivers Bot — Live Galactic Campaign Dashboard',
        author: {
            '@type': 'Person',
            name: 'Andrei Lavrenov',
            url: 'https://lav.ren',
        },
        description:
            'Track Managed Democracy across the galaxy. Live Helldivers 1 campaign dashboard with faction stats, active events, and an interactive galaxy map.',
        offers: {
            '@type': 'Offer',
            price: 0.0,
            priceCurrency: 'EUR',
        },
        operatingSystem: 'All',
        browserRequirements: 'Requires JavaScript',
    },
    {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            {
                '@type': 'ListItem',
                position: 1,
                name: 'Home',
                item: 'https://helldivers.bot',
            },
        ],
    },
];

export default async function HomePage() {
    const c = await cookies();
    const initialFaction = validateFaction(c.get(FACTION_KEY)?.value);
    const initialRegionsView = validateRegionsView(c.get(REGIONS_VIEW_KEY)?.value);
    const initialSortOrder = validateSortOrder(c.get(SORT_ORDER_KEY)?.value);

    // `getCampaign()` is React-cached, so this is a no-op DB hit — it's
    // already been called in the layout. We only need the season number
    // to fetch the 24h baselines for the stat card subtitles.
    const { data: campaign } = await tryCatch(getCampaign());
    const [playersRes, killsRes] =
        campaign ?
            await Promise.all([
                tryCatch(getPlayersAvg24h(campaign.season)),
                tryCatch(getKillsTrend(campaign.season)),
            ])
        :   [{ data: null }, { data: null }];

    return (
        <>
            <JsonLd data={structuredData} />
            <HomeClient
                initialFaction={initialFaction}
                initialRegionsView={initialRegionsView}
                initialSortOrder={initialSortOrder}
                playersAvg24h={playersRes.data ?? null}
                killsTrend={killsRes.data ?? null}
            />
        </>
    );
}
