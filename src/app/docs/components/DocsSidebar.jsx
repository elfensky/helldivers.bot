'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const sections = [
    {
        label: 'General',
        items: [
            { href: '/docs', label: 'Overview', track: 'docs-overview' },
            { href: '/docs/about', label: 'About', track: 'docs-about' },
            { href: '/docs/faq', label: 'FAQ', track: 'docs-faq' },
        ],
    },
    {
        label: 'Technical',
        items: [
            { href: '/docs/architecture', label: 'Architecture', track: 'docs-architecture' },
            { href: '/docs/notifications', label: 'Notifications', track: 'docs-notifications' },
            { href: '/docs/api', label: 'API Reference', track: 'docs-api' },
            { href: '/docs/brandkit', label: 'Brand Kit', track: 'docs-brandkit' },
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
                data-umami-event="docs-sidebar-toggle"
                className="flex w-full items-center gap-2 border-b border-ghost bg-surface-1 px-4 py-3 text-body lg:hidden"
            >
                <span className="text-text-muted">Docs /</span>
                <span className="text-primary">{currentPage}</span>
                <span className="ml-auto text-xs text-text-muted">
                    {open ? '\u25B2' : '\u25BC'}
                </span>
            </button>

            {/* Mobile dropdown */}
            {open && (
                <nav className="border-b border-ghost bg-surface-1 py-4 lg:hidden">
                    <SidebarContent
                        pathname={pathname}
                        onNavigate={() => setOpen(false)}
                    />
                </nav>
            )}

            {/* Desktop sidebar — glass panel fills column, nav content is sticky */}
            <div
                className="hidden border-r-2 border-primary lg:block"
                style={{
                    backdropFilter: 'blur(8.8px)',
                    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
                }}
            >
                <nav
                    className="p-gutters--left py-5"
                    style={{
                        position: 'sticky',
                        top: '80px',
                        maxHeight: 'calc(100dvh - 80px)',
                        overflowY: 'auto',
                    }}
                >
                    <SidebarContent pathname={pathname} />
                </nav>
            </div>
        </>
    );
}

function SidebarContent({ pathname, onNavigate }) {
    return (
        <>
            {sections.map((section) => (
                <div key={section.label} className="mb-5">
                    <div className="px-4 pb-2 font-mono text-small tracking-[1.5px] text-text-muted uppercase">
                        {section.label}
                    </div>
                    {section.items.map((item) => {
                        const isActive = item.href === pathname;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                prefetch={false}
                                data-umami-event={item.track}
                                onClick={onNavigate}
                                className={`block border-l-2 px-4 py-1.5 text-body ${
                                    isActive ?
                                        'border-primary bg-surface-2 text-primary'
                                    :   'border-transparent text-text hover:bg-surface-2'
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
