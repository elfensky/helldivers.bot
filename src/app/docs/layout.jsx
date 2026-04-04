import DocsSidebar from './components/DocsSidebar';

const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
        {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://helldivers.bot',
        },
        {
            '@type': 'ListItem',
            position: 2,
            name: 'Docs',
            item: 'https://helldivers.bot/docs',
        },
    ],
};

export default function DocsLayout({ children }) {
    return (
        <div className="mx-auto min-h-[calc(100dvh-80px)] w-full max-w-[1536px] lg:grid lg:grid-cols-[calc(200px+6rem)_minmax(0,1fr)]">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
            />
            <DocsSidebar />
            <div className="px-4 py-8 sm:px-12 md:px-16 lg:pr-24 lg:pl-8">{children}</div>
        </div>
    );
}
