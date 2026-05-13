// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { cloneElement } from 'react';
import { render, screen } from '@testing-library/react';

// FactionHealthChart wires snapshot/pointsMax data into recharts. Two
// internals matter for regressions:
//   1. buildChartData() — maps snapshots → per-day percentages with rules
//      for hidden/defeated/in-progress factions.
//   2. ChartTooltip — renders day + per-faction colored percentage rows.
//
// buildChartData is not exported, so we exercise it via the data prop
// captured by a recharts mock. ChartTooltip is internal but reachable
// via the Tooltip mock that calls its content prop with synthetic payload.

// Mock recharts to capture props passed to ComposedChart + the
// content components. Each chart child is rendered as a data-attribute
// carrier so we can introspect the wiring.
const composedChartProps = [];
vi.mock('recharts', () => ({
    ComposedChart: ({ data, margin, children }) => {
        composedChartProps.push({ data, margin });
        return <div data-testid="composed-chart">{children}</div>;
    },
    ResponsiveContainer: ({ width, height, children }) => (
        <div data-testid="responsive-container" data-width={width} data-height={height}>
            {children}
        </div>
    ),
    Area: ({ dataKey, fill, stroke, connectNulls, type, isAnimationActive }) => (
        <div
            data-testid={`area-${dataKey}`}
            data-fill={fill}
            data-stroke={stroke}
            data-connect-nulls={String(connectNulls)}
            data-type={type}
            data-is-animation-active={String(isAnimationActive)}
        />
    ),
    Line: ({ dataKey, stroke, strokeWidth, dot, connectNulls, isAnimationActive }) => (
        <div
            data-testid={`line-${dataKey}`}
            data-stroke={stroke}
            data-stroke-width={strokeWidth}
            data-dot={String(dot)}
            data-connect-nulls={String(connectNulls)}
            data-is-animation-active={String(isAnimationActive)}
        />
    ),
    XAxis: ({ dataKey, tickFormatter }) => (
        <div
            data-testid="xaxis"
            data-key={dataKey}
            data-tick-formatter={tickFormatter ? tickFormatter(7) : ''}
        />
    ),
    YAxis: ({ domain, tickFormatter }) => (
        <div
            data-testid="yaxis"
            data-domain={JSON.stringify(domain)}
            data-tick-formatter={tickFormatter ? tickFormatter(45) : ''}
        />
    ),
    CartesianGrid: () => <div data-testid="grid" />,
    // The Tooltip mock CAPTURES the `content` render-prop function so tests
    // can call it directly with active/payload variants. Recharts invokes
    // `content` with { active, payload } at render time; we mirror that.
    Tooltip: ({ content }) => {
        tooltipContent = content;
        return <div data-testid="tooltip-host" />;
    },
}));

// Surfaced by the Tooltip mock above so tests can invoke it.
let tooltipContent = null;

import FactionHealthChart from '@/features/archives/FactionHealthChart';

beforeEach(() => {
    composedChartProps.length = 0;
    tooltipContent = null;
});

// --- Test fixtures ---

// 3-day window with a representative snapshot per day.
function snapshot(time, factions) {
    return { time, data: factions };
}
function f(points, status = 'active') {
    return { points, status };
}

describe('FactionHealthChart — render gates', () => {
    test('returns null when snapshots is empty', () => {
        const { container } = render(
            <FactionHealthChart snapshots={[]} pointsMax={{ points: [100, 100, 100] }} />,
        );
        expect(container.firstChild).toBeNull();
    });

    test('returns null when snapshots is undefined', () => {
        const { container } = render(
            <FactionHealthChart pointsMax={{ points: [100, 100, 100] }} />,
        );
        expect(container.firstChild).toBeNull();
    });

    test('returns null when pointsMax.points is missing', () => {
        const { container } = render(
            <FactionHealthChart
                snapshots={[snapshot(0, [f(50), f(50), f(50)])]}
                pointsMax={{}}
            />,
        );
        expect(container.firstChild).toBeNull();
    });

    test('renders the responsive container + composed chart with non-empty data', () => {
        render(
            <FactionHealthChart
                snapshots={[snapshot(0, [f(50), f(50), f(50)])]}
                pointsMax={{ points: [100, 100, 100] }}
            />,
        );
        expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
        expect(screen.getByTestId('composed-chart')).toBeInTheDocument();
    });
});

