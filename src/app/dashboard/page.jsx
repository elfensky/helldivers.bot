import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import ApiDashboard from '@/components/dashboard/ApiDashboard';

export const metadata = {
    title: 'Dashboard | Helldivers Bot',
    description: 'Manage your Helldivers API key and view your account information',
};

export default async function Dashboard() {
    const session = await auth();

    if (!session || !session.user) {
        const currentPath = '/dashboard';
        redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(currentPath)}`);
    }

    const user = session.user;

    if (user.role === 'user') {
        return <ApiDashboard user={user} />;
    }

    return null;
}
