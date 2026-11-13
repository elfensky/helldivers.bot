'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import Button from '@/shared/components/Button/Button';
import { readOptOut } from '@/shared/components/AnalyticsOptOut';
import {
    privacySignal,
    readReplayConsent,
    writeReplayConsent,
} from '@/features/consent/replayConsent.mjs';

/**
 * The Ministry of Truth recording prompt (#617): asks every visitor, like a
 * cookie prompt, before session replay may load. Non-modal, nothing pre-chosen,
 * and "Decline" is the same size and on the same screen as "Allow".
 *
 * It shows only where replay could run: no answer yet, not opted out of
 * counting, no GPC or DNT signal, and no account link on this page load (replay
 * never loads for a linked account). Blocked storage still shows it; a yes that
 * cannot be stored keeps replay off, because RecorderScript reads storage.
 * After "Allow", recording starts from the next page load.
 *
 * @param {object} props - Component props.
 * @param {boolean} [props.identified] - The account link is on for this page load.
 * @returns {import('react').ReactElement | null}
 */
export default function ReplayPrompt({ identified = false }) {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const check = async () => {
            const consent = await readReplayConsent();
            const optOut = await readOptOut();
            setOpen(
                !identified &&
                    !privacySignal() &&
                    optOut !== true &&
                    (consent === undefined || consent === null),
            );
        };
        check();
    }, [identified]);

    if (!open) return null;

    const answer = async (/** @type {'yes' | 'no'} */ value) => {
        await writeReplayConsent(value);
        setOpen(false);
    };

    return (
        <section
            role="region"
            aria-label="Recording consent"
            className="fixed inset-x-0 bottom-[48px] z-50 border-t border-primary bg-surface-1 md:bottom-0"
        >
            <div className="gutters mx-auto flex max-w-5xl flex-col gap-3 py-4 md:flex-row md:items-center md:gap-6">
                <div className="flex flex-col gap-1">
                    <h2 className="m-0 font-display text-body font-bold text-primary uppercase">
                        The Ministry of Truth requests your cooperation
                    </h2>
                    <p className="m-0 text-small text-text">
                        May we record this visit to see where the site is hard to use?
                        Text and everything you type are masked before anything leaves
                        your browser. Recordings are never linked to an account. You can
                        change this on the{' '}
                        <Link
                            href="/privacy"
                            prefetch={false}
                            data-umami-event="consent-replay-privacy"
                            className="text-primary hover:underline"
                        >
                            privacy page
                        </Link>
                        .
                    </p>
                </div>
                <div className="flex shrink-0 gap-3">
                    <Button
                        variant="primary"
                        size="lg"
                        onClick={() => answer('yes')}
                        data-umami-event="consent-replay-allow"
                    >
                        Allow recording
                    </Button>
                    <Button
                        variant="primary"
                        size="lg"
                        onClick={() => answer('no')}
                        data-umami-event="consent-replay-decline"
                    >
                        Decline
                    </Button>
                </div>
            </div>
        </section>
    );
}
