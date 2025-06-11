import './page.css';
//db
import { tryCatch } from '@/utils/tryCatch.mjs';
import { queryGetRebroadcastStatus } from '@/db/queries/rebroadcast';
import { getCampaign } from '@/db/queries/getCampaign';
//components
import Galaxy from '@/components/h1/Galaxy/Galaxy';
import War from '@/components/h1/War/War';
import Timeline from '@/components/h1/Timeline/Timeline';

//

export default async function HomePage() {
    const rebroacast_status = await tryCatch(queryGetRebroadcastStatus());
    const query = await tryCatch(getCampaign());
    const data = query?.data;

    if (!data) {
        return (
            <div className="flex min-h-full w-full flex-col-reverse justify-center sm:flex-row">
                Loading...
            </div>
        );
    }

    return (
        <div className="mx-2 flex flex-col-reverse gap-4 sm:mx-24 lg:flex-row">
            {/* mx-2 flex min-h-full w-full flex-col-reverse items-center justify-center gap-2 sm:mx-24 sm:items-start sm:gap-4 lg:flex-row */}
            <Timeline data={data} />
            <War data={data} />
            <Galaxy data={data} />
        </div>
    );
}
