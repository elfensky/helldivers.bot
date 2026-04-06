'use client';

// Uses window.location.reload() instead of router.refresh() to avoid
// enqueueModel crashes caused by startTransition racing with RSC Flight
// stream processing.
export default function RefreshButton() {
    return (
        <button
            type="button"
            onClick={() => window.location.reload()}
            className="cursor-pointer border border-ghost px-2 py-0.5 text-small text-text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
        >
            Refresh
        </button>
    );
}
