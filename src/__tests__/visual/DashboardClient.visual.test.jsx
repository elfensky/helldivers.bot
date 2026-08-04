import { beforeEach, expect, test } from 'vitest';
import { page } from 'vitest/browser';
import DashboardClient from '@/features/dashboard/DashboardClient';
import { renderVisual } from './renderVisual.jsx';
import { liveStore, makeEvent } from './fixtures.mjs';

const base = liveStore();
const store = {
    ...base,
    data: {
        ...base.data,
        events: [makeEvent(), makeEvent({ type: 'defend', enemy: 2, region: 7 })],
    },
};

// DashboardClient persists the faction tab and regions view through
// usePersistedState → localStorage. Without this, one test's tab selection
// leaks into the next test's screenshot.
beforeEach(() => localStorage.clear());

test('dashboard — desktop', async () => {
    await page.viewport(1280, 800);
    const { root } = renderVisual(
        <DashboardClient initialFaction="global" initialRegionsView="sector" />,
        { store },
    );
    await expect.element(root).toMatchScreenshot('dashboard-desktop');
});

test('dashboard — mobile', async () => {
    await page.viewport(390, 844);
    const { root } = renderVisual(
        <DashboardClient initialFaction="global" initialRegionsView="sector" />,
        { store },
    );
    await expect.element(root).toMatchScreenshot('dashboard-mobile');
});
