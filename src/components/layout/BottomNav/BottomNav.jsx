'use client';
import './BottomNav.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
    const pathname = usePathname();
    const tabs = [
        { href: '/', label: 'Live', icon: '●', live: true },
        { href: '/war', label: 'History', icon: '◈' },
        { href: '/about', label: 'About', icon: '◇' },
    ];

    return (
        <nav className="bottom-nav lg:hidden">
            {tabs.map(({ href, label, icon, live }) => {
                const isActive =
                    href === '/' ? pathname === '/' : pathname.startsWith(href);
                return (
                    <Link
                        key={href}
                        href={href}
                        className={`bottom-nav-tab ${isActive ? 'active' : ''}`}
                    >
                        <span
                            className={`bottom-nav-icon${live ? ' bottom-nav-live' : ''}`}
                        >
                            {icon}
                        </span>
                        <span className="bottom-nav-label">{label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
