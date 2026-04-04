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
        <div className="flex items-center gap-4">
            <Image
                src={avatarUrl}
                alt={`${user.name ?? 'User'} avatar`}
                width={48}
                height={48}
                className="rounded-full"
            />
            <div>
                <p className="font-semibold text-text">{user.name ?? 'Anonymous'}</p>
                <p className="text-sm text-text-muted">{user.email}</p>
                <p className="text-sm text-text-muted">
                    Connected:{' '}
                    {providers.map((p, i) => (
                        <span key={p}>
                            {i > 0 && ' · '}
                            <span className="capitalize text-text">{p}</span>
                        </span>
                    ))}
                </p>
            </div>
        </div>
    );
}