describe('FactionHealthChart — buildChartData logic (via captured props)', () => {
    test('maps snapshots to per-day entries with `day` 0-indexed relative to the first snapshot', () => {
        const day = 86400;
        render(
            <FactionHealthChart
                snapshots={[
                    snapshot(1_000_000_000, [f(50), f(50), f(50)]),
                    snapshot(1_000_000_000 + day, [f(50), f(50), f(50)]),
                    snapshot(1_000_000_000 + 3 * day, [f(50), f(50), f(50)]),
                ]}
                pointsMax={{ points: [100, 100, 100] }}
            />,
        );

        const { data } = composedChartProps[0];
        expect(data).toHaveLength(3);
        expect(data[0].day).toBe(0);
        expect(data[1].day).toBe(1);
        expect(data[2].day).toBe(3);
    });

    test('faction with status "hidden" maps to null (gap in the line)', () => {
        render(
            <FactionHealthChart
                snapshots={[snapshot(0, [f(50, 'hidden'), f(50), f(50)])]}
                pointsMax={{ points: [100, 100, 100] }}
            />,
        );

        const { data } = composedChartProps[0];
        expect(data[0].bugs).toBeNull();
        expect(data[0].cyborgs).not.toBeNull();
    });

    test('faction with status "defeated" maps to 100% (homeworld captured)', () => {
        render(
            <FactionHealthChart
                snapshots={[snapshot(0, [f(0, 'defeated'), f(50), f(50)])]}
                pointsMax={{ points: [100, 100, 100] }}
            />,
        );

        const { data } = composedChartProps[0];
        expect(data[0].bugs).toBe(100);
    });

    test('active faction at max sector points caps at 10/11 (~90.9%) — last 1/11 reserved for homeworld', () => {
        render(
            <FactionHealthChart
                snapshots={[snapshot(0, [f(100), f(50), f(50)])]}
                pointsMax={{ points: [100, 100, 100] }}
            />,
        );

        const { data } = composedChartProps[0];
        // 100/100 * 10/11 = 0.90909... → 90.9%
        expect(data[0].bugs).toBeCloseTo(90.9, 1);
    });

    test('active faction at zero points maps to 0%', () => {
        render(
            <FactionHealthChart
                snapshots={[snapshot(0, [f(0), f(50), f(50)])]}
                pointsMax={{ points: [100, 100, 100] }}
            />,
        );
        const { data } = composedChartProps[0];
        expect(data[0].bugs).toBe(0);
    });

    test('maxPoints of 0 for a faction maps to 0% (no division by zero)', () => {
        render(
            <FactionHealthChart
                snapshots={[snapshot(0, [f(50), f(50), f(50)])]}
                pointsMax={{ points: [0, 100, 100] }}
            />,
        );
        const { data } = composedChartProps[0];
        expect(data[0].bugs).toBe(0);
    });

    test('snapshots with null/missing data are filtered out (do NOT shift later days)', () => {
        const day = 86400;
        render(
            <FactionHealthChart
                snapshots={[
                    snapshot(0, [f(50), f(50), f(50)]),
                    { time: day, data: null },
                    snapshot(2 * day, [f(50), f(50), f(50)]),
                ]}
                pointsMax={{ points: [100, 100, 100] }}
            />,
        );
        const { data } = composedChartProps[0];
        // Two entries (the null was filtered); day index stays absolute.
        expect(data).toHaveLength(2);
        expect(data[0].day).toBe(0);
        expect(data[1].day).toBe(2);
    });
});

