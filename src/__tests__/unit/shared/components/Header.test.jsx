// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Capture-style Script mock: records the props (nonce + src + strategy) so we
// can assert Header is wiring the nonce through correctly — this is the
// security-relevant part (CSP nonce must flow from next/headers to <Script>).
// We deliberately serialise `nonce` via String() so `undefined` shows as
// "undefined" and absence is observable — otherwise the mock's defaulting
// would be what the test asserts, instead of Header's wiring.
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

// Navigation has its own tests; stub it here at the boundary so Header's
// assertions stay focused on Header's own responsibilities.
vi.mock('@/shared/components/Navigation/Navigation', () => ({
    default: () => <nav data-testid="navigation-stub" />,
}));

const headersGet = vi.fn();
vi.mock('next/headers', () => ({
    headers: vi.fn(() =>
        Promise.resolve({
            get: headersGet,
        }),
    ),
}));

import Header from '@/shared/components/Header/Header';

beforeEach(() => {
    headersGet.mockReset();
    headersGet.mockImplementation((key) => (key === 'x-nonce' ? 'test-nonce' : null));
});

describe('Header — layout & landmark', () => {
    test('renders a single <header> landmark with id="header" and fixed layout classes', async () => {
        const { container } = render(await Header());
        const header = container.querySelector('header');
        expect(header).toBeInTheDocument();
        expect(header.id).toBe('header');
        expect(header.className).toMatch(/\bfixed\b/);
        expect(header.className).toMatch(/\btop-0\b/);
        // z-40 is load-bearing for the pinned-map overlap. See the Header
        // JSDoc — z-50 maps would otherwise paint underneath.
        expect(header.className).toMatch(/\bz-40\b/);
    });

    test('renders Navigation as a child', async () => {
        render(await Header());
        expect(screen.getByTestId('navigation-stub')).toBeInTheDocument();
    });
});

describe('Header — Logo', () => {
    test('logo link goes to homepage with home-nav umami event and a11y label', async () => {
        const { container } = render(await Header());
        const homeLink = container.querySelector('a[href="/"]');
        expect(homeLink).toBeInTheDocument();
        expect(homeLink.getAttribute('aria-label')).toBe('Go to homepage');
        expect(homeLink.getAttribute('data-umami-event')).toBe('nav-home');
    });

    test('logo image has the accessibility-compliant alt text and the priority hint', async () => {
        render(await Header());
        const img = screen.getByAltText(
            'Logo of Helldivers Bot, which is a cartoon depiction of a spy satellite',
        );
        expect(img).toBeInTheDocument();
        expect(img.getAttribute('src')).toBe('/images/logo.webp');
        // priority is dropped by the next/image mock (it's a Next-specific prop),
        // so the smoke check is on the src + alt being right.
    });

    test('logo caption reads "Helldivers Bot"', async () => {
        render(await Header());
        expect(screen.getByText('Helldivers Bot')).toBeInTheDocument();
    });
});

describe('Header — CSP nonce wiring', () => {
    test('forwards x-nonce from next/headers to the headerGPU <Script> tag', async () => {
        headersGet.mockImplementation((key) =>
            key === 'x-nonce' ? 'abc-csp-nonce-123' : null,
        );

        render(await Header());

        const script = screen.getByTestId('next-script');
        expect(script.getAttribute('data-nonce')).toBe('abc-csp-nonce-123');
        expect(script.getAttribute('data-src')).toBe('/scripts/headerGPU.js');
        expect(script.getAttribute('data-strategy')).toBe('afterInteractive');
    });

    test('passes undefined nonce to <Script> when x-nonce header is absent', async () => {
        headersGet.mockImplementation(() => null);

        render(await Header());

        // Header uses `headers().get('x-nonce') ?? undefined`. The Script
        // mock stringifies whatever it received — "undefined" here proves
        // Header forwarded undefined rather than coercing to empty string
        // (which would be a CSP-affecting change).
        const script = screen.getByTestId('next-script');
        expect(script.getAttribute('data-nonce')).toBe('undefined');
    });

    test('reads the x-nonce header (not some other header)', async () => {
        headersGet.mockImplementation(() => 'wrong-default');

        render(await Header());

        expect(headersGet).toHaveBeenCalledWith('x-nonce');
    });
});
