/**
 * BetterAuth client-side utilities for React components.
 *
 * Exports signIn, signOut, and useSession for use in client components.
 * Sign-in uses OAuth social providers; sign-out redirects to '/'.
 *
 * @module auth-client
 */
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient();

/**
 * Trigger OAuth sign-in flow for a social provider.
 * @param {string} provider - OAuth provider name ('discord', 'github', or 'google')
 * @param {{ callbackURL?: string }} [options] - Options. Defaults callbackURL to '/profile'.
 */
export const signIn = (provider, options = {}) =>
    authClient.signIn.social({
        provider,
        callbackURL: options.callbackURL || '/profile',
    });

/** Sign out the current user and redirect to '/'. */
export const signOut = () =>
    authClient.signOut({
        fetchOptions: {
            onSuccess: () => {
                window.location.href = '/';
            },
        },
    });

/**
 * Initiate OAuth flow to link a new social provider to the current account.
 * @param {string} provider - OAuth provider name ('discord', 'github', or 'google')
 */
export const linkSocial = (provider) =>
    authClient.linkSocial({ provider, callbackURL: '/profile' });

/**
 * Unlink a social provider from the current account.
 * @param {string} providerId - Provider name ('discord', 'github', or 'google')
 * @param {string} accountId - The provider-specific account ID
 */
export const unlinkAccount = (providerId, accountId) =>
    authClient.unlinkAccount({ providerId, accountId });

/** React hook for accessing the current session in client components. */
export const useSession = authClient.useSession;
