import { cookies } from 'next/headers';
import { getLatestsPostDate } from '@/db/queries/post';
import { tryCatch } from '@/utils/tryCatch.mjs';

export default async function sitemap() {
    const cookieStore = await cookies();
    const { data: reviews, error: reviewsError } = await tryCatch(getLatestsPostDate());

    return [
        {
            url: 'https://helldivers.bot/',
            lastModified: new Date(),
            changeFrequency: 'always',
            priority: 1,
        },
        {
            url: 'https://helldivers.bot/stats',
            lastModified: new Date(),
            changeFrequency: 'always',
            priority: 0.8,
        },
        // {
        //     url: 'https://helldivers.bot/blog',
        //     lastModified: new Date(),
        //     changeFrequency: 'yearly',
        //     priority: 0.9,
        // },
        {
            url: 'https://helldivers.bot/front/reviews',
            lastModified: reviews?.updatedAt || new Date(),
            changeFrequency: 'weekly',
            priority: 0.7,
        },
    ];
}

export const dynamic = 'force-dynamic'; //make it always dynamic and avoid attempting to building and cache it during build time in docker.
