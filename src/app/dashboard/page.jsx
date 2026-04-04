import { auth } from '@/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import ApiDashboard from '@/features/account/ApiDashboard';

export const metadata = {
    title: 'Dashboard | Helldivers Bot',
    description: 'Manage your Helldivers API key and view your account information',
    robots: { index: false, follow: false },
};

export default async function Dashboard() {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session || !session.user) {
        redirect('/sign-in');
    }

    const user = session.user;

    if (user.role === 'user') {
        return <ApiDashboard user={user} />;
    }

    return null;
}
