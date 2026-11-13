// @vitest-environment jsdom
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';

import ReplayPrompt from '@/features/consent/ReplayPrompt';
import { REPLAY_CONSENT_KEY } from '@/features/consent/replayConsent.mjs';
import { OPT_OUT_KEY } from '@/shared/components/AnalyticsOptOut';

const flush = () => act(() => new Promise((r) => setTimeout(r, 0)));

describe('ReplayPrompt', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        delete navigator.globalPrivacyControl;
    });

    test('asks a visitor who has not answered', async () => {
        render(<ReplayPrompt />);
        expect(
            await screen.findByRole('region', { name: 'Recording consent' }),
        ).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'privacy page' })).toHaveAttribute(
            'href',
            '/privacy',
        );
    });

    test.each([
        ['an answer exists', () => localStorage.setItem(REPLAY_CONSENT_KEY, 'no')],
        [
            'the browser opted out of counting',
            () => localStorage.setItem(OPT_OUT_KEY, '1'),
        ],
        [
            'the browser sends GPC',
            () =>
                Object.defineProperty(navigator, 'globalPrivacyControl', {
                    value: true,
                    configurable: true,
                }),
        ],
    ])('stays hidden when %s', async (_, arrange) => {
        arrange();
        render(<ReplayPrompt />);
        await flush();
        expect(screen.queryByRole('region')).toBeNull();
    });

    test('stays hidden with the account link on', async () => {
        render(<ReplayPrompt identified />);
        await flush();
        expect(screen.queryByRole('region')).toBeNull();
    });

    test('"Decline" is as prominent as "Allow": same classes, same container', async () => {
        render(<ReplayPrompt />);
        const allow = await screen.findByRole('button', { name: 'Allow recording' });
        const decline = screen.getByRole('button', { name: 'Decline' });
        expect(decline.className).toBe(allow.className);
        expect(decline.parentElement).toBe(allow.parentElement);
        expect(screen.queryByRole('checkbox')).toBeNull();
        expect(allow).toHaveAttribute('data-umami-event', 'consent-replay-allow');
        expect(decline).toHaveAttribute('data-umami-event', 'consent-replay-decline');
    });

    test.each([
        ['Allow recording', 'yes'],
        ['Decline', 'no'],
    ])('"%s" stores %s and closes the prompt', async (name, stored) => {
        render(<ReplayPrompt />);
        fireEvent.click(await screen.findByRole('button', { name }));
        await flush();
        expect(localStorage.getItem(REPLAY_CONSENT_KEY)).toBe(stored);
        expect(screen.queryByRole('region')).toBeNull();
    });
});
