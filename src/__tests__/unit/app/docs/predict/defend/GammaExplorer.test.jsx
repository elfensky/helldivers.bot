// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// GammaExplorer wires the observed lull histogram + a draggable gamma-k
// overlay into recharts. Mirror FactionHealthChart's convention: mock
// recharts to capture props, keep assertions DOM-level (jsdom renders
// almost none of recharts' actual SVG).
const composedChartProps = [];
vi.mock('recharts', () => ({
    ComposedChart: ({ data, children }) => {
        composedChartProps.push({ data });
        return <div data-testid="composed-chart">{children}</div>;
    },
    ResponsiveContainer: ({ children }) => (
        <div data-testid="responsive-container">{children}</div>
    ),
    Bar: ({ dataKey, fill }) => <div data-testid={`bar-${dataKey}`} data-fill={fill} />,
    Line: ({ dataKey, stroke }) => (
        <div data-testid={`line-${dataKey}`} data-stroke={stroke} />
    ),
    XAxis: () => <div data-testid="xaxis" />,
    YAxis: () => <div data-testid="yaxis" />,
    CartesianGrid: () => <div data-testid="grid" />,
    Tooltip: () => <div data-testid="tooltip-host" />,
}));

const trackMock = vi.fn();
vi.mock('@/shared/hooks/useTrack.mjs', () => ({
    useTrack: () => trackMock,
}));

import GammaExplorer from '@/app/docs/predict/defend/GammaExplorer';

beforeEach(() => {
    composedChartProps.length = 0;
    trackMock.mockClear();
});

// 60 bins x 2h = 120h span, matching liveStats' histogram shape.
const BINS = new Array(60).fill(0);
BINS[10] = 20; // 20-22h
BINS[20] = 40; // 40-42h
BINS[21] = 30; // 42-44h

const BASE_PROPS = {
    bins: BINS,
    binWidthH: 2,
    n: 90,
    meanH: 40,
    fittedK: 4.4,
};

describe('GammaExplorer — slider', () => {
    test('renders a range slider defaulting to fittedK', () => {
        render(<GammaExplorer {...BASE_PROPS} />);
        const slider = screen.getByRole('slider');
        expect(slider).toBeInTheDocument();
        expect(Number(slider.value)).toBeCloseTo(BASE_PROPS.fittedK, 6);
    });

    test('slider spans [0.5, 50] so k=50 (fixed timer) sits inside range', () => {
        render(<GammaExplorer {...BASE_PROPS} />);
        const slider = screen.getByRole('slider');
        expect(Number(slider.min)).toBe(0.5);
        expect(Number(slider.max)).toBe(50);
    });

    test('dragging the slider updates the KS readout and fires docs-gamma-explore once', () => {
        render(<GammaExplorer {...BASE_PROPS} />);
        const slider = screen.getByRole('slider');

        fireEvent.change(slider, { target: { value: '1' } });
        expect(Number(slider.value)).toBeCloseTo(1, 6);
        expect(trackMock).toHaveBeenCalledTimes(1);
        expect(trackMock).toHaveBeenCalledWith('docs-gamma-explore');

        // Further interaction must NOT fire a second event.
        fireEvent.change(slider, { target: { value: '2' } });
        expect(trackMock).toHaveBeenCalledTimes(1);
    });
});

describe('GammaExplorer — KS readout', () => {
    test('shows KS distance readout text', () => {
        render(<GammaExplorer {...BASE_PROPS} />);
        expect(screen.getByText(/KS distance/i)).toBeInTheDocument();
    });
});

describe('GammaExplorer — presets', () => {
    test('"memoryless (k=1)" button exists by accessible name, has no data-umami-event', () => {
        render(<GammaExplorer {...BASE_PROPS} />);
        const btn = screen.getByRole('button', { name: 'memoryless (k=1)' });
        expect(btn).toBeInTheDocument();
        expect(btn.hasAttribute('data-umami-event')).toBe(false);
    });

    test('"best fit" and "fixed timer (k=50)" buttons exist by accessible name', () => {
        render(<GammaExplorer {...BASE_PROPS} />);
        expect(screen.getByRole('button', { name: 'best fit' })).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'fixed timer (k=50)' }),
        ).toBeInTheDocument();
    });

    test('clicking "memoryless (k=1)" moves the slider value to 1', () => {
        render(<GammaExplorer {...BASE_PROPS} />);
        fireEvent.click(screen.getByRole('button', { name: 'memoryless (k=1)' }));
        const slider = screen.getByRole('slider');
        expect(Number(slider.value)).toBeCloseTo(1, 6);
    });

    test('clicking "fixed timer (k=50)" moves the slider value to 50', () => {
        render(<GammaExplorer {...BASE_PROPS} />);
        fireEvent.click(screen.getByRole('button', { name: 'fixed timer (k=50)' }));
        const slider = screen.getByRole('slider');
        expect(Number(slider.value)).toBeCloseTo(50, 6);
    });

    test('clicking "best fit" jumps the slider to the fittedK prop', () => {
        render(<GammaExplorer {...BASE_PROPS} fittedK={7.2} />);
        // Move away from fittedK first.
        fireEvent.click(screen.getByRole('button', { name: 'memoryless (k=1)' }));
        fireEvent.click(screen.getByRole('button', { name: 'best fit' }));
        const slider = screen.getByRole('slider');
        expect(Number(slider.value)).toBeCloseTo(7.2, 6);
    });

    test('preset click also counts as interaction — fires docs-gamma-explore once', () => {
        render(<GammaExplorer {...BASE_PROPS} />);
        fireEvent.click(screen.getByRole('button', { name: 'best fit' }));
        expect(trackMock).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole('button', { name: 'memoryless (k=1)' }));
        expect(trackMock).toHaveBeenCalledTimes(1);
    });
});

describe('GammaExplorer — chart', () => {
    test('renders the responsive container + composed chart', () => {
        render(<GammaExplorer {...BASE_PROPS} />);
        expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
        expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
    });

    test('bar series uses observed bin shares (count/n) and gamma line uses bin probabilities', () => {
        render(<GammaExplorer {...BASE_PROPS} />);
        const { data } = composedChartProps[0];
        expect(data).toHaveLength(BINS.length);
        // bin 10 has count 20 out of n=90.
        expect(data[10].share).toBeCloseTo(20 / 90, 6);
        // gamma line values are probabilities in [0, 1].
        expect(data[10].gammaProb).toBeGreaterThanOrEqual(0);
        expect(data[10].gammaProb).toBeLessThanOrEqual(1);
    });

    test('bar and line use the documented colors', () => {
        render(<GammaExplorer {...BASE_PROPS} />);
        expect(screen.getByTestId('bar-share').getAttribute('data-fill')).toBe(
            'var(--color-surface-4)',
        );
        expect(screen.getByTestId('line-gammaProb').getAttribute('data-stroke')).toBe(
            'var(--color-primary)',
        );
    });
});

describe('GammaExplorer — copy', () => {
    test('shows the memoryless-coin-flip explainer line', () => {
        render(<GammaExplorer {...BASE_PROPS} />);
        expect(
            screen.getByText(/if the scheduler were a coin flip every tick/i),
        ).toBeInTheDocument();
    });
});
