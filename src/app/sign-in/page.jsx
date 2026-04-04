'use client';
import { signIn } from '@/auth-client';

export default function SignInPage() {
    return (
        <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-6">
            <h1 className="font-display text-2xl text-primary">Sign In</h1>
            <div className="flex flex-col gap-3">
                <button
                    className="cursor-pointer bg-surface-3 px-6 py-3 text-text transition-colors hover:bg-surface-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                    onClick={() => signIn('discord')}
                >
                    Sign in with Discord
                </button>
                <button
                    className="cursor-pointer bg-surface-3 px-6 py-3 text-text transition-colors hover:bg-surface-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                    onClick={() => signIn('github')}
                >
                    Sign in with GitHub
                </button>
            </div>
        </div>
    );
}
