// https://developers.google.com/search/docs/appearance/structured-data/faqpage
// https://developers.google.com/search/docs/appearance/structured-data/breadcrumb

export const metadata = {
    title: 'FAQ | Helldivers Bot',
    description:
        'Frequently asked questions about helldivers.bot, the Helldivers 1 API, and Discord bot.',
    alternates: { canonical: '/faq' },
    openGraph: { url: '/faq' },
};

export default function FaqPage() {
    return (
        <div className="gutters flex min-h-[50vh] flex-col items-center justify-center gap-4">
            <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--color-text)]">
                FAQ
            </h1>
            <p className="text-[var(--color-text-muted)]">
                All questions have been pre-answered by Super Earth High Command.
                Declassification pending security review.
            </p>
        </div>
    );
}
