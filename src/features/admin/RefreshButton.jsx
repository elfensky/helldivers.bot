'use client';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export default function RefreshButton() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    return (
        <button
            type="button"
            onClick={() => startTransition(() => router.refresh())}
            disabled={isPending}
            className="cursor-pointer border border-ghost px-2 py-0.5 text-xs text-text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
        >
            {isPending ? 'Refreshing...' : 'Refresh'}
        </button>
    );
}
