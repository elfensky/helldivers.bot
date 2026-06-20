/**
 * BetterAuth server configuration.
 *
 * Configures OAuth authentication with Discord, GitHub, and Google providers,
 * Prisma adapter for PostgreSQL, and a custom `role` field on User.
 *
 * Server-side session retrieval:
 *   const session = await auth.api.getSession({ headers: await headers() });
 *
 * @see {@link module:auth-client} for client-side auth utilities
 * @see the route handler at src/app/api/auth/[...all]/route.js
 * @module auth
 */
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import db from '@/db/db';
import { ROLE } from '@/shared/enums/roles.mjs';

export const auth =
    process.env.BETTER_AUTH_SECRET ?
        betterAuth({
            secret: process.env.BETTER_AUTH_SECRET,
            baseURL: process.env.BETTER_AUTH_URL,
            database: prismaAdapter(db, {
                provider: 'postgresql',
            }),
            account: {
                accountLinking: {
                    trustedProviders: ['discord', 'github', 'google'],
                    allowDifferentEmails: true,
                },
            },
            // Each provider's OAuth credentials are independently optional env
            // vars; BetterAuth accepts the `undefined` they read as `string |
            // undefined` and simply leaves the provider unconfigured. The
            // provider config type narrows to `string`, so cast to preserve the
            // runtime value (which may be `undefined`) without widening it.
            socialProviders: {
                discord: {
                    clientId: /** @type {string} */ (process.env.AUTH_DISCORD_ID),
                    clientSecret: /** @type {string} */ (process.env.AUTH_DISCORD_SECRET),
                },
                github: {
                    clientId: /** @type {string} */ (process.env.AUTH_GITHUB_ID),
                    clientSecret: /** @type {string} */ (process.env.AUTH_GITHUB_SECRET),
                },
                google: {
                    clientId: /** @type {string} */ (process.env.AUTH_GOOGLE_ID),
                    clientSecret: /** @type {string} */ (process.env.AUTH_GOOGLE_SECRET),
                },
            },
            user: {
                additionalFields: {
                    role: {
                        type: 'string',
                        defaultValue: ROLE.USER,
                        input: false,
                    },
                },
            },
        })
    :   null;
