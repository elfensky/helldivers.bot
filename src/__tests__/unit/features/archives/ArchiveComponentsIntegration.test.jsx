// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

// Mock all child components to test wiring without implementation details
vi.mock('@/features/archives/ArchiveStats', () => ({
    default: (props) => (
        <div data-testid="archive-stats-mock" data-props={JSON.stringify(props)} />
    ),
}));

vi.mock('@/features/stats/StatGrid', () => ({
    default: (props) => (
        <div data-testid="stat-grid-mock" data-props={JSON.stringify(props)} />
    ),
}));

vi.mock('@/features/archives/FactionHealthChart', () => ({
    default: (props) => (
        <div data-testid="faction-health-chart-mock" data-props={JSON.stringify(props)} />
    ),
}));

vi.mock('@/features/archives/ArchiveMap', () => ({
    default: (props) => (
        <div data-testid="archive-map-mock" data-props={JSON.stringify(props)} />
    ),
}));

vi.mock('@/features/timeline/EventLog', () => ({
    default: (props) => (
        <div data-testid="event-log-mock" data-props={JSON.stringify(props)} />
    ),
}));

vi.mock('@/features/archives/ArchivesHeader', () => ({
    default: (props) => (
        <div data-testid="archives-header-mock" data-props={JSON.stringify(props)} />
    ),
}));

vi.mock('@/shared/components/FactionTabs', () => ({
    default: (props) => (
        <div data-testid="faction-tabs-mock" data-props={JSON.stringify(props)} />
    ),
}));

vi.mock('@/features/archives/SeasonSelector', () => ({
    default: (props) => (
        <div data-testid="season-selector-mock" data-props={JSON.stringify(props)} />
    ),
}));

vi.mock('@/features/archives/RefreshSeasonButton', () => ({
    default: (props) => (
        <div
            data-testid="refresh-season-button-mock"
            data-props={JSON.stringify(props)}
        />
    ),
}));

// Mock hooks
const mockUsePersistedState = vi.hoisted(() => vi.fn());
const mockUseScrollEvent = vi.hoisted(() => vi.fn());
const mockUseHeaderGlassFilter = vi.hoisted(() => vi.fn());
const mockGetWarOutcome = vi.hoisted(() => vi.fn());

vi.mock('@/shared/hooks/usePersistedState.mjs', () => ({
    usePersistedState: mockUsePersistedState,
}));

vi.mock('@/shared/hooks/useScrollEvent.mjs', () => ({
    useScrollEvent: mockUseScrollEvent,
}));

vi.mock('@/shared/hooks/useHeaderGlassFilter.mjs', () => ({
    useHeaderGlassFilter: mockUseHeaderGlassFilter,
}));

vi.mock('@/features/archives/getWarOutcome.mjs', () => ({
    getWarOutcome: mockGetWarOutcome,
}));

vi.mock('@/shared/utils/game/eventKey.mjs', () => ({
    eventKey: (e) => `evt-${e?.event_id || 'null'}`,
}));

// Mock Next.js navigation hooks
vi.mock('next/navigation', () => ({
    useRouter: vi.fn(),
    usePathname: vi.fn(),
    useSearchParams: vi.fn(),
}));

import ArchivesClient from '@/features/archives/ArchivesClient';

const testSeasonData = {
    time: 1700000000,
    error_code: 0,
    introduction_order: [0, 1, 2],
    points_max: [1000, 1000, 1000],
    snapshots: [
        {
            season: 1,
            time: 1700000000,
            data: '[{"points":500,"points_taken":200,"status":"active"},{"points":400,"points_taken":100,"status":"active"},{"points":300,"points_taken":50,"status":"hidden"}]',
        },
        {
            season: 1,
            time: 1700100000,
            data: '[{"points":600,"points_taken":250,"status":"active"},{"points":450,"points_taken":150,"status":"active"},{"points":350,"points_taken":75,"status":"active"}]',
        },
    ],
    defend_events: [],
    attack_events: [],
    events: [
        {
            event_id: 1,
            enemy: 0,
            region: 5,
            type: 'defend',
            status: 'success',
            start_time: 1700050000,
            end_time: 1700060000,
        },
        {
            event_id: 2,
            enemy: 1,
            region: 6,
            type: 'attack',
            status: 'fail',
            start_time: 1700070000,
            end_time: 1700080000,
        },
    ],
};

