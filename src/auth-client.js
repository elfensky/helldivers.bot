import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient();

export const signIn = (provider, options = {}) =>
    authClient.signIn.social({
        provider,
        callbackURL: options.callbackURL || '/profile',
    });

export const signOut = () =>
    authClient.signOut({
        fetchOptions: {
            onSuccess: () => {
                window.location.href = '/';
            },
        },
    });

export const useSession = authClient.useSession;
