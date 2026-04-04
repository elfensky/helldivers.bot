import DocsSidebar from './components/DocsSidebar';

export default function DocsLayout({ children }) {
    return (
        <div className="mx-auto min-h-[calc(100dvh-80px)] max-w-[1536px] lg:grid lg:grid-cols-[calc(200px+6rem)_minmax(0,1fr)]">
            <DocsSidebar />
            <div className="px-4 py-8 sm:px-12 md:px-16 lg:pl-8 lg:pr-24">{children}</div>
        </div>
    );
}
