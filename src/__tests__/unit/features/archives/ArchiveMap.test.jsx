// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import ArchiveMap from '@/features/archives/ArchiveMap';

vi.mock('@/features/galaxy/Galaxy', () => ({
    default: ({ mapState }) => <div data-testid="galaxy">{JSON.stringify(mapState)}</div>,
}));

vi.mock('@/shared/utils/game/computeMapState.mjs', () => ({
    computeMapState: vi.fn(() => ({ 0: 'bugs', 1: 'cyborgs' })),
}));

const mockData = {
    snapshots: [{ time: 1700000000, data: [
        { enemy: 0, points: 100, points_taken: 50, status: 'active' },
        { enemy: 1, points: 200, points_taken: 80, status: 'active' },
        { enemy: 2, points: 150, points_taken: 60, status: 'active' },
    ] }],
    events: [
        { id: 1, enemy: 0, start_time: 1700100000, end_time: 1700200000, status: 'success', type: 'defend', region: 5 },
    ],
    points_max: { points: [1000, 1000, 1000] },
};

describe('ArchiveMap', () => {
    it('renders Galaxy with computed map state', () => {
        const { getByTestId } = render(
            <ArchiveMap data={mockData} selectedEvent={mockData.events[0]} />,
        );
        expect(getByTestId('galaxy')).toBeDefined();
    });

    it('renders with null selectedEvent (default map state)', () => {
        const { getByTestId } = render(
            <ArchiveMap data={mockData} selectedEvent={null} />,
        );
        expect(getByTestId('galaxy')).toBeDefined();
    });
});
