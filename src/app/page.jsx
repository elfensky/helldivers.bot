import ComponentErrorBoundary from '@/shared/components/ComponentErrorBoundary';
import JsonLd from '@/shared/components/JsonLd';
import DashboardClient from '@/features/dashboard/DashboardClient';
import TimelineSection from '@/features/timeline/TimelineSection';

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

export default function HomePage() {
    return (
        <>
            <JsonLd data={structuredData} />
            <ComponentErrorBoundary name="Dashboard">
                <DashboardClient />
            </ComponentErrorBoundary>
            <ComponentErrorBoundary name="Timeline">
                <TimelineSection />
            </ComponentErrorBoundary>
        </>
    );
}
