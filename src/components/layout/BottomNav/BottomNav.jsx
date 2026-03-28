'use client';
import './BottomNav.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function BottomNav() {
    const pathname = usePathname();
    const tabs = [
        { href: '/', label: 'Live', icon: '◉' },
        { href: '/war', label: 'History', icon: '◈' },
        { href: '/about', label: 'About', icon: '◇' },
    ];

    return (
        <nav className="bottom-nav">
            {tabs.map(({ href, label, icon }) => {
                const isActive =
                    href === '/' ? pathname === '/' : pathname.startsWith(href);
                return (
                    <Link
                        key={href}
                        href={href}
                        className={`bottom-nav-tab ${isActive ? 'active' : ''}`}
                    >
                        <span className="bottom-nav-icon">{icon}</span>
                        <span className="bottom-nav-label">{label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
