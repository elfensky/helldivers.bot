import { auth } from '@/auth';
import { redirect } from 'next/navigation';
//components
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import UserDashboard from '@/components/dashboard/UserDashboard';
import AdminDashboard from '@/components/dashboard/AdminDashboard';

export const metadata = {
    title: 'Dashboard | Helldivers Bot',
    description: 'Manage your Helldivers API key and view your account information',
};

export default async function Dashboard() {
    const session = await auth();
    // const headerList = await headers();
    // console.log(session);

    if (!session || !session.user) {
        const currentPath = '/dashboard';
        redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(currentPath)}`);
    }

    if (session.user.role === 'user') {
        console.log('role: ', session.user.role);
        return <UserDashboard />;
    }

    if (session.user.role === 'admin') {
        console.log('role: ', session.user.role);
        return <AdminDashboard />;
    }

    return null; //this is a fallback, it should theoretically never be reached
}
