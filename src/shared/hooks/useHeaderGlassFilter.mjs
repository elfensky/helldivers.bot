'use client';
import { useState, useEffect } from 'react';

/**
 * Returns the live value of the `--header-glass-filter` CSS custom
 * property on `<html>`, updated via MutationObserver whenever
 * `public/scripts/headerGPU.js` writes a new value.
 *
 * Why this hook exists: Lightning CSS (the Turbopack-integrated
 * optimizer) strips `backdrop-filter` declarations from stylesheets
 * that reference CSS variables — see the `v0.39.7` CHANGELOG entry
 * and the note in `src/features/dashboard/HomeClient.css` where the
 * map's `backdrop-filter: var(--header-glass-filter, none)` silently
 * drops out of the served CSS. The un-prefixed property must be
 * applied via inline `style={{}}` on the React component to bypass
 * the optimizer — which means the component needs a live value to
 * plug into that inline style. This hook reads the var on mount and
 * re-reads it whenever `<html>` 's `style` attribute changes, but
 * only re-renders the consumer when the value actually differs from
 * the last observed one (so the 60-fps `--header-bg` writes during
 * scroll don't cause unnecessary re-renders).
 *
 * Returns `'none'` when the var is not set (which is the case at
 * `<md` where `headerGPU.js` is inactive and the CSS fallback kicks
 * in).
 */
export function useHeaderGlassFilter() {
    const [filter, setFilter] = useState('none');

    useEffect(() => {
        let last = null;
        const read = () => {
            const val =
                getComputedStyle(document.documentElement)
                    .getPropertyValue('--header-glass-filter')
                    .trim() || 'none';
            if (val !== last) {
                last = val;
                setFilter(val);
            }
        };
        read();
        const observer = new MutationObserver(read);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['style'],
        });
        return () => observer.disconnect();
    }, []);

    return filter;
}
