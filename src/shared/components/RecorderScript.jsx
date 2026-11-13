'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

import { replayAllowed } from '@/features/consent/replayConsent.mjs';

/**
 * Loads recorder.js (session replay + heatmaps) only after the visitor said yes
 * to the Ministry of Truth prompt (#617).
 *
 * recorder.js has no consent or opt-out check of its own, so this gate keeps it
 * from loading at all. It stays off for an opted-out browser, with a GPC or DNT
 * signal, and on a page load with the account link on (replay and identity
 * never share a page load). The keys are read after mount, so the server render
 * and the first client render are both empty. Blocked storage keeps the
 * recorder off (fail closed). A change made on the current page applies from
 * the next full page load.
 *
 * @param {object} props - Component props.
 * @param {string} [props.nonce] - CSP nonce for the script tag.
 * @param {string} [props.siteId] - Umami website id.
 * @param {boolean} [props.identified] - The account link is on for this page load.
 * @returns {import('react').ReactElement | null}
 */
export default function RecorderScript({ nonce, siteId, identified = false }) {
    const [allowed, setAllowed] = useState(false);

    useEffect(() => {
        const check = async () => setAllowed(await replayAllowed(identified));
        check();
    }, [identified]);

    if (!allowed) return null;

    return (
        <Script
            nonce={nonce}
            src="/recorder.js"
            data-website-id={siteId}
            strategy="afterInteractive"
        />
    );
}
