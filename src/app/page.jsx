import './page.css';
import { tryCatch } from '@/utils/tryCatch.mjs';
import { getCampaign } from '@/db/queries/getCampaign';
import { computeMapState } from '@/utils/computeMapState.mjs';
import { EVENT_STATUS } from '@/enums/events';
import DashboardClient from '@/components/h1/Dashboard/DashboardClient';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'Helldivers Bot — Live Galactic Campaign Dashboard',
    description:
        "Track Managed Democracy across the galaxy. Live Helldivers 1 campaign dashboard with faction stats, active events, and an interactive galaxy map for the war against the Bugs, Cyborgs, and Illuminate.",
    openGraph: {
        title: 'Helldivers Bot — Live Galactic Campaign Dashboard',
        description:
            "Don't miss a moment of the action! Follow the Helldivers' campaign progress as they battle for peace, liberty, and managed democracy.",
    },
};

export default async function HomePage() {
    const { data, error } = await tryCatch(getCampaign());

    if (error || !data) {
        return (
            <div className="gutters flex min-h-full w-full flex-col items-center justify-center py-12">
                <h1>Signal Lost</h1>
                <p>Unable to load campaign data. Please try again later.</p>
            </div>
        );
    }

    // Only pass active events — completed events are already reflected in the campaign score
    const activeEvents = (data.events ?? []).filter((e) => e.status === EVENT_STATUS.ACTIVE);
    const mapState = computeMapState(data.live, activeEvents);

    return (
        <>
            <div className="gutters pt-4 pb-2">
                <h1 className="font-[family-name:var(--font-display)] text-sm text-[var(--color-primary)]">
                    Track Managed Democracy Across the Galaxy
                </h1>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    Don&apos;t miss a moment of the action! Follow the Helldivers&apos;
                    campaign progress as they battle the Bugs, Cyborgs, and Illuminate
                    for peace, liberty, and managed democracy. See which sectors are
                    under siege, which are liberated, and where your next mission awaits.
                </p>
            </div>
            <DashboardClient data={data} mapState={mapState} />
        </>
    );
}
