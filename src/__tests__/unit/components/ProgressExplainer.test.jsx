// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('recharts', () => ({
    ComposedChart: vi.fn(({ children }) => (
        <div data-testid="composed-chart">{children}</div>
    )),
    Area: vi.fn(() => null),
    Line: vi.fn(() => null),
    Scatter: vi.fn(() => null),
    XAxis: vi.fn(() => null),
    YAxis: vi.fn(() => null),
    CartesianGrid: vi.fn(() => null),
    Tooltip: vi.fn(() => null),
    ResponsiveContainer: vi.fn(({ children }) => (
        <div data-testid="responsive-container">{children}</div>
    )),
    ReferenceLine: vi.fn(() => null),
}));

import ProgressExplainer from '@/components/layout/ProgressExplainer/ProgressExplainer';

describe('ProgressExplainer', () => {
    test('renders without crashing', () => {
        const { container } = render(<ProgressExplainer />);
        expect(container.querySelector('.progress-explainer')).not.toBeNull();
    });

    test('renders 4 slider controls with correct labels', () => {
        render(<ProgressExplainer />);
        const sliders = screen.getAllByRole('slider');
        expect(sliders).toHaveLength(4);

        expect(screen.getByText('Total Duration (hours)')).toBeDefined();
        expect(screen.getByText('Points Max (target)')).toBeDefined();
        expect(screen.getByText('Time Elapsed (%)')).toBeDefined();
        expect(screen.getByText('Actual Points')).toBeDefined();
    });

    test('shows default status as "on track"', () => {
        render(<ProgressExplainer />);
        const badge = screen.getByText('on track');
        expect(badge).toBeDefined();
        expect(badge.className).toContain('progress-badge--on_track');
    });

    test('renders result grid with expected metric labels', () => {
        render(<ProgressExplainer />);
        expect(screen.getByText('Expected pts')).toBeDefined();
        expect(screen.getByText('Actual pts')).toBeDefined();
        expect(screen.getByText('Delta')).toBeDefined();
        expect(screen.getByText('Delta %')).toBeDefined();
        expect(screen.getByText('Current rate')).toBeDefined();
        expect(screen.getByText('Required rate')).toBeDefined();
    });

    test('displays correct default values for expected and actual pts', () => {
        render(<ProgressExplainer />);
        // Default: pointsMax=50000, elapsedPct=50, actual=25000
        // expectedPts = (50/100) * 50000 = 25000
        const dds = screen.getAllByText('25,000');
        // Both expected and actual should show 25,000
        expect(dds.length).toBeGreaterThanOrEqual(2);
    });

    test('renders formula section with key terms', () => {
        render(<ProgressExplainer />);
        expect(screen.getByText('expectedRate')).toBeDefined();
        expect(screen.getByText('expectedPts')).toBeDefined();
        expect(screen.getByText('buffer')).toBeDefined();
        expect(screen.getByText('ahead')).toBeDefined();
        expect(screen.getByText('behind')).toBeDefined();
        expect(screen.getByText('on_track')).toBeDefined();
    });

    test('renders legend items', () => {
        render(<ProgressExplainer />);
        expect(screen.getByText('Expected (linear)')).toBeDefined();
        expect(screen.getByText(/On-track buffer/)).toBeDefined();
        expect(screen.getByText(/Actual \(on track\)/)).toBeDefined();
    });

    test('renders chart container', () => {
        render(<ProgressExplainer />);
        expect(screen.getByTestId('responsive-container')).toBeDefined();
        expect(screen.getByTestId('composed-chart')).toBeDefined();
    });
});
