import { auth } from '@/auth';
import { headers } from 'next/headers';
import ApiDashboard from '@/features/account/ApiDashboard';
import ProfileInfo from '@/features/account/ProfileInfo';
import AccountActions from '@/features/account/AccountActions';

export default async function ProfilePage() {
    const session = await auth.api.getSession({ headers: await headers() });
    const user = session.user;

    return (
        <div className="flex flex-col gap-4">
            <ProfileInfo user={user} />
            <ApiDashboard user={user} />
            <AccountActions user={user} />
        </div>
    );
}
