// @vitest-environment jsdom
import { describe, test, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import GalaxyMap from '@/features/galaxy/Map';
import {
    bugPaths,
    cyborgPaths,
    illuminatePaths,
    factionIcons,
    superEarthCircle,
    viewBox,
} from '@/features/galaxy/mapPaths.mjs';

vi.mock('@/features/galaxy/Map.css', () => ({}));

// Build a complete faction state matrix: factions [0,1,2,3] × sectors 0..11.
// Each entry has { status, event } so the sector className is derivable.
function buildMapState(overrides = {}) {
    const empty = (sector) => ({ status: 'captured', event: 'no-event' });
    const matrix = [0, 1, 2, 3].map(() => {
        const sectors = {};
        for (let i = 0; i <= 11; i += 1) sectors[i] = empty(i);
        return sectors;
    });
    // Apply overrides like { '0:1': { status: 'in-progress', event: 'attack' } }
    for (const [key, value] of Object.entries(overrides)) {
        const [factionIdx, sector] = key.split(':').map(Number);
        matrix[factionIdx][sector] = value;
    }
    return matrix;
}

describe('Map — root SVG geometry', () => {
    test('renders #map wrapper containing a single SVG with the correct viewBox and aspect-ratio', () => {
        const { container } = render(<GalaxyMap map={buildMapState()} />);
        const wrapper = container.querySelector('#map');
        expect(wrapper).toBeInTheDocument();

        const svg = wrapper.querySelector('svg');
        expect(svg).toBeInTheDocument();
        expect(svg.getAttribute('viewBox')).toBe(viewBox);
        // xMaxYMid meet is load-bearing for the layout described in
        // Map.jsx's leading JSDoc — a change here breaks pin/scroll layouts.
        expect(svg.getAttribute('preserveAspectRatio')).toBe('xMaxYMid meet');
    });

    test('defines the three filters (shadow, glow, glow-red) for sector styling', () => {
        const { container } = render(<GalaxyMap map={buildMapState()} />);
        expect(container.querySelector('filter#shadow')).toBeInTheDocument();
        expect(container.querySelector('filter#glow')).toBeInTheDocument();
        expect(container.querySelector('filter#glow-red')).toBeInTheDocument();
    });
});

describe('Map — faction groups', () => {
    test.each([
        ['bugs', 0, bugPaths],
        ['cyborgs', 1, cyborgPaths],
        ['illuminate', 2, illuminatePaths],
    ])('renders <g id="%s"> with one <path> per faction-%s sector', (id, _idx, paths) => {
        const { container } = render(<GalaxyMap map={buildMapState()} />);
        const g = container.querySelector(`g#${id}`);
        expect(g).toBeInTheDocument();
        const pathEls = g.querySelectorAll('path');
        expect(pathEls.length).toBe(paths.length);
    });

    test.each([
        ['bugs', 0, bugPaths],
        ['cyborgs', 1, cyborgPaths],
        ['illuminate', 2, illuminatePaths],
    ])(
        'faction-%s paths use the id, data-name (sector), and d attributes from mapPaths',
        (id, _idx, paths) => {
            const { container } = render(<GalaxyMap map={buildMapState()} />);
            for (const p of paths) {
                const el = container.querySelector(`path#${CSS.escape(p.id)}`);
                expect(el).toBeInTheDocument();
                expect(el.getAttribute('data-name')).toBe(String(p.sector));
                expect(el.getAttribute('data-faction')).toBe(id);
                expect(el.getAttribute('d')).toBe(p.d);
            }
        },
    );

    test('each faction <g> renders the faction icon <image> with mapPaths-supplied geometry', () => {
        const { container } = render(<GalaxyMap map={buildMapState()} />);
        // Three faction icons (index 0,1,2) live inside their <g>; the 4th
        // (super-earth) lives in #superearth.
        ['bugs', 'cyborgs', 'illuminate'].forEach((id, idx) => {
            const g = container.querySelector(`g#${id}`);
            const img = g.querySelector('image');
            expect(img.getAttribute('href')).toBe(factionIcons[idx].href);
            expect(img.getAttribute('x')).toBe(String(factionIcons[idx].x));
            expect(img.getAttribute('y')).toBe(String(factionIcons[idx].y));
        });
    });
});

describe('Map — sector className wiring (state → CSS)', () => {
    test('non-11 sectors get "sector <status> <event>" class composed from map state', () => {
        const map = buildMapState({
            '0:1': { status: 'in-progress', event: 'attack' },
        });
        const { container } = render(<GalaxyMap map={map} />);
        // Sector 1 path id is "0-1".
        const path = container.querySelector('path[id="0-1"]');
        expect(path.getAttribute('class')).toBe('sector in-progress attack');
    });

    test('sector 11 (homeworld) uses status ONLY — no event class', () => {
        const map = buildMapState({
            '0:11': { status: 'lost', event: 'this-should-not-appear' },
        });
        const { container } = render(<GalaxyMap map={map} />);
        const path = container.querySelector('path[id="0-11"]');
        expect(path.getAttribute('class')).toBe('sector lost');
        expect(path.getAttribute('class')).not.toContain('this-should-not-appear');
    });

    test('Super Earth circle uses map[3][0] status + event', () => {
        const map = buildMapState({
            '3:0': { status: 'in-progress', event: 'attack' },
        });
        const { container } = render(<GalaxyMap map={map} />);
        const circle = container.querySelector(
            `circle#${CSS.escape(superEarthCircle.id)}`,
        );
        expect(circle).toBeInTheDocument();
        expect(circle.getAttribute('class')).toBe('sector in-progress attack');
        expect(circle.getAttribute('cx')).toBe(String(superEarthCircle.cx));
        expect(circle.getAttribute('cy')).toBe(String(superEarthCircle.cy));
        expect(circle.getAttribute('r')).toBe(String(superEarthCircle.r));
    });

    test('Super Earth <image> uses factionIcons[3]', () => {
        const { container } = render(<GalaxyMap map={buildMapState()} />);
        const superEarthG = container.querySelector('g#superearth');
        const img = superEarthG.querySelector('image');
        expect(img.getAttribute('href')).toBe(factionIcons[3].href);
    });
});

describe('Map — pulseDelays wiring', () => {
    test('applies --pulse-delay CSS var on paths whose key has a delay', () => {
        // Key format: `${factionIndex}-${sector}`.
        const pulseDelays = new Map([
            ['0-1', 0.5],
            ['1-3', 2.25],
        ]);
        const { container } = render(
            <GalaxyMap map={buildMapState()} pulseDelays={pulseDelays} />,
        );

        const bug1 = container.querySelector('path[id="0-1"]');
        expect(bug1.style.getPropertyValue('--pulse-delay')).toBe('0.5s');

        const cyborg3 = container.querySelector('path[id="1-3"]');
        expect(cyborg3.style.getPropertyValue('--pulse-delay')).toBe('2.25s');
    });

    test('no --pulse-delay applied when pulseDelays is undefined', () => {
        const { container } = render(<GalaxyMap map={buildMapState()} />);
        const allPaths = container.querySelectorAll('path');
        for (const p of allPaths) {
            expect(p.style.getPropertyValue('--pulse-delay')).toBe('');
        }
    });

    test('no --pulse-delay applied to paths whose key is not in the delays map', () => {
        const pulseDelays = new Map([['0-1', 1.0]]);
        const { container } = render(
            <GalaxyMap map={buildMapState()} pulseDelays={pulseDelays} />,
        );
        // Pick a different path that isn't in the delays.
        const bug2 = container.querySelector('path[id="0-2"]');
        expect(bug2.style.getPropertyValue('--pulse-delay')).toBe('');
    });

    test('Super Earth circle picks up pulseDelays from key "3-0"', () => {
        const pulseDelays = new Map([['3-0', 1.5]]);
        const { container } = render(
            <GalaxyMap map={buildMapState()} pulseDelays={pulseDelays} />,
        );
        const circle = container.querySelector(
            `circle#${CSS.escape(superEarthCircle.id)}`,
        );
        expect(circle.style.getPropertyValue('--pulse-delay')).toBe('1.5s');
    });
});
