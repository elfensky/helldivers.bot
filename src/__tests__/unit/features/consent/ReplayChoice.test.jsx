// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/features/consent/reloadDocument.mjs', () => ({
    reloadDocument: vi.fn(),
}));

import ReplayChoice from '@/features/consent/ReplayChoice';
import { REPLAY_CONSENT_KEY } from '@/features/consent/replayConsent.mjs';
import { reloadDocument } from '@/features/consent/reloadDocument.mjs';
import { GUARD_KEY } from '@/shared/utils/reloadGuard.mjs';

describe('ReplayChoice', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        delete navigator.globalPrivacyControl;
    });

    test.each([
        ['no answer', null],
        ['a no', 'no'],
    ])('shows "Recording: off" for %s', async (_, stored) => {
        if (stored) localStorage.setItem(REPLAY_CONSENT_KEY, stored);
        render(<ReplayChoice />);
        expect(await screen.findByText('Recording: off.')).toBeInTheDocument();
        expect(screen.getByRole('button')).toHaveTextContent('Allow session recording');
    });

    test('switching on stores a yes and keeps the page', async () => {
        render(<ReplayChoice />);
        fireEvent.click(await screen.findByRole('button'));
        expect(await screen.findByText('Recording: on.')).toBeInTheDocument();
        expect(localStorage.getItem(REPLAY_CONSENT_KEY)).toBe('yes');
        expect(reloadDocument).not.toHaveBeenCalled();
    });

    test('switching off stores a no and ends the document, even with a spent reload guard', async () => {
        localStorage.setItem(REPLAY_CONSENT_KEY, 'yes');
        localStorage.setItem(GUARD_KEY, `version:${Date.now()}:3`);
        render(<ReplayChoice />);
        expect(await screen.findByText('Recording: on.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
        await waitFor(() => expect(reloadDocument).toHaveBeenCalledTimes(1));
        expect(localStorage.getItem(REPLAY_CONSENT_KEY)).toBe('no');
    });

    test('with GPC it says recording never runs and offers no button', async () => {
        Object.defineProperty(navigator, 'globalPrivacyControl', {
            value: true,
            configurable: true,
        });
        render(<ReplayChoice />);
        expect(await screen.findByText(/privacy signal/)).toBeInTheDocument();
        expect(screen.queryByRole('button')).toBeNull();
    });

    test('with blocked storage it says a yes cannot be stored', async () => {
        vi.stubGlobal('localStorage', {
            getItem: () => {
                throw new Error('SecurityError');
            },
        });
        render(<ReplayChoice />);
        expect(await screen.findByText(/blocks local storage/)).toBeInTheDocument();
        expect(screen.queryByRole('button')).toBeNull();
    });
});
