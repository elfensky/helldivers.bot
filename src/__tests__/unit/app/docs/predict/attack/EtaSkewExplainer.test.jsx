// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// EtaSkewExplainer draws the eta = work/pace hyperbola with a draggable pace
// multiplier. Mirror GammaExplorer's convention: mock recharts to capture
// props, keep assertions DOM-level (jsdom renders almost none of recharts'
// actual SVG).
const chartProps = [];
const refDotProps = [];
vi.mock('recharts', () => ({
    ComposedChart: ({ data, children }) => {
        chartProps.push({ data });
        return <div data-testid="composed-chart">{children}</div>;
    },
    ResponsiveContainer: ({ children }) => (
        <div data-testid="responsive-container">{children}</div>
    ),
    Line: ({ dataKey, stroke }) => (
        <div data-testid={`line-${dataKey}`} data-stroke={stroke} />
    ),
    XAxis: () => <div data-testid="xaxis" />,
    YAxis: () => <div data-testid="yaxis" />,
    CartesianGrid: () => <div data-testid="grid" />,
    Tooltip: () => <div data-testid="tooltip-host" />,
    ReferenceLine: () => <div data-testid="refline" />,
    ReferenceDot: ({ x, y }) => {
        refDotProps.push({ x, y });
        return <div data-testid="refdot" />;
    },
}));

const trackMock = vi.fn();
vi.mock('@/shared/hooks/useTrack.mjs', () => ({
    useTrack: () => trackMock,
}));

import EtaSkewExplainer from '@/app/docs/predict/attack/EtaSkewExplainer';

beforeEach(() => {
    chartProps.length = 0;
    refDotProps.length = 0;
    trackMock.mockClear();
});

describe('EtaSkewExplainer', () => {
    test('renders the eta = 14/m hyperbola', () => {
        render(<EtaSkewExplainer />);
        const { data } = chartProps.at(-1);
        expect(data.length).toBeGreaterThan(30);
        for (const row of data) {
            expect(row.eta).toBeCloseTo(14 / row.m, 6);
        }
        // Endpoints pin the asymmetry the section is about: ×0.25 → 56h,
        // ×2.5 → 5.6h.
        expect(data[0].m).toBeCloseTo(0.25);
        expect(data[0].eta).toBeCloseTo(56);
        expect(data.at(-1).eta).toBeCloseTo(14 / data.at(-1).m, 6);
    });

    test('starts at the forecast itself (×1, 14h)', () => {
        render(<EtaSkewExplainer />);
        expect(refDotProps.at(-1)).toEqual({ x: 1, y: 14 });
        expect(screen.getByText(/the forecast: 14h/)).toBeTruthy();
    });

    test('half pace costs 14h; double pace saves only 7h', () => {
        render(<EtaSkewExplainer />);
        const slider = screen.getByLabelText(/pace ×/i);

        fireEvent.change(slider, { target: { value: '0.5' } });
        expect(screen.getByText(/28\.0h — 14\.0h later/)).toBeTruthy();

        fireEvent.change(slider, { target: { value: '2' } });
        expect(screen.getByText(/7\.0h — 7\.0h sooner/)).toBeTruthy();
    });

    test('preset buttons jump the pace multiplier', () => {
        render(<EtaSkewExplainer />);
        fireEvent.click(screen.getByRole('button', { name: /half pace/i }));
        expect(refDotProps.at(-1)).toEqual({ x: 0.5, y: 28 });
        fireEvent.click(screen.getByRole('button', { name: /double pace/i }));
        expect(refDotProps.at(-1)).toEqual({ x: 2, y: 7 });
    });

    test('tracks the first interaction only', () => {
        render(<EtaSkewExplainer />);
        const slider = screen.getByLabelText(/pace ×/i);
        fireEvent.change(slider, { target: { value: '1.5' } });
        fireEvent.change(slider, { target: { value: '0.75' } });
        fireEvent.click(screen.getByRole('button', { name: /current pace/i }));
        expect(trackMock).toHaveBeenCalledTimes(1);
        expect(trackMock).toHaveBeenCalledWith('docs-eta-skew-explore');
    });
});
