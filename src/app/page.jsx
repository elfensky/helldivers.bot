import { cookies } from 'next/headers';
import JsonLd from '@/shared/components/JsonLd';
import HomeClient from '@/features/dashboard/HomeClient';
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

    return (
        <>
            <JsonLd data={structuredData} />
            <HomeClient
                initialFaction={initialFaction}
                initialRegionsView={initialRegionsView}
                initialSortOrder={initialSortOrder}
            />
        </>
    );
}
