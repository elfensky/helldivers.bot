import { expect, test } from 'vitest';
import { page } from 'vitest/browser';
import StatGrid from '@/features/stats/StatGrid';
import { renderVisual } from './renderVisual.jsx';
import { FIXED_NOW, makeEvent, makeStatRow } from './fixtures.mjs';

const NOW_S = Math.floor(FIXED_NOW / 1000);
const WAR_START = NOW_S - 30 * 24 * 3600;

const live = [makeStatRow(0), makeStatRow(1), makeStatRow(2)];
const events = [
    makeEvent({ status: 'success', enemy: 0 }),
    makeEvent({ status: 'success', enemy: 0, region: 5 }),
    makeEvent({ status: 'fail', enemy: 1, region: 8 }),
];

// `playersAvg24h` is keyed by faction (plus `global`); `killsTrend` values are
// `{ago24h, ago48h}` cumulative kill counts — see the subtitle helpers in
// StatGrid.jsx.
const playersAvg24h = { global: 11_500 };
const killsTrend = { global: { ago24h: 880_000_000, ago48h: 840_000_000 } };

test('stat grid — global', async () => {
    await page.viewport(1280, 800);
    const { root } = renderVisual(
        <StatGrid
            live={live}
            faction="global"
            events={events}
            playersAvg24h={playersAvg24h}
            killsTrend={killsTrend}
            seasonDuration={30 * 24 * 3600}
            warStart={WAR_START}
        />,
    );
    await expect.element(root).toMatchScreenshot('stat-grid-global');
});
