// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';

import RecorderScript from '@/shared/components/RecorderScript';
import { OPT_OUT_KEY } from '@/shared/components/AnalyticsOptOut';
import { REPLAY_CONSENT_KEY } from '@/features/consent/replayConsent.mjs';

vi.mock('next/script', () => ({
    default: ({ children, nonce, src, strategy, ...rest }) => (
        <script
            data-testid="next-script"
            data-nonce={String(nonce)}
            data-src={src}
            data-strategy={strategy}
            {...rest}
        >
            {children}
        </script>
    ),
}));

const flush = () => act(() => new Promise((r) => setTimeout(r, 0)));

describe('RecorderScript', () => {
    beforeEach(() => {
        localStorage.clear();
        localStorage.setItem(REPLAY_CONSENT_KEY, 'yes');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        delete navigator.globalPrivacyControl;
    });

    test('server render is empty', () => {
        expect(renderToString(<RecorderScript nonce="n" siteId="site" />)).toBe('');
    });

    test('renders the recorder after mount after a yes, without the opt-out flag', async () => {
        render(<RecorderScript nonce="abc" siteId="site-1" />);
        const script = await screen.findByTestId('next-script');
        expect(script).toHaveAttribute('data-src', '/recorder.js');
        expect(script).toHaveAttribute('data-nonce', 'abc');
        expect(script).toHaveAttribute('data-website-id', 'site-1');
        expect(script).toHaveAttribute('data-strategy', 'afterInteractive');
    });

    test.each(['1', 'true'])('renders nothing when the flag is %s', async (value) => {
        localStorage.setItem(OPT_OUT_KEY, value);
        render(<RecorderScript nonce="n" siteId="site" />);
        await flush();
        expect(screen.queryByTestId('next-script')).toBeNull();
    });

    test.each([
        ['no answer', null],
        ['a no', 'no'],
    ])('renders nothing with %s to the prompt', async (_, answer) => {
        if (answer) localStorage.setItem(REPLAY_CONSENT_KEY, answer);
        else localStorage.removeItem(REPLAY_CONSENT_KEY);
        render(<RecorderScript nonce="n" siteId="site" />);
        await flush();
        expect(screen.queryByTestId('next-script')).toBeNull();
    });

    test('renders nothing with the account link on, despite a yes', async () => {
        render(<RecorderScript nonce="n" siteId="site" identified />);
        await flush();
        expect(screen.queryByTestId('next-script')).toBeNull();
    });

    test('renders nothing with Global Privacy Control, despite a yes', async () => {
        Object.defineProperty(navigator, 'globalPrivacyControl', {
            value: true,
            configurable: true,
        });
        render(<RecorderScript nonce="n" siteId="site" />);
        await flush();
        expect(screen.queryByTestId('next-script')).toBeNull();
    });

    test('renders nothing when storage throws (fails closed)', async () => {
        vi.stubGlobal('localStorage', {
            getItem: () => {
                throw new Error('SecurityError');
            },
        });
        render(<RecorderScript nonce="n" siteId="site" />);
        await flush();
        expect(screen.queryByTestId('next-script')).toBeNull();
    });
});
