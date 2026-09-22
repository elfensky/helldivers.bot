'use client';

import { useCallback, useEffect, useState } from 'react';

const KEY = 'umami.disabled';

/**
 * Opt-out switch for the self-hosted Umami tracker.
 *
 * The tracker checks `localStorage.umami.disabled` before every send and bails
 * when it is set, so flipping this key is the whole mechanism — there is no
 * server-side list. This is also the only value the analytics stack ever writes
 * to the visitor's device, which is why the terminal needs no consent banner.
 *
 * `null` means storage threw (private mode, blocked site data); the control
 * reports that instead of pretending the choice was saved.
 *
 * @returns {import('react').ReactElement}
 */
export default function AnalyticsOptOut() {
    const [optedOut, setOptedOut] = useState(/** @type {boolean | null} */ (false));
    const [ready, setReady] = useState(false);

    const read = useCallback(() => {
        try {
            return localStorage.getItem(KEY) === '1';
        } catch {
            return null;
        }
    }, []);

    useEffect(() => {
        setOptedOut(read());
        setReady(true);
    }, [read]);

    const toggle = useCallback(() => {
        try {
            if (read()) localStorage.removeItem(KEY);
            else localStorage.setItem(KEY, '1');
        } catch {
            /* read() below reports the failure */
        }
        setOptedOut(read());
    }, [read]);

    if (!ready) {
        return <p className="text-small text-text-muted">Checking transponder status…</p>;
    }

    if (optedOut === null) {
        return (
            <p className="text-small text-text-muted">
                This browser blocks local storage, so the opt-out cannot be recorded here.
                Blocking requests to the analytics host achieves the same result.
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <button
                type="button"
                onClick={toggle}
                className="hover:text-bg w-fit cursor-pointer border border-primary px-4 py-2 font-display text-small text-primary uppercase transition-colors hover:bg-primary"
            >
                {optedOut ? 'Transponder off — re-enable' : 'Disable transponder'}
            </button>
            <p className="text-small text-text-muted" aria-live="polite">
                {optedOut ?
                    'Opted out. This browser transmits no analytics.'
                :   'Currently counted, anonymously.'}
            </p>
        </div>
    );
}
