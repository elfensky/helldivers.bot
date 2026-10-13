'use client';

import { useEffect, useState } from 'react';

import { tryCatch } from '@/shared/utils/tryCatch.mjs';

const KEY = 'umami.disabled';

/**
 * Reads the flag; `null` when storage throws. Wrapped in a promise because
 * `tryCatch` only takes promises.
 *
 * @returns {Promise<boolean | null>} Whether the visitor opted out.
 */
async function readOptOut() {
    const { data, error } = await tryCatch(
        Promise.resolve().then(() => localStorage.getItem(KEY) === '1'),
    );
    return error ? null : data;
}

/**
 * Sets or clears the flag. The result is ignored: the `readOptOut` after the
 * write reports a failure.
 *
 * @param {boolean} optOut - True to set the flag, false to clear it.
 */
async function writeOptOut(optOut) {
    await tryCatch(
        Promise.resolve().then(() =>
            optOut ? localStorage.setItem(KEY, '1') : localStorage.removeItem(KEY),
        ),
    );
}

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

    useEffect(() => {
        readOptOut().then((value) => {
            setOptedOut(value);
            setReady(true);
        });
    }, []);

    const toggle = async () => {
        await writeOptOut(!(await readOptOut()));
        setOptedOut(await readOptOut());
    };

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
                data-umami-event="legal-analytics-toggle"
                className="hover:text-bg w-fit cursor-pointer border border-primary px-4 py-2 font-display text-small text-primary uppercase transition-colors hover:bg-primary"
            >
                {optedOut ? 'Transponder off — re-enable' : 'Disable transponder'}
            </button>
            <p className="text-small text-text-muted" aria-live="polite">
                {optedOut ?
                    'Opted out. From the next page load, this browser transmits no analytics.'
                :   'Currently counted.'}
            </p>
        </div>
    );
}
