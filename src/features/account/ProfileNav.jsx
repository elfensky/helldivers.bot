'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function ProfileNav({ role }) {
    const pathname = usePathname();
    const isAdmin = role === 'admin';
    const onAdminPage = pathname === '/profile/admin';

    if (!isAdmin) {
        return <h1 className="text-xl font-bold text-text">Profile</h1>;
    }

    return (
        <div className="flex items-baseline gap-3">
            {onAdminPage ?
                <Link href="/profile" className="text-xl text-text-muted hover:text-text">
                    Profile
                </Link>
            :   <h1 className="text-xl font-bold text-text">Profile</h1>}
            <span className="text-xl text-ghost">|</span>
            {onAdminPage ?
                <h1 className="text-xl font-bold text-text">Admin</h1>
            :   <Link
                    href="/profile/admin"
                    className="text-xl text-text-muted hover:text-text"
                >
                    Admin
                </Link>
            }
        </div>
    );
}
