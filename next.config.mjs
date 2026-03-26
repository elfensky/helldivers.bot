import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactCompiler: true,
    output: 'standalone',
    images: {
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
        ],
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
        return [
            {
                source: '/favicons/:slug',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=86400, immutable',
                    },
                ],
            },
            {
                source: '/fonts/:slug',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=31536000, immutable',
                    },
                ],
            },
            {
                source: '/icons/:slug',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=604800, immutable',
                    },
                ],
            },
            {
                source: '/images/:slug',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=604800, immutable',
                    },
                ],
            },
            {
                source: '/svgs/:slug',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=604800, immutable',
                    },
                ],
            },
            {
                source: '/workers/:slug',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=86400, immutable',
                    },
                ],
            },
        ];
    },
};

export default withSentryConfig(nextConfig, {
    silent: true,
    sourcemaps: {
        disable: true,
    },
});
