import { expect, test } from 'vitest';
import { page } from 'vitest/browser';
import EventCard from '@/features/galaxy/EventCard';
import { renderVisual } from './renderVisual.jsx';
import { FIXED_NOW, makeMapState } from './fixtures.mjs';

const NOW_S = Math.floor(FIXED_NOW / 1000);

test('attack event card', async () => {
    await page.viewport(420, 640);
    const { root } = renderVisual(
        <EventCard
            action="attacking"
            region="Region 3"
            percent={36}
            points={1_800_000}
            pointsMax={5_000_000}
            factionIndex={0}
            pace={{ status: 'ahead', delta: 12 }}
            endTime={NOW_S + 18 * 3600}
            barLabel="Liberation"
            view="sector"
            factionMap={makeMapState()[0]}
            eventEta={{
                mode: 'verdict',
                etaHours: 9,
                remainingHours: 18,
                onTrack: true,
                stalled: false,
            }}
        />,
    );
    await expect.element(root).toMatchScreenshot('event-card-attack');
});

test('defend event card', async () => {
    await page.viewport(420, 640);
    const { root } = renderVisual(
        <EventCard
            action="defending"
            region="Region 7"
            percent={72}
            points={3_600_000}
            pointsMax={5_000_000}
            factionIndex={2}
            pace={{ status: 'behind', delta: -8 }}
            endTime={NOW_S + 4 * 3600}
            barLabel="Defense"
            view="sector"
            factionMap={makeMapState()[2]}
            eventEta={{
                mode: 'verdict',
                etaHours: null,
                remainingHours: 4,
                onTrack: false,
                stalled: true,
            }}
        />,
    );
    await expect.element(root).toMatchScreenshot('event-card-defend');
});
