import { render } from '@testing-library/react';
import { page } from 'vitest/browser';
import { LiveDataContext } from '@/shared/providers/LiveDataContext.mjs';
import { liveStore } from './fixtures.mjs';

/**
 * Mount `ui` inside a live-data provider and a stable wrapper element.
 *
 * The wrapper — not the component — is what gets screenshotted, so no
 * production component needs a test id it would not otherwise have.
 *
 * @param {import('react').ReactNode} ui
 * @param {{store?: object}} [options]
 * @returns {{root: import('vitest/browser').Locator}}
 */
export function renderVisual(ui, { store = liveStore() } = {}) {
    render(
        <LiveDataContext.Provider value={store}>
            <div data-testid="visual-root">{ui}</div>
        </LiveDataContext.Provider>,
    );
    return { root: page.getByTestId('visual-root') };
}
