/**
 * BetterAuth server configuration.
 *
 * Configures OAuth authentication with Discord and GitHub providers,
 * Prisma adapter for PostgreSQL, and a custom `role` field on User.
 *
 * Server-side session retrieval:
 *   const session = await auth.api.getSession({ headers: await headers() });
 *
 * @see {@link module:auth-client} for client-side auth utilities
 * @see /src/app/api/auth/[...all]/route.js for the route handler
 * @module auth
 */
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import db from '@/db/db';

export const auth = betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    database: prismaAdapter(db, {
        provider: 'postgresql',
    }),
    account: {
        accountLinking: {
            trustedProviders: ['discord', 'github'],
        },
    },
    socialProviders: {
        discord: {
            clientId: process.env.AUTH_DISCORD_ID,
            clientSecret: process.env.AUTH_DISCORD_SECRET,
        },
        github: {
            clientId: process.env.AUTH_GITHUB_ID,
            clientSecret: process.env.AUTH_GITHUB_SECRET,
        },
    },
    user: {
        additionalFields: {
            role: {
                type: 'string',
                defaultValue: 'user',
                input: false,
            },
        },
    },
});
