'use client';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { useMinistryContext } from '@/features/ministry/MinistryContext.mjs';
import Button from '@/shared/components/Button/Button';

/**
 * Floating admin-only trigger for the Ministry Interference easter egg.
 *
 * Mounted globally in `src/app/layout.jsx` so it follows the admin to every
 * page; clicking it fires `forceHijack()` on the FIRST eligible Hijackable
 * registered on the current page. Pages with no Hijackables surface a toast
 * explaining why nothing happened.
 *
 * @param {object} props Component props
 * @param {boolean} props.isAdmin Server-resolved admin gate; widget renders null when false.
 */
export default function MinistryTriggerWidget({ isAdmin }) {
    const ministry = useMinistryContext();

    const handleClick = useCallback(() => {
        if (!ministry) {
            toast.error('Ministry context unavailable');
            return;
        }
        const fired = ministry.forceHijack();
        if (fired) {
            toast.success('Hijack triggered');
            return;
        }
        if (ministry.warTone === null) {
            toast.error('Ministry disabled — no war tone resolved');
            return;
        }
        toast.error('No eligible Hijackable on this page');
    }, [ministry]);

    if (!isAdmin) return null;

    return (
        <div className="fixed right-4 bottom-14 z-50 border border-ghost bg-surface-1 p-1 md:bottom-4">
            <Button onClick={handleClick} data-umami-event="debug-trigger-hijack">
                Trigger Ministry
            </Button>
        </div>
    );
}
