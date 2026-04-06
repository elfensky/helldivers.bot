'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function ProfileNav({ role }) {
    const pathname = usePathname();
    const isAdmin = role === 'admin';
    const onAdminPage = pathname === '/profile/admin';

    if (!isAdmin) {
        return <h1 className="text-h2 font-bold text-text">Profile</h1>;
    }

    return (
        <div className="flex items-baseline gap-3">
            {onAdminPage ?
                <Link href="/profile" prefetch={false} className="text-h2 text-text-muted hover:text-text">
                    Profile
                </Link>
            :   <h1 className="text-h2 font-bold text-text">Profile</h1>}
            <span className="text-h2 text-ghost">|</span>
            {onAdminPage ?
                <h1 className="text-h2 font-bold text-text">Admin</h1>
            :   <Link
                    href="/profile/admin"
                    prefetch={false}
                    className="text-h2 text-text-muted hover:text-text"
                >
                    Admin
                </Link>
            }
        </div>
    );
}
