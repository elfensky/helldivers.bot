/**
 * Generic page-load skeleton — the Suspense fallback Next.js renders from a
 * route's `loading.jsx` while that route's server component streams, so
 * navigation gives instant feedback instead of a frozen page. Purely
 * decorative: `aria-hidden`, no semantic content, and the pulse animation is
 * dropped under `prefers-reduced-motion`.
 */
export default function PageSkeleton() {
    return (
        <div className="gutters flex w-full flex-col gap-4 py-8" aria-hidden="true">
            <div className="h-9 w-2/3 max-w-md animate-pulse bg-surface-2 motion-reduce:animate-none" />
            <div className="flex flex-col gap-2">
                <div className="h-4 w-full animate-pulse bg-surface-1 motion-reduce:animate-none" />
                <div className="h-4 w-5/6 animate-pulse bg-surface-1 motion-reduce:animate-none" />
            </div>
            <div className="h-72 w-full animate-pulse bg-surface-1 motion-reduce:animate-none" />
        </div>
    );
}
