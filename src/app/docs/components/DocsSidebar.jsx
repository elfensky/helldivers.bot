'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const sections = [
    {
        label: 'General',
        items: [
            { href: '/docs', label: 'Overview' },
            { href: '/docs/about', label: 'About' },
            { href: '/docs/faq', label: 'FAQ' },
        ],
    },
    {
        label: 'Technical',
        items: [
            { href: '/docs/architecture', label: 'Architecture' },
            { href: '/docs/api', label: 'API Reference' },
            { href: '/docs/brandkit', label: 'Brand Kit' },
        ],
    },
];

function getCurrentPage(pathname) {
    for (const section of sections) {
        for (const item of section.items) {
            if (item.href === pathname) return item.label;
        }
    }
    return 'Docs';
}

export default function DocsSidebar() {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const currentPage = getCurrentPage(pathname);

    return (
        <>
            {/* Mobile breadcrumb bar */}
            <button
                onClick={() => setOpen(!open)}
                className="flex w-full items-center gap-2 border-b border-[var(--color-outline-variant)] bg-[var(--color-surface-1)] px-4 py-3 text-sm lg:hidden"
            >
                <span className="text-[var(--color-text-muted)]">Docs /</span>
                <span className="text-[var(--color-primary)]">{currentPage}</span>
                <span className="ml-auto text-xs text-[var(--color-text-muted)]">
                    {open ? '\u25B2' : '\u25BC'}
                </span>
            </button>

            {/* Mobile dropdown */}
            {open && (
                <nav className="border-b border-[var(--color-outline-variant)] bg-[var(--color-surface-1)] py-4 lg:hidden">
                    <SidebarContent
                        pathname={pathname}
                        onNavigate={() => setOpen(false)}
                    />
                </nav>
            )}

            {/* Desktop sidebar */}
            <nav className="hidden border-r border-[var(--color-outline-variant)] bg-[var(--color-surface-1)] py-5 lg:block">
                <SidebarContent pathname={pathname} />
            </nav>
        </>
    );
}

function SidebarContent({ pathname, onNavigate }) {
    return (
        <>
            {sections.map((section) => (
                <div key={section.label} className="mb-5">
                    <div className="px-4 pb-2 font-[family-name:var(--font-mono)] text-[10px] tracking-[1.5px] text-[var(--color-text-muted)] uppercase">
                        {section.label}
                    </div>
                    {section.items.map((item) => {
                        const isActive = item.href === pathname;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                prefetch={false}
                                onClick={onNavigate}
                                className={`block border-l-2 px-4 py-1.5 text-sm ${
                                    isActive ?
                                        'border-[var(--color-primary)] bg-[var(--color-surface-2)] text-[var(--color-primary)]'
                                    :   'border-transparent text-[var(--color-text)] hover:bg-[var(--color-surface-2)]'
                                }`}
                            >
                                {item.label}
                            </Link>
                        );
                    })}
                </div>
            ))}
        </>
    );
}
