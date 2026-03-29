import Link from 'next/link';

// read more:
// https://nextjs.org/docs/app/api-reference/file-conventions/not-found

export default function NotFound() {
    return (
        <div className="gutters flex min-h-[50vh] flex-col items-center justify-center gap-4">
            <h1 className="text-3xl font-[family-name:var(--font-display)] text-[var(--color-text)]">
                Not Found
            </h1>
            <p className="text-[var(--color-text-muted)]">
                Could not find requested resource
            </p>
            <Link
                href="/"
                className="text-[var(--color-primary)] hover:underline"
            >
                Return Home
            </Link>
        </div>
    );
}
