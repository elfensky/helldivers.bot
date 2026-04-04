'use client';
import { signIn, signOut } from '@/auth-client';

export function SignIn({ provider, ...props }) {
    return (
        <form className="flex items-center justify-center">
            <button
                type="button"
                data-umami-event="header-signin"
                onClick={() => signIn(provider || 'discord')}
            >
                Sign In
            </button>
        </form>
    );
}

export function SignOut(props) {
    return (
        <form className="flex items-center justify-center">
            <button
                type="button"
                className="w-full p-0"
                data-umami-event="header-signout"
                onClick={() => signOut()}
            >
                Sign Out
            </button>
        </form>
    );
}
