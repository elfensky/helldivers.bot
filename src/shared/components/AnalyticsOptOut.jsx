'use client';

import { useEffect, useState } from 'react';

import { tryCatch } from '@/shared/utils/tryCatch.mjs';

export const OPT_OUT_KEY = 'umami.disabled';

/**
 * Reads the flag; any non-empty value counts, as in the tracker. Wrapped in a
 * promise because `tryCatch` only takes promises.
 *
 * @returns {Promise<boolean | null>} Whether the visitor opted out; `null` when
 *   storage threw (never `false`, so callers can fail closed).
 */
export async function readOptOut() {
    const { data, error } = await tryCatch(
        Promise.resolve().then(() => Boolean(localStorage.getItem(OPT_OUT_KEY))),
    );
    return error ? null : data;
}

/**
 * Sets or clears the flag.
 *
 * @param {boolean} optOut - True to set the flag, false to clear it.
 * @returns {Promise<boolean>} True when the write succeeded, false when storage threw.
 */
async function writeOptOut(optOut) {
    const { error } = await tryCatch(
        Promise.resolve().then(() =>
            optOut ?
                localStorage.setItem(OPT_OUT_KEY, '1')
            :   localStorage.removeItem(OPT_OUT_KEY),
        ),
    );
    return !error;
}

/**
 * Opt-out switch for the self-hosted Umami analytics.
 *
 * The tracker checks `OPT_OUT_KEY` before every send and sends nothing while
 * the key is set. recorder.js has no check of its own, so `RecorderScript`
 * does not render it for an opted-out browser. A change made on the current
 * page applies fully from the next page load: a recorder that is already
 * running keeps its session in memory until then. This key is the only value
 * the analytics stack writes to the visitor's device.
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
        const saved = await writeOptOut(!(await readOptOut()));
        // A failed save shows the blocked-storage message, not the old state.
        setOptedOut(saved ? await readOptOut() : null);
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
