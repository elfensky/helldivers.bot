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
            <a href="/" className="text-primary hover:underline">
                Return to Managed Democracy →
            </a>
        </div>
    );
}
