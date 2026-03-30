// https://developers.google.com/search/docs/appearance/structured-data/faqpage
// https://developers.google.com/search/docs/appearance/structured-data/breadcrumb

export const metadata = {
    title: 'FAQ | Helldivers Bot',
    description:
        'Frequently asked questions about helldivers.bot, the Helldivers 1 API, and Discord bot.',
};

export default function FaqPage() {
    return (
        <div className="gutters flex min-h-[50vh] flex-col items-center justify-center gap-4">
            <h1 className="text-3xl font-[family-name:var(--font-display)] text-[var(--color-text)]">
                FAQ
            </h1>
            <p className="text-[var(--color-text-muted)]">Coming Soon</p>
        </div>
    );
}
