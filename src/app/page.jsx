import { tryCatch } from '@/utils/tryCatch.mjs';
import { getCampaign } from '@/db/queries/getCampaign';
import { computeMapState } from '@/utils/computeMapState.mjs';
import { EVENT_STATUS } from '@/enums/events';
import DashboardClient from '@/components/h1/Dashboard/DashboardClient';
import TimelineSection from '@/components/h1/Timeline/TimelineSection';

export const dynamic = 'force-dynamic';

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

export default async function HomePage() {
    const { data, error } = await tryCatch(getCampaign());

    if (error || !data) {
        return (
            <div className="gutters flex min-h-full w-full flex-col items-center justify-center py-12">
                <h1>SIGNAL LOST</h1>
                <p>
                    Communication with Super Earth High Command has been disrupted. This
                    is not cause for alarm. Remain calm and await further instructions.
                </p>
            </div>
        );
    }

    // Only pass active events — completed events are already reflected in the campaign score
    const activeEvents = (data.events ?? []).filter(
        (e) => e.status === EVENT_STATUS.ACTIVE,
    );
    const mapState = computeMapState(data.live, activeEvents);

    return (
        <div className="gutters">
            <DashboardClient data={data} mapState={mapState} />
            <TimelineSection events={data.events} />
        </div>
    );
}
