'use client';
import { signIn } from '@/auth-client';
import Hijackable from '@/features/ministry/Hijackable';

/** Sign-in page with Discord, GitHub, and Google OAuth buttons. */
export default function SignInPage() {
    return (
        <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-6">
            <Hijackable
                as="h1"
                category="heading"
                text="Sign In"
                className="font-display text-primary"
            />
            <div className="flex flex-col gap-3">
                <button
                    className="flex w-64 cursor-pointer items-center justify-center gap-3 px-6 py-3 text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.98]"
                    style={{ backgroundColor: '#5865F2' }}
                    data-umami-event="auth-signin-discord"
                    onClick={() => signIn('discord', { callbackURL: '/profile' })}
                >
                    <svg
                        width="20"
                        height="15"
                        viewBox="0 0 71 55"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M60.1 4.9A58.5 58.5 0 0 0 45.4.2a.2.2 0 0 0-.2.1 40.7 40.7 0 0 0-1.8 3.7 54 54 0 0 0-16.2 0A37.4 37.4 0 0 0 25.4.3a.2.2 0 0 0-.2-.1A58.4 58.4 0 0 0 10.5 4.9a.2.2 0 0 0-.1.1C1.5 18.7-.9 32.2.3 45.5v.2a58.9 58.9 0 0 0 17.7 9a.2.2 0 0 0 .3-.1 42.1 42.1 0 0 0 3.6-5.9.2.2 0 0 0-.1-.3 38.8 38.8 0 0 1-5.5-2.6.2.2 0 0 1 0-.4l1.1-.9a.2.2 0 0 1 .2 0 42 42 0 0 0 35.6 0 .2.2 0 0 1 .2 0l1.1.9a.2.2 0 0 1 0 .4 36.4 36.4 0 0 1-5.5 2.6.2.2 0 0 0-.1.3 47.3 47.3 0 0 0 3.6 5.9.2.2 0 0 0 .3.1A58.7 58.7 0 0 0 70.4 45.7v-.2c1.4-15-2.3-28.4-9.8-40.1a.2.2 0 0 0-.1-.1ZM23.7 37.3c-3.5 0-6.3-3.2-6.3-7s2.8-7 6.3-7 6.4 3.2 6.3 7-2.8 7-6.3 7Zm23.2 0c-3.5 0-6.3-3.2-6.3-7s2.8-7 6.3-7 6.4 3.2 6.3 7-2.8 7-6.3 7Z"
                            fill="white"
                        />
                    </svg>
                    Sign in with Discord
                </button>
                <button
                    className="flex w-64 cursor-pointer items-center justify-center gap-3 px-6 py-3 text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.98]"
                    style={{ backgroundColor: '#24292e' }}
                    data-umami-event="auth-signin-github"
                    onClick={() => signIn('github', { callbackURL: '/profile' })}
                >
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 98 96"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"
                            fill="white"
                        />
                    </svg>
                    Sign in with GitHub
                </button>
                <button
                    className="flex w-64 cursor-pointer items-center justify-center gap-3 border border-ghost px-6 py-3 transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.98]"
                    style={{ backgroundColor: '#fff', color: '#3c4043' }}
                    data-umami-event="auth-signin-google"
                    onClick={() => signIn('google', { callbackURL: '/profile' })}
                >
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                            fill="#4285F4"
                        />
                        <path
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            fill="#34A853"
                        />
                        <path
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 1 12c0 1.94.46 3.77 1.18 5.07l3.66-2.98z"
                            fill="#FBBC05"
                        />
                        <path
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            fill="#EA4335"
                        />
                    </svg>
                    Sign in with Google
                </button>
            </div>
        </div>
    );
}
