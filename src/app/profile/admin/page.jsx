import { auth } from '@/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAllUsers } from '@/db/queries/admin';
import SystemOverview from '@/features/admin/SystemOverview';
import UserTable from '@/features/admin/UserTable';

export const metadata = {
    title: 'Admin | Helldivers Bot',
    description: 'Admin panel for managing users and monitoring system health',
    robots: { index: false, follow: false },
};

export default async function AdminPage() {
    if (!auth) redirect('/');

    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user || session.user.role !== 'admin') {
        redirect('/profile');
    }

    const result = await getAllUsers();
    const users = result.data ?? [];
    const adminCount = users.filter((u) => u.role === 'admin').length;

    return (
        <div className="flex flex-col gap-4">
            <SystemOverview />
            <UserTable
                users={users}
                adminCount={adminCount}
                currentUserId={session.user.id}
            />
        </div>
    );
}
