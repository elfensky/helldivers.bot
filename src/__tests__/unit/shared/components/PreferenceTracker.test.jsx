// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';

import PreferenceTracker from '@/shared/components/PreferenceTracker';
import { REPLAY_CONSENT_KEY } from '@/features/consent/replayConsent.mjs';

const flush = () => act(() => new Promise((r) => setTimeout(r, 0)));

describe('PreferenceTracker', () => {
    let track;

    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        track = vi.fn();
        window.umami = { track };
    });

    afterEach(() => {
        delete window.umami;
        delete navigator.globalPrivacyControl;
    });

    test('sends nothing and writes no session storage without a yes', async () => {
        render(<PreferenceTracker />);
        await flush();
        expect(track).not.toHaveBeenCalled();
        expect(sessionStorage.length).toBe(0);
    });

    test('sends one snapshot per session after a yes', async () => {
        localStorage.setItem(REPLAY_CONSENT_KEY, 'yes');
        const { unmount } = render(<PreferenceTracker />);
        await flush();
        unmount();
        render(<PreferenceTracker />);
        await flush();
        expect(track).toHaveBeenCalledTimes(1);
        expect(track).toHaveBeenCalledWith('preference-snapshot', expect.any(Object));
    });

    test('sends nothing with the account link on, despite a yes', async () => {
        localStorage.setItem(REPLAY_CONSENT_KEY, 'yes');
        render(<PreferenceTracker identified />);
        await flush();
        expect(track).not.toHaveBeenCalled();
    });

    test('sends nothing with Global Privacy Control, despite a yes', async () => {
        localStorage.setItem(REPLAY_CONSENT_KEY, 'yes');
        Object.defineProperty(navigator, 'globalPrivacyControl', {
            value: true,
            configurable: true,
        });
        render(<PreferenceTracker />);
        await flush();
        expect(track).not.toHaveBeenCalled();
        expect(sessionStorage.length).toBe(0);
    });
});
