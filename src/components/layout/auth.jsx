import { signIn, signOut } from '@/auth';

export function SignIn({ provider, ...props }) {
    return (
        <form
            action={async () => {
                'use server';
                await signIn(provider);
            }}
        >
            <button>Sign In</button>
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
            className="w-full"
        >
            <button variant="ghost" className="w-full p-0">
                Sign Out
            </button>
        </form>
    );
}
