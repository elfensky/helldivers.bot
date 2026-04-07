'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const topLevelItems = [{ href: '/docs', label: 'Overview', track: 'docs-overview' }];

const sections = [
    {
        label: 'General',
        items: [
            { href: '/docs/about', label: 'About', track: 'docs-about' },
            { href: '/docs/faq', label: 'FAQ', track: 'docs-faq' },
        ],
    },
    {
        label: 'Architecture',
        items: [
            {
                href: '/docs/architecture',
                label: 'Data Pipeline',
                track: 'docs-architecture',
            },
            { href: '/docs/data-flow', label: 'Update Flow', track: 'docs-data-flow' },
            { href: '/docs/database', label: 'Database Schema', track: 'docs-database' },
            {
                href: '/docs/notifications',
                label: 'Notifications',
                track: 'docs-notifications',
            },
            {
                href: '/docs/authentication',
                label: 'Authentication',
                track: 'docs-authentication',
            },
        ],
    },
    {
        label: 'Reference',
        items: [
            { href: '/docs/api', label: 'Rebroadcast', track: 'docs-api' },
            { href: '/docs/utilities', label: 'Utilities', track: 'docs-utilities' },
            { href: '/docs/hd1-api', label: 'Official', track: 'docs-hd1-api' },
            { href: '/docs/brandkit', label: 'Brand Kit', track: 'docs-brandkit' },
        ],
    },
    {
        label: 'Development',
        items: [
            {
                href: '/docs/infrastructure',
                label: 'Infrastructure',
                track: 'docs-infrastructure',
            },
            { href: '/docs/testing', label: 'Testing', track: 'docs-testing' },
        ],
    },
];

function getCurrentPage(pathname) {
    for (const item of topLevelItems) {
        if (item.href === pathname) return item.label;
    }
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

            {/* Desktop sidebar — surface cards per section */}
            <div className="hidden lg:block">
                <nav
                    className="p-gutters--left flex flex-col gap-3 py-5"
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
            <div className="border border-ghost bg-surface-1 p-3">
                {topLevelItems.map((item) => {
                    const isActive = item.href === pathname;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            prefetch={false}
                            data-umami-event={item.track}
                            onClick={onNavigate}
                            className={`block px-3 py-1.5 text-body ${
                                isActive ?
                                    'bg-surface-2 text-primary'
                                :   'text-text hover:bg-surface-2'
                            }`}
                        >
                            {item.label}
                        </Link>
                    );
                })}
            </div>
            {sections.map((section) => (
                <div key={section.label} className="border border-ghost bg-surface-1 p-3">
                    <div className="px-3 pb-2 font-mono text-small tracking-[1.5px] text-text-muted uppercase">
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
                                className={`block px-3 py-1.5 text-body ${
                                    isActive ?
                                        'bg-surface-2 text-primary'
                                    :   'text-text hover:bg-surface-2'
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
