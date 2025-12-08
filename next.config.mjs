/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        reactCompiler: true,
    },
    output: 'standalone', // #3
    images: {
        //#4
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'cdn.discordapp.com',
                pathname: '/avatars/**',
            },
            {
                protocol: 'https',
                hostname: 'avatars.githubusercontent.com',
                pathname: '/u/**',
            },
            {
                protocol: 'https',
                hostname: 'www.gravatar.com',
                pathname: '/avatar/**',
            },
            // new URL('https://cdn.discordapp.com/avatars/**'),
            // new URL('https://avatars.githubusercontent.com/u/**'),
            // new URL('https://www.gravatar.com/avatar/**'),
        ], //allows external avatars to be loaded
    },
    async rewrites() {
        return [
            {
                source: '/stats.js',
                destination: 'https://umami.lavrenov.io/script.js',
            },
        ];
    },
    async headers() {
        // 1 day   : 86400    seconds
        // 7 days  : 604800   seconds
        // 14 days : 1209600  seconds
        // 30 days : 2592000  seconds
        // 365 days: 31536000 seconds
        return [
            {
                source: '/favicons/:slug',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=86400, immutable', //1day
                    },
                ],
            },
            {
                source: '/fonts/:slug',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=31536000, immutable', //14days
                    },
                ],
            },
            {
                source: '/icons/:slug',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=604800, immutable', //7days
                    },
                ],
            },
            {
                source: '/images/:slug',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=604800, immutable', //1week
                    },
                ],
            },
            // {
            //     source: '/scripts/:slug',
            //     headers: [
            //         {
            //             key: 'Cache-Control',
            //             value: 'public, max-age=86400 seconds, immutable', //1day
            //         },
            //     ],
            // },
            {
                source: '/svgs/:slug',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=604800 seconds, immutable', //7day
                    },
                ],
            },
            {
                source: '/workers/:slug',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=86400 seconds, immutable', //1day
                    },
                ],
            },
        ];
    },
};

export default nextConfig;

// #3

// Next.js can automatically create a standalone folder that copies only the necessary files for a production deployment including select files in node_modules.
// To leverage this automatic copying you can enable it in your next.config.js:
// This will create a folder at .next/standalone which can then be deployed on its own without installing node_modules.

// Additionally, a minimal server.js file is also output which can be used instead of next start.
// This minimal server does not copy the public or .next/static folders by default as these should ideally be handled by a CDN instead,
// although these folders can be copied to the standalone/public and standalone/.next/static folders manually,
// after which server.js file will serve these automatically.

// #4
// allows loading of external urs
