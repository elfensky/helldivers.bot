// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import AnalyticsOptOut from '@/shared/components/AnalyticsOptOut';

const KEY = 'umami.disabled';

describe('AnalyticsOptOut', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    test('starts opted in with the disable button', async () => {
        render(<AnalyticsOptOut />);
        expect(
            await screen.findByRole('button', { name: 'Disable transponder' }),
        ).toBeInTheDocument();
        expect(screen.getByText('Currently counted.')).toBeInTheDocument();
    });

    test('click sets the flag, a second click clears it', async () => {
        const user = userEvent.setup();
        render(<AnalyticsOptOut />);

        await user.click(
            await screen.findByRole('button', { name: 'Disable transponder' }),
        );
        const off = await screen.findByRole('button', {
            name: 'Transponder off — re-enable',
        });
        expect(localStorage.getItem(KEY)).toBe('1');
        expect(
            screen.getByText(
                'Opted out. From the next page load, this browser transmits no analytics.',
            ),
        ).toBeInTheDocument();

        await user.click(off);
        expect(
            await screen.findByRole('button', { name: 'Disable transponder' }),
        ).toBeInTheDocument();
        expect(localStorage.getItem(KEY)).toBeNull();
    });

    test('starts opted out when the flag is already set', async () => {
        localStorage.setItem(KEY, '1');
        render(<AnalyticsOptOut />);
        expect(
            await screen.findByRole('button', { name: 'Transponder off — re-enable' }),
        ).toBeInTheDocument();
    });

    test('shows the blocked-storage message and no button when storage throws', async () => {
        vi.stubGlobal('localStorage', {
            getItem: () => {
                throw new Error('SecurityError');
            },
        });
        render(<AnalyticsOptOut />);
        expect(await screen.findByText(/blocks local storage/)).toBeInTheDocument();
        expect(screen.queryByRole('button')).toBeNull();
    });

    test('the button carries the umami event name', async () => {
        render(<AnalyticsOptOut />);
        const button = await screen.findByRole('button', { name: 'Disable transponder' });
        expect(button).toHaveAttribute('data-umami-event', 'legal-analytics-toggle');
    });
});
