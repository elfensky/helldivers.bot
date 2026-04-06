import { execSync } from 'node:child_process';
import { withSentryConfig } from '@sentry/nextjs';
import createMDX from '@next/mdx';

const APP_VERSION = process.env.npm_package_version || '0.0.0';
const COMMIT_SHA = (() => {
    try {
        return execSync('git rev-parse --short HEAD').toString().trim();
    } catch {
        return 'unknown';
    }
})();
const COMMIT_MESSAGE = (() => {
    try {
        return execSync('git log -1 --format=%s').toString().trim();
    } catch {
        return '';
    }
})();

console.log(`[helldivers.bot] v${APP_VERSION} (${COMMIT_SHA}) ${COMMIT_MESSAGE}`);

/** @type {import('next').NextConfig} */
const nextConfig = {
    env: {
        NEXT_PUBLIC_APP_VERSION: APP_VERSION,
        NEXT_PUBLIC_COMMIT_SHA: COMMIT_SHA,
        NEXT_PUBLIC_COMMIT_MESSAGE: COMMIT_MESSAGE,
    },
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
        ];
    },
    async rewrites() {
        return [
            {
                source: '/stats.js',
                destination: 'https://umami.drunik.be/script.js',
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

export default withSentryConfig(withMDX(nextConfig), {
    silent: true,
    url: process.env.SENTRY_URL,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    release: {
        create: false,
    },
});
