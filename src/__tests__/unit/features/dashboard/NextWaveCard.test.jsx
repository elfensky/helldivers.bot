// @vitest-environment jsdom
// src/__tests__/unit/features/dashboard/NextWaveCard.test.jsx
import { render, screen } from '@testing-library/react';
import NextWaveCard from '@/features/dashboard/NextWaveCard';

const NOW = 1_700_000_000;
const WAR_START = NOW - 12 * 86400;

const windowForecast = (overrides = {}) => ({
    mode: 'window',
    p25: 14.2,
    p50: 22.5,
    p75: 31.8,
    p24: 0.63,
    p48: 0.91,
    state: 'NORMAL',
    imminent: true,
    runningLong: false,
    lastTrainStart: NOW - 20 * 3600,
    ...overrides,
});

describe('NextWaveCard', () => {
    test('renders nothing when hidden', () => {
        const { container } = render(
            <NextWaveCard
                forecast={{ mode: 'hidden', reason: 'wave-active' }}
                warStart={WAR_START}
                now={NOW}
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    test('renders the sector-card header, range, and sureties', () => {
        const { container } = render(
            <NextWaveCard forecast={windowForecast()} warStart={WAR_START} now={NOW} />,
        );
        expect(screen.getByText('Predicted')).toBeInTheDocument();
        expect(screen.getByText('Wave')).toBeInTheDocument();
        expect(screen.getByText(/14–32h/)).toBeInTheDocument();
        expect(screen.getByText(/63% within 24h/i)).toBeInTheDocument();
        expect(screen.getByText(/91% within 48h/i)).toBeInTheDocument();
        expect(screen.getByText('LIKELIHOOD_WINDOW')).toBeInTheDocument();
        // Same skeleton as the faction cards, gold accent column included.
        expect(container.querySelector('.sector-card')).not.toBeNull();
        expect(container.querySelector('.sector-card-accent')).not.toBeNull();
        expect(container.querySelector('img[src*="superearth"]')).not.toBeNull();
    });

    test('IMMINENT state label follows the flag', () => {
        const { rerender } = render(
            <NextWaveCard forecast={windowForecast()} warStart={WAR_START} now={NOW} />,
        );
        expect(screen.getByText('IMMINENT')).toBeInTheDocument();
        rerender(
            <NextWaveCard
                forecast={windowForecast({ imminent: false, p24: 0.3 })}
                warStart={WAR_START}
                now={NOW}
            />,
        );
        expect(screen.queryByText('IMMINENT')).not.toBeInTheDocument();
    });

    test('RUNNING LONG state label + assault explainer in the hover title (SC9)', () => {
        render(
            <NextWaveCard
                forecast={windowForecast({
                    state: 'SC9',
                    runningLong: true,
                    imminent: false,
                })}
                warStart={WAR_START}
                now={NOW}
            />,
        );
        expect(screen.getByText('RUNNING LONG')).toBeInTheDocument();
        const range = screen.getByText(/14–32h/);
        expect(range.getAttribute('title')).toMatch(/homeworld assault/i);
    });

    test('combined RUNNING LONG · IMMINENT state label when both flags set', () => {
        render(
            <NextWaveCard
                forecast={windowForecast({ runningLong: true, imminent: true })}
                warStart={WAR_START}
                now={NOW}
            />,
        );
        expect(screen.getByText('RUNNING LONG · IMMINENT')).toBeInTheDocument();
    });

    test('hover title carries absolute times, war day, band label, typical miss', () => {
        render(
            <NextWaveCard forecast={windowForecast()} warStart={WAR_START} now={NOW} />,
        );
        const range = screen.getByText(/14–32h/);
        expect(range).toHaveAttribute('title');
        const title = range.getAttribute('title');
        expect(title).toMatch(/War Day \d+/);
        expect(title).toMatch(/50% band/);
        expect(title).toMatch(/typical miss ±8h/);
    });

    test('docs link carries the umami event', () => {
        render(
            <NextWaveCard forecast={windowForecast()} warStart={WAR_START} now={NOW} />,
        );
        const link = screen.getByRole('link', { name: /how is this computed/i });
        expect(link).toHaveAttribute('href', '/docs/predict');
        expect(link).toHaveAttribute('data-umami-event', 'dashboard-wave-window-docs');
    });

    test('band fill geometry matches percentile-based positioning', () => {
        const { container } = render(
            <NextWaveCard
                forecast={windowForecast({ p25: 12, p75: 36 })}
                warStart={WAR_START}
                now={NOW}
            />,
        );
        const bandFill = container.querySelector('.sector-card-bar-fill');
        expect(bandFill).toHaveStyle({ marginLeft: '25%', width: '50%' });
    });
});
