import './page.css';
import { tryCatch } from '@/utils/tryCatch.mjs';
import { getCampaign } from '@/db/queries/getCampaign';
import { computeMapState } from '@/utils/computeMapState.mjs';
import DashboardClient from '@/components/h1/Dashboard/DashboardClient';

export const dynamic = 'force-dynamic';

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
    const activeEvents = (data.events ?? []).filter((e) => e.status === 'active');
    const mapState = computeMapState(data.live, activeEvents);

    return <DashboardClient data={data} mapState={mapState} />;
}
