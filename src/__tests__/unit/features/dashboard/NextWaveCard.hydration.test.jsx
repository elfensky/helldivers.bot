// @vitest-environment jsdom
// src/__tests__/unit/features/dashboard/NextWaveCard.hydration.test.jsx
//
// #496 asked whether the counterattack line is hydration-safe. It renders
// time-dependent text (`localTime` uses the runtime locale AND the runtime
// timezone), so server and client disagree whenever the visitor is not in the
// server's timezone. It carries `suppressHydrationWarning` — but the span has
// TWO adjacent text children ({lead}{tail}), and suppression is documented as
// covering direct text children, so it was unclear whether it actually holds.
//
// This asserts it does: SSR one clock, hydrate a different one, expect React
// to report no recoverable hydration error.
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { act } from 'react';
import NextWaveCard from '@/features/dashboard/NextWaveCard';

const NOW = 1_700_000_000;

const clockCounter = (at) => ({ mode: 'clock', at, pace: 'on_track' });
const hiddenForecast = { mode: 'hidden', reason: 'assault-active' };

/**
 * SSR with one counterattack timestamp, hydrate with another, and collect
 * every recoverable error React reports.
 *
 * @param {number} serverAt
 * @param {number} clientAt
 * @returns {Promise<Error[]>}
 */
async function hydrateMismatched(serverAt, clientAt) {
    const html = renderToString(
        <NextWaveCard
            forecast={hiddenForecast}
            counter={clockCounter(serverAt)}
            warStart={NOW - 12 * 86400}
            now={NOW}
        />,
    );

    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);

    /** @type {Error[]} */
    const recoverable = [];
    await act(async () => {
        hydrateRoot(
            container,
            <NextWaveCard
                forecast={hiddenForecast}
                counter={clockCounter(clientAt)}
                warStart={NOW - 12 * 86400}
                now={NOW}
            />,
            { onRecoverableError: (e) => recoverable.push(/** @type {Error} */ (e)) },
        );
    });
    return recoverable;
}

describe('NextWaveCard counterattack line — hydration', () => {
    it('renders the clock text on the server at all', () => {
        const html = renderToString(
            <NextWaveCard
                forecast={hiddenForecast}
                counter={clockCounter(NOW + 20 * 3600)}
                warStart={NOW - 12 * 86400}
                now={NOW}
            />,
        );
        // Guard: if this stops matching, the test below is vacuous.
        expect(html).toContain('counterattack');
    });

    it('suppresses the mismatch even with two adjacent text children', async () => {
        // 8h apart — guarantees a different weekday/hour string.
        const errors = await hydrateMismatched(NOW + 20 * 3600, NOW + 28 * 3600);
        const hydrationErrors = errors.filter((e) => /hydrat/i.test(e.message));
        expect(hydrationErrors).toEqual([]);
    });

    // Control. Without this the test above passes even if the harness is
    // incapable of observing a mismatch at all.
    it('control: the same shape WITHOUT suppression does report a mismatch', async () => {
        const Unsuppressed = ({ a, b }) => (
            <span>
                {a}
                {b}
            </span>
        );
        const html = renderToString(
            <Unsuppressed a="assault on pace" b=" · counterattack Tue 14:00" />,
        );
        const container = document.createElement('div');
        container.innerHTML = html;
        document.body.appendChild(container);

        /** @type {Error[]} */
        const recoverable = [];
        await act(async () => {
            hydrateRoot(
                container,
                <Unsuppressed a="assault on pace" b=" · counterattack Wed 22:00" />,
                {
                    onRecoverableError: (e) => recoverable.push(/** @type {Error} */ (e)),
                },
            );
        });

        expect(recoverable.some((e) => /hydrat/i.test(e.message))).toBe(true);
    });
});
