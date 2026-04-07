'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession } from '@/auth-client';
import { SignIn, SignOut } from '@/shared/components/Auth/Auth';
import { getGravatarUrl } from '@/shared/utils/gravatar';

export default function UserSection() {
    const pathname = usePathname();
    const isProfileActive = pathname.startsWith('/profile');
    const { data: session, isPending } = useSession();
    const [avatarUrl, setAvatarUrl] = useState(session?.user?.image ?? null);

    useEffect(() => {
        if (session?.user && !session.user.image) {
            getGravatarUrl(session.user.email).then(setAvatarUrl);
        } else if (session?.user?.image) {
            setAvatarUrl(session.user.image);
        }
    }, [session?.user?.image, session?.user?.email]);

    if (isPending) {
        return <div className="user-section-skeleton" />;
    }

    if (!session?.user) {
        return (
            <div className="user-section-content">
                <SignIn className={pathname === '/sign-in' ? 'header-nav-link--active' : ''} />
            </div>
        );
    }

    if (!avatarUrl) {
        return <div className="user-section-skeleton" />;
    }

    return (
        <div className="user-section-content flex items-center gap-3">
            <Link
                href="/profile"
                prefetch={false}
                data-umami-event="header-profile"
                className="flex items-center opacity-70 transition-[opacity,transform] hover:opacity-100 active:scale-95"
            >
                <Image
                    src={avatarUrl}
                    className={`rounded-full ${isProfileActive ? 'ring-2 ring-primary' : ''}`}
                    alt={`${session.user.name ?? 'User'} avatar`}
                    width={24}
                    height={24}
                    priority={true}
                />
            </Link>
            <SignOut />
        </div>
    );
}
