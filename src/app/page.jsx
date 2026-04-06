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

export default function HomePage() {
    return (
        <>
            <DashboardClient />
            <TimelineSection />
        </>
    );
}
