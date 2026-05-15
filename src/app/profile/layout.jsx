import { auth } from '@/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export const metadata = {
    title: 'Profile | Helldivers Bot',
    description: 'Manage your account, API keys, and settings',
    robots: { index: false, follow: false },
};

/**
 * Profile layout with server-side auth guard.
 * Redirects unauthenticated users to /sign-in.
 * Revokes session and redirects banned users to /.
 */
export default async function ProfileLayout({ children }) {
    if (!auth) redirect('/');

    const session = await auth.api.getSession({ headers: await headers() });

    if (!session || !session.user) {
        redirect('/sign-in');
    }

    if (session.user.banned) {
        await auth.api.revokeSessions({ headers: await headers() });
        redirect('/');
    }

    return <section className="gutters flex flex-col gap-6 py-6">{children}</section>;
}
