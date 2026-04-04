import Image from 'next/image';
import db from '@/db/db';
import { getGravatarUrl } from '@/shared/utils/gravatar';
import { tryCatch } from '@/shared/utils/tryCatch';

export default async function ProfileInfo({ user }) {
    const { data: accounts, error } = await tryCatch(
        db.account.findMany({
            where: { userId: user.id },
            select: { providerId: true },
        }),
    );
    if (error) throw error;

    const providers = accounts.map((a) => a.providerId);

    let avatarUrl = user.image ?? getGravatarUrl(user.email);

    return (
        <div className="grid grid-cols-[1fr_4px]">
            <div className="flex flex-col gap-3 bg-surface-1 p-4">
                <div className="flex items-center gap-3">
                    <Image
                        src={avatarUrl}
                        alt={`${user.name ?? 'User'} avatar`}
                        width={48}
                        height={48}
                        className="rounded-full"
                    />
                    <div>
                        <p className="font-semibold text-text">
                            {user.name ?? 'Anonymous'}
                        </p>
                        <p className="text-sm text-text-muted">{user.email}</p>
                    </div>
                </div>
                <p className="text-sm text-text-muted">
                    Connected:{' '}
                    {providers.map((p, i) => (
                        <span key={p}>
                            {i > 0 && ' · '}
                            <span className="text-text capitalize">{p}</span>
                        </span>
                    ))}
                </p>
            </div>
            <div className="bg-primary" />
        </div>
    );
}
