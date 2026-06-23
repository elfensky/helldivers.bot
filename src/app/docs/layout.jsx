import DocsSidebar from './components/DocsSidebar';
import { SITE_URL } from '@/config/site.mjs';
import JsonLd from '@/shared/components/JsonLd';

const structuredData = [
    {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        inLanguage: 'en',
        author: {
            '@type': 'Person',
            name: 'Andrei Lavrenov',
            url: 'https://lav.ren',
        },
        isPartOf: {
            '@type': 'WebSite',
            url: SITE_URL,
        },
    },
    {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            {
                '@type': 'ListItem',
                position: 1,
                name: 'Home',
                item: SITE_URL,
            },
            {
                '@type': 'ListItem',
                position: 2,
                name: 'Docs',
                item: `${SITE_URL}/docs`,
            },
        ],
    },
];

export default function DocsLayout({ children }) {
    return (
        <div className="mx-auto min-h-[calc(100dvh-80px)] w-full max-w-[1536px] lg:grid lg:grid-cols-[calc(200px+6rem)_minmax(0,1fr)]">
            <JsonLd data={structuredData} />
            <DocsSidebar />
            <div className="px-4 py-8 sm:px-12 md:px-16 lg:pr-24 lg:pl-8">{children}</div>
        </div>
    );
}