describe('FactionHealthChart — chart configuration (locked)', () => {
    test('Area + Line series rendered for all three factions with the brand colors', () => {
        render(
            <FactionHealthChart
                snapshots={[snapshot(0, [f(50), f(50), f(50)])]}
                pointsMax={{ points: [100, 100, 100] }}
            />,
        );

        const bugsLine = screen.getByTestId('line-bugs');
        const cyborgsLine = screen.getByTestId('line-cyborgs');
        const illuminateLine = screen.getByTestId('line-illuminate');

        expect(bugsLine.getAttribute('data-stroke')).toBe('#e8822a');
        expect(cyborgsLine.getAttribute('data-stroke')).toBe('#8b2d2d');
        expect(illuminateLine.getAttribute('data-stroke')).toBe('#7ec8e3');

        // connectNulls is intentionally false — gaps stay visible.
        expect(bugsLine.getAttribute('data-connect-nulls')).toBe('false');
        // Animation disabled for archival/static rendering.
        expect(bugsLine.getAttribute('data-is-animation-active')).toBe('false');
    });

    test('Area series use the brand fill (rgba alpha) and connectNulls=false', () => {
        render(
            <FactionHealthChart
                snapshots={[snapshot(0, [f(50), f(50), f(50)])]}
                pointsMax={{ points: [100, 100, 100] }}
            />,
        );
        expect(screen.getByTestId('area-bugs').getAttribute('data-fill')).toBe(
            'rgba(232, 130, 42, 0.2)',
        );
        expect(screen.getByTestId('area-cyborgs').getAttribute('data-fill')).toBe(
            'rgba(139, 45, 45, 0.2)',
        );
        expect(screen.getByTestId('area-illuminate').getAttribute('data-fill')).toBe(
            'rgba(126, 200, 227, 0.2)',
        );
    });

    test('XAxis tick formatter renders "D<day>" and YAxis renders "<percent>%"', () => {
        render(
            <FactionHealthChart
                snapshots={[snapshot(0, [f(50), f(50), f(50)])]}
                pointsMax={{ points: [100, 100, 100] }}
            />,
        );
        // The mock invokes tickFormatter(7) for X and tickFormatter(45) for Y.
        expect(screen.getByTestId('xaxis').getAttribute('data-tick-formatter')).toBe(
            'D7',
        );
        expect(screen.getByTestId('yaxis').getAttribute('data-tick-formatter')).toBe(
            '45%',
        );
        expect(screen.getByTestId('yaxis').getAttribute('data-domain')).toBe('[0,100]');
    });
});

describe('FactionHealthChart — ChartTooltip (render-prop element, cloned with synthetic props)', () => {
    // recharts' Tooltip mock above captures the `content` prop into
    // `tooltipContent`. FactionHealthChart passes `<ChartTooltip />` as a
    // JSX ELEMENT (not a function), and recharts internally clones it with
    // { active, payload } injected at render time. We reproduce that by
    // cloning the captured element with synthetic props.

    function renderTooltipWith(props) {
        render(
            <FactionHealthChart
                snapshots={[snapshot(0, [f(50), f(50), f(50)])]}
                pointsMax={{ points: [100, 100, 100] }}
            />,
        );
        expect(tooltipContent).toBeTruthy();
        return render(cloneElement(tooltipContent, props));
    }

    test('renders nothing when inactive', () => {
        const { container } = renderTooltipWith({ active: false, payload: [] });
        expect(container.firstChild).toBeNull();
    });

    test('renders nothing when active but payload is empty', () => {
        const { container } = renderTooltipWith({ active: true, payload: [] });
        expect(container.firstChild).toBeNull();
    });

    test('renders nothing when payload entry has no inner .payload field', () => {
        const { container } = renderTooltipWith({ active: true, payload: [{}] });
        expect(container.firstChild).toBeNull();
    });

    test('renders "Day <n>" header and one row per faction with a non-null value', () => {
        const { container } = renderTooltipWith({
            active: true,
            payload: [
                {
                    payload: {
                        day: 4,
                        time: 1700000000,
                        bugs: 75,
                        cyborgs: null,
                        illuminate: 50,
                    },
                },
            ],
        });

        // Day header.
        expect(container.textContent).toContain('Day 4');

        // Bugs and Illuminate rows show with percentage; Cyborgs (null) omitted.
        expect(container.textContent).toContain('Bugs');
        expect(container.textContent).toContain('75%');
        expect(container.textContent).toContain('Illuminate');
        expect(container.textContent).toContain('50%');
        expect(container.textContent).not.toContain('Cyborgs');
    });

    test('row text color matches the faction brand stroke', () => {
        const { container } = renderTooltipWith({
            active: true,
            payload: [{ payload: { day: 1, bugs: 10, cyborgs: 20, illuminate: 30 } }],
        });

        const rows = container.querySelectorAll('div[style*="color"]');
        const colors = Array.from(rows).map((r) => r.style.color);
        expect(colors).toContain('rgb(232, 130, 42)'); // #e8822a bugs
        expect(colors).toContain('rgb(139, 45, 45)'); // #8b2d2d cyborgs
        expect(colors).toContain('rgb(126, 200, 227)'); // #7ec8e3 illuminate
    });
});
