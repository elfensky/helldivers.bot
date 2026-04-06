'use client';
import './BottomNav.css';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
    const pathname = usePathname();
    const tabs = [
        { href: '/', label: 'Live', icon: '●', live: true },
        { href: '/archives', label: 'Archives', icon: '◈' },
        { href: '/docs', label: 'Docs', icon: '◇' },
    ];

    return (
        <nav className="bottom-nav">
            {tabs.map(({ href, label, icon, live }) => {
                const isActive =
                    href === '/' ? pathname === '/' : pathname.startsWith(href);
                return (
                    <a
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
                    </a>
                );
            })}
        </nav>
    );
}
