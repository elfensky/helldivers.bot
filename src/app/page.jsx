import './page.css';
//db
import { tryCatch } from '@/utils/tryCatch.mjs';
import { getCampaign } from '@/db/queries/getCampaign';
//components
import Galaxy from '@/components/h1/Galaxy/Galaxy';
import War from '@/components/h1/War/War';
import Timeline from '@/components/h1/Timeline/Timeline';

// Force dynamic rendering - skip build-time evaluation (requires database)
export const dynamic = 'force-dynamic';

export default async function HomePage() {
    const { data, error } = await tryCatch(getCampaign());

    if (error !== null) {
        console.error('getCampaign failed:', error);
        return (
            <div className="flex min-h-full w-full flex-col-reverse justify-center sm:flex-row">
                Unable to load campaign data. Please try again later.
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex min-h-full w-full flex-col-reverse justify-center sm:flex-row">
                Loading...
            </div>
        );
    }

    return (
        <div className="gutters z-10 flex w-screen flex-col-reverse justify-between gap-4 overflow-hidden xl:fixed xl:top-[80px] xl:max-h-[calc(100vh-80px-16px)] xl:flex-row xl:flex-wrap">
            <War data={data} />
            <Timeline data={data} />
            <Galaxy data={data} />
        </div>
    );
}
