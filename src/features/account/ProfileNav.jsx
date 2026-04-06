'use client';
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
                <a href="/profile" className="text-h2 text-text-muted hover:text-text">
                    Profile
                </a>
            :   <h1 className="text-h2 font-bold text-text">Profile</h1>}
            <span className="text-h2 text-ghost">|</span>
            {onAdminPage ?
                <h1 className="text-h2 font-bold text-text">Admin</h1>
            :   <a
                    href="/profile/admin"
                    className="text-h2 text-text-muted hover:text-text"
                >
                    Admin
                </a>
            }
        </div>
    );
}
