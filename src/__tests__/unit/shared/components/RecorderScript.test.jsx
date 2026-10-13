// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';

import RecorderScript from '@/shared/components/RecorderScript';
import { OPT_OUT_KEY } from '@/shared/components/AnalyticsOptOut';

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
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    test('server render is empty', () => {
        expect(renderToString(<RecorderScript nonce="n" siteId="site" />)).toBe('');
    });

    test('renders the recorder after mount when the flag is not set', async () => {
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
