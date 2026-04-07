'use client';
import './BottomNav.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import StatusDot from '@/shared/components/StatusDot';

export default function BottomNav() {
    const pathname = usePathname();
    const tabs = [
        { href: '/', label: 'Live', live: true },
        { href: '/archives', label: 'Archives', icon: '◈' },
        { href: '/docs', label: 'Docs', icon: '◇' },
    ];

    return (
        <nav className="bottom-nav">
            {tabs.map(({ href, label, icon, live }) => {
                const isActive =
                    href === '/' ? pathname === '/' : pathname.startsWith(href);
                return (
                    <Link
                        key={href}
                        href={href}
                        prefetch={false}
                        className={`bottom-nav-tab ${isActive ? 'active' : ''}`}
                    >
                        <span className="bottom-nav-icon">
                            {live ?
                                <StatusDot />
                            :   icon}
                        </span>
                        <span className="bottom-nav-label">{label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
