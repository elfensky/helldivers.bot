import './home.css';
//db
import { tryCatch } from '@/utils/tryCatch.mjs';
import { queryGetRebroadcastStatus } from '@/db/queries/rebroadcast';
//components
// import Image from 'next/image';
import Galaxy from '@/components/h1/Galaxy';
// import Stats from '@/components/h1/Stats';
import Timeline from '@/components/h1/Timeline';

export default async function HomePage() {
    'use server';
    const rebroacast_status = await tryCatch(queryGetRebroadcastStatus());

    return (
        <div className="flex min-h-full w-full flex-row justify-center">
            <Timeline />
            <Galaxy data={rebroacast_status} />
        </div>
    );
}
