import DocsSidebar from './components/DocsSidebar';

export default function DocsLayout({ children }) {
    return (
        <div className="min-h-[calc(100dvh-80px)] lg:grid lg:grid-cols-[200px_minmax(0,1fr)]">
            <DocsSidebar />
            <div className="gutters py-8">{children}</div>
        </div>
    );
}
