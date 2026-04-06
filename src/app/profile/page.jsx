import { auth } from '@/auth';
import { headers } from 'next/headers';
import db from '@/db/db';
import { tryCatch } from '@/shared/utils/tryCatch';
import { getGravatarUrl } from '@/shared/utils/gravatar';
import ApiDashboard from '@/features/account/ApiDashboard';
import AccountActions from '@/features/account/AccountActions';

export default async function ProfilePage() {
    const session = await auth.api.getSession({ headers: await headers() });
    const user = session.user;

    const { data: accounts, error } = await tryCatch(
        db.account.findMany({
            where: { userId: user.id },
            select: { providerId: true },
        }),
    );
    if (error) throw error;

    const providers = accounts.map((a) => a.providerId);
    const avatarUrl = user.image ?? getGravatarUrl(user.email);

    return (
        <div className="flex flex-col gap-6">
            <ApiDashboard user={user} />
            <AccountActions user={user} avatarUrl={avatarUrl} providers={providers} />
        </div>
    );
}
