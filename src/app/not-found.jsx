import Link from 'next/link';

// read more:
// https://nextjs.org/docs/app/api-reference/file-conventions/not-found

export default function NotFound() {
    return (
        <div className="gutters flex min-h-[50vh] flex-col items-center justify-center gap-4">
            <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--color-text)]">
                SECTOR NOT FOUND
            </h1>
            <p className="text-[var(--color-text-muted)]">
                This area has been classified by Super Earth High Command. It either never
                existed, or has been redacted for your safety.
            </p>
            <Link href="/" prefetch={false} className="text-[var(--color-primary)] hover:underline">
                Return to Managed Democracy →
            </Link>
        </div>
    );
}
