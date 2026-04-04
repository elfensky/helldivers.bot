import { auth } from '@/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import ProfileNav from '@/features/account/ProfileNav';

export const metadata = {
    title: 'Profile | Helldivers Bot',
    description: 'Manage your account, API keys, and settings',
    robots: { index: false, follow: false },
};

export default async function ProfileLayout({ children }) {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session || !session.user) {
        redirect('/sign-in');
    }

    if (session.user.banned) {
        redirect('/');
    }

    return (
        <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
            <ProfileNav role={session.user.role} />
            {children}
        </section>
    );
}
