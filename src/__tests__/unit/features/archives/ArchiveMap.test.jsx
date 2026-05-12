// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import ArchiveMap from '@/features/archives/ArchiveMap';
import { computeMapStateAtEvent } from '@/shared/utils/game/computeMapStateAtEvent.mjs';

// Capture-style mock: stub Galaxy as a div whose data attribute records the
// exact `mapState` prop it received. Lets us assert what the parent wired
// without re-rendering the whole SVG. computeMapStateAtEvent is NOT mocked —
// the value of ArchiveMap tests is verifying real wiring, not re-asserting
// the math that computeMapStateAtEvent.test.mjs already covers.
vi.mock('@/features/galaxy/Galaxy', () => ({
    default: ({ mapState }) => (
        <div data-testid="galaxy" data-map-state={JSON.stringify(mapState)} />
    ),
}));

function fixture() {
    return {
        snapshots: [
            {
                time: 1700000000,
                data: [
                    { enemy: 0, points: 100, points_taken: 50, status: 'active' },
                    { enemy: 1, points: 200, points_taken: 80, status: 'active' },
                    { enemy: 2, points: 150, points_taken: 60, status: 'active' },
                ],
            },
        ],
        events: [
            {
                id: 1,
                enemy: 0,
                start_time: 1700100000,
                end_time: 1700200000,
                status: 'success',
                type: 'defend',
                region: 5,
            },
        ],
        points_max: { points: [1000, 1000, 1000] },
    };
}

function readMapState(testId) {
    const el = testId.getAttribute('data-map-state');
    return JSON.parse(el);
}

describe('ArchiveMap', () => {
    it('passes the same mapState to Galaxy that computeMapStateAtEvent produces for the inputs', () => {
        const data = fixture();
        const selectedEvent = data.events[0];
        const expected = computeMapStateAtEvent(selectedEvent, data);

        const { getByTestId } = render(
            <ArchiveMap data={data} selectedEvent={selectedEvent} />,
        );

        expect(readMapState(getByTestId('galaxy'))).toEqual(expected);
    });

    it('with null selectedEvent, passes the hidden-states fallback to Galaxy', () => {
        const data = fixture();
        const expected = computeMapStateAtEvent(null, data);

        const { getByTestId } = render(<ArchiveMap data={data} selectedEvent={null} />);

        const mapState = readMapState(getByTestId('galaxy'));
        expect(mapState).toEqual(expected);
        // Hidden fallback never produces an active campaign — every sector
        // should carry the "hidden" tag from HIDDEN_STATES.
        expect(JSON.stringify(mapState)).not.toContain('"status":"active"');
    });

    it('re-render with the same selectedEvent reference does not change the mapState passed to Galaxy', () => {
        const data = fixture();
        const selectedEvent = data.events[0];

        const { getByTestId, rerender } = render(
            <ArchiveMap data={data} selectedEvent={selectedEvent} />,
        );
        const firstSerialized = getByTestId('galaxy').getAttribute('data-map-state');

        rerender(<ArchiveMap data={data} selectedEvent={selectedEvent} />);
        const secondSerialized = getByTestId('galaxy').getAttribute('data-map-state');

        // Same inputs → memoised mapState → identical serialised output.
        expect(secondSerialized).toBe(firstSerialized);
    });

    it('re-render with a different selectedEvent updates the mapState passed to Galaxy', () => {
        const data = {
            ...fixture(),
            events: [
                {
                    id: 1,
                    enemy: 0,
                    start_time: 1700100000,
                    end_time: 1700200000,
                    status: 'active',
                    type: 'attack',
                    region: 5,
                },
                {
                    id: 2,
                    enemy: 1,
                    start_time: 1700110000,
                    end_time: 1700200000,
                    status: 'active',
                    type: 'attack',
                    region: 6,
                },
            ],
        };

        const { getByTestId, rerender } = render(
            <ArchiveMap data={data} selectedEvent={data.events[0]} />,
        );
        const first = getByTestId('galaxy').getAttribute('data-map-state');

        rerender(<ArchiveMap data={data} selectedEvent={data.events[1]} />);
        const second = getByTestId('galaxy').getAttribute('data-map-state');

        // Different selected event → different active region set → different output.
        expect(second).not.toBe(first);
    });
});
