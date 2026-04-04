'use client';
import { signIn, signOut } from '@/auth-client';

export function SignIn({ provider }) {
    return (
        <button
            type="button"
            className="header-nav-link cursor-pointer"
            data-umami-event="header-signin"
            onClick={() => signIn(provider || 'discord')}
        >
            Sign In
        </button>
    );
}

export function SignOut() {
    return (
        <button
            type="button"
            className="header-nav-link cursor-pointer"
            data-umami-event="header-signout"
            onClick={() => signOut()}
        >
            Sign Out
        </button>
    );
}
