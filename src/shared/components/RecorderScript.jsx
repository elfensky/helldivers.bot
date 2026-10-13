'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

import { readOptOut } from '@/shared/components/AnalyticsOptOut';

/**
 * Loads recorder.js (session replay + heatmaps) unless the browser opted out.
 *
 * recorder.js has no opt-out check of its own, so this gate keeps it from
 * loading at all. The key is read after mount, so the server render and the
 * first client render are both empty. Blocked storage keeps the recorder off
 * (fail closed). A change made on the current page applies from the next full
 * page load.
 *
 * @param {object} props - Component props.
 * @param {string} [props.nonce] - CSP nonce for the script tag.
 * @param {string} [props.siteId] - Umami website id.
 * @returns {import('react').ReactElement | null}
 */
export default function RecorderScript({ nonce, siteId }) {
    const [allowed, setAllowed] = useState(false);

    useEffect(() => {
        const check = async () => setAllowed((await readOptOut()) === false);
        check();
    }, []);

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
