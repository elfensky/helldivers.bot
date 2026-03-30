import { signIn, signOut } from '@/auth';

export function SignIn({ provider, ...props }) {
    return (
        <form
            className="flex items-center justify-center"
            action={async () => {
                'use server';
                await signIn(provider);
            }}
        >
            <button data-umami-event="header-signin">Sign In</button>
        </form>
    );
}

export function SignOut(props) {
    return (
        <form
            action={async () => {
                'use server';
                await signOut();
            }}
            className="flex items-center justify-center"
        >
            <button
                variant="ghost"
                className="w-full p-0"
                data-umami-event="header-signout"
            >
                Sign Out
            </button>
        </form>
    );
}
