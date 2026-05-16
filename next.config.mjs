import { withSentryConfig } from '@sentry/nextjs';
import createMDX from '@next/mdx';

const APP_VERSION = process.env.npm_package_version || '0.0.0';

/** @type {import('next').NextConfig} */
const nextConfig = {
    env: {
        NEXT_PUBLIC_APP_VERSION: APP_VERSION,
    },
    deploymentId: APP_VERSION.replaceAll('.', '-'),
    pageExtensions: ['js', 'jsx', 'mdx'],
    reactCompiler: true,
    output: 'standalone',
    productionBrowserSourceMaps: true,
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
                hostname: 'lh3.googleusercontent.com',
                pathname: '/a/**',
            },
            {
                protocol: 'https',
                hostname: 'www.gravatar.com',
                pathname: '/avatar/**',
            },
        ],
    },
    async redirects() {
        return [
            {
                source: '/war',
                destination: '/archives',
                permanent: true,
            },
            {
                source: '/profile/admin',
                destination: '/profile',
                permanent: true,
            },
        ];
    },
    async rewrites() {
        return [
            {
                source: '/stats.js',
                destination: 'https://umami.drunik.be/script.js',
            },
            {
                source: '/api/send',
                destination: '/api/umami',
            },
        ];
    },
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY',
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                    {
                        key: 'Strict-Transport-Security',
                        value: 'max-age=94608000; includeSubDomains; preload',
                    },
                ],
            },
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
                // Service worker must never be HTTP-cached — browsers need to
                // fetch the latest sw.js on every navigation to detect updates.
                // skipWaiting + clientsClaim in src/sw.js handle activation;
                // this header ensures the *detection* step isn't stale.
                source: '/sw.js',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'no-cache, no-store, must-revalidate',
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

const withMDX = createMDX({
    options: {
        remarkPlugins: ['remark-gfm'],
    },
});

const finalConfig = withMDX(nextConfig);
export default process.env.SENTRY_AUTH_TOKEN ?
    withSentryConfig(finalConfig, {
        silent: true,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        sentryUrl: process.env.SENTRY_URL,
    })
:   finalConfig;
