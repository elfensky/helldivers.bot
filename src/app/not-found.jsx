import Link from 'next/link';

// read more:
// https://nextjs.org/docs/app/api-reference/file-conventions/not-found

export default function NotFound() {
    return (
        <div className="gutters flex min-h-[50vh] flex-col items-center justify-center gap-4">
            <h1 className="font-display text-text">SECTOR NOT FOUND</h1>
            <p className="text-text-muted">
                This area has been classified by Super Earth High Command. It either never
                existed, or has been redacted for your safety.
            </p>
            <p className="text-small text-text-muted italic">
                This incident has been logged.
            </p>
            <Link
                href="/"
                prefetch={false}
                data-umami-event="nav-404-home"
                className="inline-block cursor-pointer border border-primary px-3 py-1.5 font-body text-small font-bold tracking-[0.02em] text-primary uppercase hover:bg-primary hover:text-surface-0"
            >
                Resume approved Super Earth broadcast
            </Link>
        </div>
    );
}
