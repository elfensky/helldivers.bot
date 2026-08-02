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

const hiddenCounter = { mode: 'hidden', reason: 'no-assault' };
const clockCounter = (overrides = {}) => ({
    mode: 'clock',
    at: NOW + 31 * 3600,
    assaultStart: NOW - 17 * 3600,
    pace: null,
    ...overrides,
});

describe('NextWaveCard', () => {
    test('renders nothing when both forecasts are hidden', () => {
        const { container } = render(
            <NextWaveCard
                forecast={{ mode: 'hidden', reason: 'wave-active' }}
                counter={{ mode: 'hidden', reason: 'wave-active' }}
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
        expect(screen.getByText(/~23h \(14-32h\)/)).toBeInTheDocument();
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
        const range = screen.getByText(/~23h \(14-32h\)/);
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
        const range = screen.getByText(/~23h \(14-32h\)/);
        expect(range).toHaveAttribute('title');
        const title = range.getAttribute('title');
        expect(title).toMatch(/^median /);
        expect(title).toMatch(/War Day \d+/);
        expect(title).toMatch(/50% band/);
        expect(title).toMatch(/typical miss ±8h/);
    });

    test('docs link carries the umami event', () => {
        render(
            <NextWaveCard forecast={windowForecast()} warStart={WAR_START} now={NOW} />,
        );
        const link = screen.getByRole('link', { name: /how is this computed/i });
        expect(link).toHaveAttribute('href', '/docs/predict/defend');
        expect(link).toHaveAttribute('data-umami-event', 'dashboard-wave-window-docs');
    });

    test('no counterattack line when the counter forecast is hidden', () => {
        render(
            <NextWaveCard
                forecast={windowForecast()}
                counter={hiddenCounter}
                warStart={WAR_START}
                now={NOW}
            />,
        );
        expect(screen.queryByText(/counterattack/i)).not.toBeInTheDocument();
    });

    test('clock-only regime: no band, COUNTERATTACK_CLOCK label, conditional line', () => {
        const { container } = render(
            <NextWaveCard
                forecast={{ mode: 'hidden', reason: 'assault-active' }}
                counter={clockCounter()}
                warStart={WAR_START}
                now={NOW}
            />,
        );
        expect(screen.getByText('COUNTERATTACK_CLOCK')).toBeInTheDocument();
        expect(screen.getByText('ASSAULT RUNNING')).toBeInTheDocument();
        expect(screen.queryByText('LIKELIHOOD_WINDOW')).not.toBeInTheDocument();
        expect(container.querySelector('.sector-card-bar')).toBeNull();
        const line = screen.getByText(/if the assault fails/i);
        expect(line.textContent).toMatch(/counterattack .* \(in ~31h\)/);
        // The mechanic explainer rides the hover title.
        expect(line.getAttribute('title')).toMatch(/exactly 48h/i);
    });

    test('pace-conditional wording follows the assault verdict', () => {
        const { rerender } = render(
            <NextWaveCard
                forecast={{ mode: 'hidden', reason: 'assault-active' }}
                counter={clockCounter({ pace: 'behind' })}
                warStart={WAR_START}
                now={NOW}
            />,
        );
        expect(screen.getByText(/assault behind pace/i)).toBeInTheDocument();
        rerender(
            <NextWaveCard
                forecast={{ mode: 'hidden', reason: 'assault-active' }}
                counter={clockCounter({ pace: 'on_track' })}
                warStart={WAR_START}
                now={NOW}
            />,
        );
        const line = screen.getByText(/assault on pace to succeed/i);
        expect(line.textContent).toMatch(/only if pace collapses/i);
        rerender(
            <NextWaveCard
                forecast={{ mode: 'hidden', reason: 'assault-active' }}
                counter={clockCounter({ pace: 'stalled' })}
                warStart={WAR_START}
                now={NOW}
            />,
        );
        expect(screen.getByText(/assault behind pace/i)).toBeInTheDocument();
    });

    test('counterattack clock in the past reads as imminent', () => {
        render(
            <NextWaveCard
                forecast={{ mode: 'hidden', reason: 'assault-active' }}
                counter={clockCounter({ at: NOW - 600 })}
                warStart={WAR_START}
                now={NOW}
            />,
        );
        expect(screen.getByText(/if the assault fails/i).textContent).toMatch(
            /imminent/i,
        );
    });

    test('band fill geometry matches percentile-based positioning', () => {
        const { container } = render(
            <NextWaveCard
                forecast={windowForecast({ p25: 12, p50: 24, p75: 36 })}
                warStart={WAR_START}
                now={NOW}
            />,
        );
        const bandFill = container.querySelector('.sector-card-bar-fill');
        expect(bandFill).toHaveStyle({ marginLeft: '25%', width: '50%' });
        // The band is the subtle layer; the median tick carries the accent.
        expect(bandFill).toHaveStyle({ opacity: '0.35' });
        const tick = container.querySelector('.sector-card-bar-median');
        expect(tick).not.toBeNull();
        expect(tick).toHaveStyle({ left: '50%', width: '2px' });
    });

    test('range text is median-first like the assault ETA line', () => {
        render(
            <NextWaveCard
                forecast={windowForecast({ p25: 12, p50: 24, p75: 36 })}
                warStart={WAR_START}
                now={NOW}
            />,
        );
        expect(screen.getByText('~24h (12-36h)')).toBeInTheDocument();
    });
});
