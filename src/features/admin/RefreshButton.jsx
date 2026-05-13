'use client';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import Button from '@/shared/components/Button/Button';

export default function RefreshButton() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    return (
        <Button
            onClick={() => startTransition(() => router.refresh())}
            disabled={isPending}
        >
            {isPending ? 'Refreshing...' : 'Refresh'}
        </Button>
    );
}
