'use client';
import Link from 'next/link';
import { signOut } from '@/auth-client';

/**
 * Sign-in button. Triggers OAuth flow via BetterAuth client.
 * @param {{ provider?: string }} props - OAuth provider (defaults to 'discord')
 */
export function SignIn({ provider }) {
    return (
        <Link href="/sign-in" className="header-nav-link" data-umami-event="header-signin">
            Sign In
        </Link>
    );
}

/** Sign-out button. Revokes session and redirects to '/'. */
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
