// @vitest-environment jsdom
// src/__tests__/unit/features/galaxy/DefeatedCard.hydration.test.jsx
//
// #496: DefeatedCard renders on the dashboard (DashboardClient.jsx) and formats
// its date with a pinned LOCALE but no pinned TIMEZONE, and carries no
// `suppressHydrationWarning`. Production renders in UTC; a visitor in any other
// zone re-renders the same instant in their own zone. Whenever `endTime` falls
// near a local date boundary the two disagree and React throws #418.
//
// Same props both times — only the timezone differs, exactly as in production.
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { act } from 'react';
import DefeatedCard from '@/features/galaxy/DefeatedCard';

// 2025-07-23 22:13:20 UTC — late evening UTC, so any zone east of ~UTC+2
// has already rolled over to the 24th.
const END_TIME = 1753309_000;
const START_TIME = END_TIME - 36 * 3600;

/**
 * Render the card in `serverTz`, hydrate the identical element in `clientTz`,
 * and return every recoverable error React reports.
 *
 * @param {string} serverTz
 * @param {string} clientTz
 * @returns {Promise<Error[]>}
 */
async function hydrateAcrossTimezones(serverTz, clientTz) {
    const element = (
        <DefeatedCard
            factionIndex={1}
            startTime={START_TIME}
            endTime={END_TIME}
            view="sector"
        />
    );

    const original = process.env.TZ;
    process.env.TZ = serverTz;
    const html = renderToString(element);

    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);

    process.env.TZ = clientTz;
    /** @type {Error[]} */
    const recoverable = [];
    await act(async () => {
        hydrateRoot(container, element, {
            onRecoverableError: (e) => recoverable.push(/** @type {Error} */ (e)),
        });
    });
    process.env.TZ = original;

    return recoverable.filter((e) => /hydrat/i.test(e.message));
}

describe('DefeatedCard — hydration across timezones', () => {
    it('guard: the chosen instant really does straddle a date boundary', () => {
        const original = process.env.TZ;
        const fmt = () =>
            new Date(END_TIME * 1000).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            });
        process.env.TZ = 'UTC';
        const utc = fmt();
        process.env.TZ = 'Europe/Warsaw';
        const warsaw = fmt();
        process.env.TZ = original;
        expect(utc).not.toBe(warsaw);
    });

    it('does not throw a hydration mismatch for a UTC server and a Warsaw visitor', async () => {
        // The reporters in #496 are Europe/Warsaw; production renders in UTC.
        const errors = await hydrateAcrossTimezones('UTC', 'Europe/Warsaw');
        expect(errors).toEqual([]);
    });

    it('does not throw for a visitor in the same zone as the server', async () => {
        const errors = await hydrateAcrossTimezones('UTC', 'UTC');
        expect(errors).toEqual([]);
    });
});
