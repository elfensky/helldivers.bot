import { auth } from '@/auth';
import { redirect } from 'next/navigation';
//components
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ApiDashboard from '@/components/dashboard/ApiDashboard';
import UserDashboard from '@/components/dashboard/UserDashboard';

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
        return (
            <>
                <ApiDashboard user={user} />
                {/* <UserDashboard /> */}
            </>
        );
    }

    // if (user.role === 'admin') {
    //     console.log('role: ', user.role);
    //     return (
    //         <>
    //             <ApiDashboard user={user} />
    //             {/* <UserDashboard />
    //             <AdminDashboard />; */}
    //         </>
    //     );
    // }

    return null; //this is a fallback, it should theoretically never be reached
}
