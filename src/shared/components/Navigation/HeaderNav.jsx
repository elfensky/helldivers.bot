'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
    { href: '/', label: 'Live', live: true },
    { href: '/archives', label: 'Archives' },
    { href: '/docs', label: 'Docs' },
];

export default function HeaderNav() {
    const pathname = usePathname();

    return (
        <div className="hidden items-center gap-3 md:flex">
            {tabs.map(({ href, label, live }) => {
                const isActive =
                    href === '/' ? pathname === '/' : pathname.startsWith(href);
                return (
                    <Link
                        key={href}
                        href={href}
                        prefetch={false}
                        className={`header-nav-link ${isActive ? 'header-nav-link--active' : ''}`}
                    >
                        {live && <span className="bottom-nav-live">●</span>}
                        {label}
                    </Link>
                );
            })}
        </div>
    );
}
