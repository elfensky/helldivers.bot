export default async function sitemap() {
    return [
        {
            url: 'https://helldivers.bot/',
            lastModified: new Date(),
            changeFrequency: 'always',
            priority: 1,
        },
        {
            url: 'https://helldivers.bot/war',
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.9,
        },
        {
            url: 'https://helldivers.bot/about',
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.5,
        },
    ];
}

export const dynamic = 'force-dynamic'; //make it always dynamic and avoid attempting to building and cache it during build time in docker.
