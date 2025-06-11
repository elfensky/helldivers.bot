/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
        return [
            {
                source: '/umami.js',
                destination: 'https://umami.lavrenov.io/script.js',
            },
        ];
    },
    output: 'standalone', // #1
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
            // new URL('https://cdn.discordapp.com/avatars/**'),
            // new URL('https://avatars.githubusercontent.com/u/**'),
            // new URL('https://www.gravatar.com/avatar/**'),
        ], //allows external avatars to be loaded
    },
};

export default nextConfig;

// #1

// Next.js can automatically create a standalone folder that copies only the necessary files for a production deployment including select files in node_modules.
// To leverage this automatic copying you can enable it in your next.config.js:
// This will create a folder at .next/standalone which can then be deployed on its own without installing node_modules.

// Additionally, a minimal server.js file is also output which can be used instead of next start.
// This minimal server does not copy the public or .next/static folders by default as these should ideally be handled by a CDN instead,
// although these folders can be copied to the standalone/public and standalone/.next/static folders manually,
// after which server.js file will serve these automatically.
