'use client';
import './BottomNav.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import StatusDot from '@/shared/components/StatusDot';

export default function BottomNav() {
    const pathname = usePathname();
    const tabs = [
        { href: '/', label: 'Live', live: true, track: 'nav-live' },
        { href: '/archives', label: 'Archives', icon: '◈', track: 'nav-archives' },
        { href: '/docs', label: 'Docs', icon: '◇', track: 'nav-docs' },
    ];

    return (
        <nav className="bottom-nav">
            {tabs.map(({ href, label, icon, live, track }) => {
                const isActive =
                    href === '/' ? pathname === '/' : pathname.startsWith(href);
                return (
                    <Link
                        key={href}
                        href={href}
                        prefetch={false}
                        data-umami-event={track}
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
