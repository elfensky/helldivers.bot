'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import StatusDot from '@/shared/components/StatusDot';

const tabs = [
    { href: '/', label: 'Live', live: true, track: 'nav-live' },
    { href: '/archives', label: 'Archives', track: 'nav-archives' },
    { href: '/stats', label: 'Stats', track: 'nav-stats' },
    { href: '/docs', label: 'Docs', track: 'nav-docs' },
];

export default function HeaderNav() {
    const pathname = usePathname();

    return (
        <div className="hidden items-center gap-3 md:flex">
            {tabs.map(({ href, label, live, track }) => {
                const isActive =
                    href === '/' ? pathname === '/' : pathname.startsWith(href);
                return (
                    <Link
                        key={href}
                        href={href}
                        prefetch={false}
                        data-umami-event={track}
                        className={`header-nav-link ${isActive ? 'header-nav-link--active' : ''}`}
                    >
                        {live && <StatusDot />}
                        {label}
                    </Link>
                );
            })}
        </div>
    );
}
