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
 * @param {string} provider - OAuth provider name ('discord' or 'github')
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

/** React hook for accessing the current session in client components. */
export const useSession = authClient.useSession;
