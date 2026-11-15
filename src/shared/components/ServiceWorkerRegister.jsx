'use client';

import { useEffect } from 'react';

import { reportError } from '@/shared/utils/observability.mjs';

/**
 * Registers the Serwist worker, `public/sw.js`. Configurator mode
 * (`serwist build`) builds the worker but registers nothing (#670).
 *
 * Not `SerwistProvider` (`@serwist/next/react`): by default it adds an
 * unguarded `location.reload()` on `online` (AGENTS.md: `guardedReload()`
 * only), registers a module worker, and messages the worker on every client
 * navigation, so the worker fetches each page a second time.
 *
 * Production only: `next dev` has no current build of `public/sw.js`.
 *
 * @returns {null}
 */
export default function ServiceWorkerRegister() {
    useEffect(() => {
        if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator))
            return;
        navigator.serviceWorker.register('/sw.js').catch((error) => {
            // Blocked site data rejects with a SecurityError: expected, no report.
            if (error?.name === 'SecurityError') return;
            reportError(error, { source: 'sw-register', level: 'warning' });
        });
    }, []);

    return null;
}