const season2Data = {
    ...testSeasonData,
    snapshots: testSeasonData.snapshots.map((s) => ({ ...s, season: 2 })),
};

const allSeeds = [
    { season: 1, file: 'season-1.json', data: testSeasonData },
    { season: 2, file: 'season-2.json', data: season2Data },
];

beforeEach(() => {
    // Reset mocks before each test
    mockUsePersistedState.mockReturnValue(['global', vi.fn()]);
    mockUseScrollEvent.mockReturnValue({
        selectedEvent: null,
        railRef: { current: null },
    });
    mockUseHeaderGlassFilter.mockReturnValue('');
    mockGetWarOutcome.mockImplementation((data) => {
        if (!data || !data.events || data.events.length === 0) {
            return { outcome: 'unknown' };
        }

        const successCount = data.events.filter((e) => e.status === 'success').length;
        const failCount = data.events.filter(
            (e) => e.status === 'fail' || e.status === 'failed',
        ).length;

        return successCount > failCount ? { outcome: 'victory' } : { outcome: 'defeat' };
    });

    // Mock navigation
    vi.mocked(useRouter).mockReturnValue({
        push: vi.fn(),
        replace: vi.fn(),
    });
    vi.mocked(usePathname).mockReturnValue('/archives');
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams());
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('Archive Components Integration Tests', () => {
    describe.each(allSeeds)('Season $season ($file)', ({ season, file: _file, data }) => {
        test('ArchivesClient renders without crashing', () => {
            const seasons = [season];
            const { container } = render(
                <ArchivesClient
                    data={data}
                    seasons={seasons}
                    currentSeason={season}
                    isAdmin={false}
                />,
            );

            expect(container).toBeTruthy();
            expect(screen.getByTestId('archives-header-mock')).toBeInTheDocument();
        });

        test('ArchiveStats receives correct props', () => {
            render(
                <ArchivesClient
                    data={data}
                    seasons={[season]}
                    currentSeason={season}
                    initialFaction="global"
                />,
            );

            const statsElement = screen.getByTestId('archive-stats-mock');
            const props = JSON.parse(statsElement.getAttribute('data-props') || '{}');

            expect(props).toHaveProperty('events', data.events);
            expect(props.live).toBe(data.status);
            expect(props).toHaveProperty('data', data);
        });

        test('FactionHealthChart receives snapshots and points_max', () => {
            render(
                <ArchivesClient data={data} seasons={[season]} currentSeason={season} />,
            );

            const chartElement = screen.getByTestId('faction-health-chart-mock');
            const props = JSON.parse(chartElement.getAttribute('data-props') || '{}');

            expect(props).toHaveProperty('snapshots', data.snapshots);
            expect(props).toHaveProperty('pointsMax', data.points_max);
        });

        test('EventLog receives events and correct configuration', () => {
            render(
                <ArchivesClient data={data} seasons={[season]} currentSeason={season} />,
            );

            const logElement = screen.getByTestId('event-log-mock');
            const props = JSON.parse(logElement.getAttribute('data-props') || '{}');

            expect(props).toHaveProperty('events', data.events);
            expect(props).toHaveProperty('timeFormat', 'absolute');
            expect(props).toHaveProperty('id', 'archives-event-log');
        });

        test('ArchiveMap receives data and selectedEvent', () => {
            render(
                <ArchivesClient data={data} seasons={[season]} currentSeason={season} />,
            );

            const mapElement = screen.getByTestId('archive-map-mock');
            const props = JSON.parse(mapElement.getAttribute('data-props') || '{}');

            expect(props).toHaveProperty('data', data);
            expect(props).toHaveProperty('selectedEvent', null);
        });

        test('SeasonSelector receives correct season info', () => {
            render(
                <ArchivesClient data={data} seasons={[season]} currentSeason={season} />,
            );

            const selectorElement = screen.getByTestId('season-selector-mock');
            const props = JSON.parse(selectorElement.getAttribute('data-props') || '{}');

            expect(props).toHaveProperty('seasons', [season]);
            expect(props).toHaveProperty('currentSeason', season);
        });

        test('Data structure validation', () => {
            // Basic validation that the seed data has expected structure
            expect(data).toHaveProperty('time');
            expect(data).toHaveProperty('error_code');
            expect(data).toHaveProperty('introduction_order');
            expect(data).toHaveProperty('points_max');
            expect(data).toHaveProperty('snapshots');
            expect(data).toHaveProperty('defend_events');
            expect(data).toHaveProperty('attack_events');

            // Validate arrays are present
            expect(Array.isArray(data.introduction_order)).toBe(true);
            expect(Array.isArray(data.points_max)).toBe(true);
            expect(Array.isArray(data.snapshots)).toBe(true);
            expect(Array.isArray(data.defend_events)).toBe(true);
            expect(Array.isArray(data.attack_events)).toBe(true);
        });

        test('Events array structure', () => {
            if (data.events && data.events.length > 0) {
                const sampleEvent = data.events[0];
                expect(sampleEvent).toHaveProperty('event_id');
                expect(sampleEvent).toHaveProperty('enemy');
                expect(sampleEvent).toHaveProperty('region');
                expect(sampleEvent).toHaveProperty('type');
                expect(sampleEvent).toHaveProperty('status');
            }
        });

        test('Snapshots structure validation', () => {
            if (data.snapshots && data.snapshots.length > 0) {
                const sampleSnapshot = data.snapshots[0];
                expect(sampleSnapshot).toHaveProperty('season');
                expect(sampleSnapshot).toHaveProperty('time');
                expect(sampleSnapshot).toHaveProperty('data');

                // Validate that data is a stringified JSON array
                expect(typeof sampleSnapshot.data).toBe('string');
                const parsedData = JSON.parse(sampleSnapshot.data);
                expect(Array.isArray(parsedData)).toBe(true);
            }
        });
    });

    describe('Edge Cases and Error Conditions', () => {
        test('Handles null data gracefully', () => {
            const { container } = render(
                <ArchivesClient data={null} seasons={[999]} currentSeason={999} />,
            );

            expect(container).toBeTruthy();
            // Should not crash, components should handle null data
        });

        test('Handles empty events array', () => {
            const emptyData = {
                ...allSeeds[0].data,
                events: [],
            };

            const { container } = render(
                <ArchivesClient data={emptyData} seasons={[1]} currentSeason={1} />,
            );

            expect(container).toBeTruthy();
        });

        test('Handles minimal snapshot data', () => {
            const minimalData = {
                ...allSeeds[0].data,
                snapshots: [
                    {
                        season: 1,
                        time: 1000000000,
                        data: '[{"points":0,"points_taken":0,"status":"hidden"}]',
                    },
                ],
            };

            const { container } = render(
                <ArchivesClient data={minimalData} seasons={[1]} currentSeason={1} />,
            );

            expect(container).toBeTruthy();
        });

        test('Handles malformed event data', () => {
            const malformedData = {
                ...allSeeds[0].data,
                events: [
                    {
                        event_id: null,
                        enemy: undefined,
                        region: -1,
                        type: 'unknown',
                        status: 'invalid',
                    },
                ],
            };

            const { container } = render(
                <ArchivesClient data={malformedData} seasons={[1]} currentSeason={1} />,
            );

            expect(container).toBeTruthy();
        });
    });

    describe('Component Interaction Tests', () => {
        test('Faction switch passes the active faction to the stats components', () => {
            const setFactionMock = vi.fn();
            mockUsePersistedState.mockReturnValue(['bugs', setFactionMock]);

            render(
                <ArchivesClient
                    data={allSeeds[0].data}
                    seasons={[1]}
                    currentSeason={1}
                    initialFaction="bugs"
                />,
            );

            const stats = JSON.parse(
                screen.getByTestId('archive-stats-mock').getAttribute('data-props') ||
                    '{}',
            );
            const grid = JSON.parse(
                screen.getByTestId('stat-grid-mock').getAttribute('data-props') || '{}',
            );
            expect(stats.faction).toBe('bugs');
            expect(grid.faction).toBe('bugs');
        });

        test('Admin controls visibility', () => {
            // Test with admin=true
            const { unmount: unmountAdmin } = render(
                <ArchivesClient
                    data={allSeeds[0].data}
                    seasons={[1]}
                    currentSeason={1}
                    isAdmin={true}
                />,
            );

            expect(screen.getByTestId('refresh-season-button-mock')).toBeInTheDocument();

            // Clean up and test with admin=false
            unmountAdmin();
            render(
                <ArchivesClient
                    data={allSeeds[0].data}
                    seasons={[1]}
                    currentSeason={1}
                    isAdmin={false}
                />,
            );

            expect(
                screen.queryByTestId('refresh-season-button-mock'),
            ).not.toBeInTheDocument();
        });

        test('URL synchronization for event selection', () => {
            const pushMock = vi.fn();
            vi.mocked(useRouter).mockReturnValue({
                push: pushMock,
                replace: vi.fn(),
            });

            // Mock scroll event with a selected event
            const mockEvent = { event_id: 123, enemy: 0, region: 5, type: 'defend' };
            mockUseScrollEvent.mockReturnValue({
                selectedEvent: mockEvent,
                railRef: { current: null },
            });

            render(
                <ArchivesClient
                    data={allSeeds[0].data}
                    seasons={[1]}
                    currentSeason={1}
                />,
            );

            // Note: URL synchronization is handled by useScrollEvent hook
            // For now, just verify the component renders with selected event
            const mapElement = screen.getByTestId('archive-map-mock');
            const props = JSON.parse(mapElement.getAttribute('data-props') || '{}');
            expect(props.selectedEvent).toEqual(mockEvent);
        });

        test('EventLog receives computed faction intro markers', () => {
            // getCampaign-shaped data: introduction_order.order is enemy-indexed
            // reveal slots; status[i].first_seen is per-faction first appearance.
            const warStart = 1700000000;
            const introData = {
                ...allSeeds[0].data,
                war_start: warStart,
                introduction_order: { order: [1, 2, 0] }, // illuminate never deployed
                status: [
                    { enemy: 0, first_seen: warStart }, // Bugs — Day 1
                    { enemy: 1, first_seen: warStart + 3 * 86400 }, // Cyborgs — Day 4
                    { enemy: 2, first_seen: null }, // never seen
                ],
            };

            render(<ArchivesClient data={introData} seasons={[1]} currentSeason={1} />);

            const props = JSON.parse(
                screen.getByTestId('event-log-mock').getAttribute('data-props') || '{}',
            );

            expect(Array.isArray(props.introMarkers)).toBe(true);
            expect(props.introMarkers.map((m) => m.enemy)).toEqual([0, 1]);
            expect(props.introMarkers.map((m) => m.name)).toEqual(['Bugs', 'Cyborgs']);
            expect(props.introMarkers.map((m) => m.day)).toEqual([1, 4]);
        });

        test('EventLog receives empty intro markers when intro data is absent', () => {
            // The default seed lacks a getCampaign `status` array, so no markers.
            render(
                <ArchivesClient
                    data={allSeeds[0].data}
                    seasons={[1]}
                    currentSeason={1}
                />,
            );

            const props = JSON.parse(
                screen.getByTestId('event-log-mock').getAttribute('data-props') || '{}',
            );
            expect(props.introMarkers).toEqual([]);
        });

        test('Mobile viewport behavior simulation', () => {
            // Simulate mobile viewport
            global.innerWidth = 400;
            global.dispatchEvent(new Event('resize'));

            render(
                <ArchivesClient
                    data={allSeeds[0].data}
                    seasons={[1]}
                    currentSeason={1}
                />,
            );

            // Verify mobile FAB is visible
            const fab = screen.getByLabelText('Unpin map');
            expect(fab).toBeInTheDocument();
            expect(fab.textContent).toBe('✕');

            // Reset viewport
            global.innerWidth = 1024;
            global.dispatchEvent(new Event('resize'));
        });
    });

    describe('Performance Tests', () => {
        test('Handles large event datasets', () => {
            // Create data with many events
            const largeEventData = {
                ...allSeeds[0].data,
                events: Array.from({ length: 1000 }, (_, i) => ({
                    event_id: i,
                    enemy: i % 3,
                    region: (i % 10) + 1,
                    type: i % 2 === 0 ? 'defend' : 'attack',
                    status: i % 4 === 0 ? 'success' : 'fail',
                    start_time: 1700000000 + i * 1000,
                    end_time: 1700000000 + i * 1000 + 3600,
                })),
            };

            const { container } = render(
                <ArchivesClient data={largeEventData} seasons={[1]} currentSeason={1} />,
            );

            expect(container).toBeTruthy();
        });

        test('Handles many snapshots', () => {
            // Create data with many snapshots
            const largeSnapshotData = {
                ...allSeeds[0].data,
                snapshots: Array.from({ length: 500 }, (_, i) => ({
                    season: 1,
                    time: 1700000000 + i * 3600,
                    data: JSON.stringify([
                        { points: i * 100, points_taken: i * 50, status: 'active' },
                        { points: i * 80, points_taken: i * 40, status: 'active' },
                        { points: i * 60, points_taken: i * 30, status: 'active' },
                    ]),
                })),
            };

            const { container } = render(
                <ArchivesClient
                    data={largeSnapshotData}
                    seasons={[1]}
                    currentSeason={1}
                />,
            );

            expect(container).toBeTruthy();
        });
    });

    describe('Accessibility Tests', () => {
        test('Mobile FAB has proper ARIA attributes', () => {
            render(
                <ArchivesClient
                    data={allSeeds[0].data}
                    seasons={[1]}
                    currentSeason={1}
                />,
            );

            const fab = screen.getByLabelText('Unpin map');
            expect(fab).toHaveAttribute('aria-label', 'Unpin map');
            expect(fab).toHaveAttribute('title', 'Unpin map');
            expect(fab).toHaveAttribute('data-umami-event', 'archive-map-toggle');
        });

        test('Components have proper semantic structure', () => {
            const { container } = render(
                <ArchivesClient
                    data={allSeeds[0].data}
                    seasons={[1]}
                    currentSeason={1}
                />,
            );

            // Check for semantic HTML elements
            const sections = container.querySelectorAll('section');
            expect(sections.length).toBeGreaterThan(0);

            const headings = container.querySelectorAll('h2');
            expect(headings.length).toBeGreaterThan(0);
        });
    });

    describe('Error Handling Tests', () => {
        test('Handles invalid snapshot data gracefully', () => {
            const invalidSnapshotData = {
                ...allSeeds[0].data,
                snapshots: [
                    {
                        season: 1,
                        time: 1000000000,
                        data: 'invalid-json-data', // Not valid JSON
                    },
                ],
            };

            // Should not throw
            expect(() => {
                render(
                    <ArchivesClient
                        data={invalidSnapshotData}
                        seasons={[1]}
                        currentSeason={1}
                    />,
                );
            }).not.toThrow();
        });

        test('Handles missing required data fields', () => {
            const incompleteData = {
                time: 1700000000,
                // Missing many required fields
            };

            // Should not crash
            expect(() => {
                render(
                    <ArchivesClient
                        data={incompleteData}
                        seasons={[1]}
                        currentSeason={1}
                    />,
                );
            }).not.toThrow();
        });
    });

    describe('Data Consistency Tests', () => {
        test('Event data consistency across seasons', () => {
            // Verify that events have consistent structure across all seasons
            allSeeds.forEach(({ season: _season, data }) => {
                if (data.events && data.events.length > 0) {
                    data.events.forEach((event) => {
                        expect(event).toHaveProperty('event_id');
                        expect(event).toHaveProperty('enemy');
                        expect(event).toHaveProperty('region');
                        expect(event).toHaveProperty('type');
                        expect(event).toHaveProperty('status');

                        // Validate enum values
                        expect(['defend', 'attack', 'liberate']).toContain(event.type);
                        expect([
                            'success',
                            'fail',
                            'failed',
                            'active',
                            'pending',
                        ]).toContain(event.status);
                        expect([0, 1, 2]).toContain(event.enemy); // 0=bugs, 1=cyborgs, 2=illuminate
                        expect(event.region).toBeGreaterThanOrEqual(1);
                        expect(event.region).toBeLessThanOrEqual(11);
                    });
                }
            });
        });

        test('Snapshot data consistency', () => {
            allSeeds.forEach(({ season, data }) => {
                if (data.snapshots && data.snapshots.length > 0) {
                    data.snapshots.forEach((snapshot) => {
                        expect(snapshot).toHaveProperty('season', season);
                        expect(snapshot).toHaveProperty('time');
                        expect(typeof snapshot.time).toBe('number');

                        // Validate JSON data structure
                        const parsedData = JSON.parse(snapshot.data);
                        expect(Array.isArray(parsedData)).toBe(true);
                        expect(parsedData.length).toBe(3); // Should have 3 factions

                        parsedData.forEach((factionData) => {
                            expect(factionData).toHaveProperty('points');
                            expect(factionData).toHaveProperty('points_taken');
                            expect(factionData).toHaveProperty('status');
                            expect([
                                'active',
                                'hidden',
                                'liberated',
                                'defeated',
                            ]).toContain(factionData.status);
                        });
                    });
                }
            });
        });
    });
});
