import { auth } from '@/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import db from '@/db/db';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { getGravatarUrl } from '@/shared/utils/gravatar.mjs';
import AdminSection from '@/features/admin/AdminSection';
import AccountSection from '@/features/account/AccountSection';
import { ROLE } from '@/shared/enums/roles.mjs';

export default async function ProfilePage() {
    if (!auth) redirect('/');

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect('/sign-in');
    const user = session.user;
    // `role` is a custom BetterAuth additionalField (and a real DB column) not
    // reflected in the inferred session-user type — see auth.js / prisma schema.
    const isAdmin = /** @type {{ role?: string }} */ (user).role === ROLE.ADMIN;

    const { data: accounts, error } = await tryCatch(
        db.account.findMany({
            where: { userId: user.id },
            select: { providerId: true, accountId: true },
        }),
    );
    if (error) throw error;

    const providers = accounts.map((a) => ({
        providerId: a.providerId,
        accountId: a.accountId,
    }));
    const avatarUrl = user.image ?? (await getGravatarUrl(user.email));

    return (
        <div className="flex flex-col gap-6">
            {isAdmin && <AdminSection currentUserId={user.id} />}
            <AccountSection
                user={user}
                avatarUrl={avatarUrl}
                providers={providers}
                canUnlink={providers.length > 1}
            />
        </div>
    );
}
