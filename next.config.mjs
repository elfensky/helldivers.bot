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
                destination: 'https://umami.lavrenov.io/script.js',
            },
        ];
    },
    async headers() {
        const csp = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https://authjs.dev https://cdn.discordapp.com https://avatars.githubusercontent.com https://www.gravatar.com",
            "font-src 'self'",
            "connect-src 'self' https://umami.lavrenov.io https://bugsink.lavrenov.cloud",
            "form-action 'self'",
            "frame-ancestors 'none'",
            "base-uri 'self'",
        ].join('; ');

        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'Content-Security-Policy',
                        value: csp,
                    },
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

export default withSentryConfig(nextConfig, {
    silent: true,
    sourcemaps: {
        disable: true,
    },
});
