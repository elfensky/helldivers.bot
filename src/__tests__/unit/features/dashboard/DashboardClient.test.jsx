// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useLiveDataContext } from '@/shared/providers/LiveDataContext.mjs';

vi.mock('@/components/h1/Dashboard/DashboardClient.css', () => ({}));
vi.mock('@/features/notifications/NotificationToggle', () => ({
    default: () => null,
}));

// Capture-style mock: each EventCard render emits a <div> carrying the
// props it received as JSON. Tests can then query and parse to inspect
// exactly what the parent passed in (view, points, factionMap, barLabel…).
vi.mock('@/features/galaxy/EventCard', () => ({
    default: (props) => (
        <div
            data-testid={`event-card-${props.factionIndex}-${props.barLabel ?? 'none'}`}
            data-props={JSON.stringify({
                action: props.action,
                region: props.region,
                factionIndex: props.factionIndex,
                barLabel: props.barLabel,
                view: props.view,
                points: props.points,
                pointsMax: props.pointsMax,
                hasFactionMap: props.factionMap != null,
            })}
        />
    ),
    computeFrontier: (campaignData, factionMap) => {
        if (!campaignData || campaignData.status !== 'active') return null;
        const pointsPerSector = campaignData.points_max / 10;
        const sectorsEarned = Math.trunc(campaignData.points / pointsPerSector);
        const frontier = sectorsEarned + 1;
        if (frontier > 10) return null;
        const pointsIntoFrontier = campaignData.points - sectorsEarned * pointsPerSector;
        return {
            sector: frontier,
            region: factionMap?.[frontier]?.region || `Sector ${frontier}`,
            percent: (pointsIntoFrontier / pointsPerSector) * 100,
            points: Math.round(pointsIntoFrontier),
            pointsMax: Math.round(pointsPerSector),
            event: factionMap?.[frontier]?.event || '',
        };
    },
}));

vi.mock('@/features/galaxy/DefeatedCard', () => ({
    default: (props) => (
        <div
            data-testid={`defeated-card-${props.factionIndex}`}
            data-props={JSON.stringify({
                factionIndex: props.factionIndex,
                startTime: props.startTime,
                endTime: props.endTime,
                view: props.view,
            })}
        />
    ),
}));

vi.mock('@/features/dashboard/FactionTabs', () => ({
    default: ({ active, onChange }) => (
        <div data-testid="faction-tabs">
            <button onClick={() => onChange('bugs')}>Bugs</button>
        </div>
    ),
}));
vi.mock('@/features/stats/StatGrid', () => ({
    default: ({ faction }) => <div data-testid="stat-grid">{faction}</div>,
}));
vi.mock('@/features/stats/evaluateProgress.mjs', () => ({
    evaluateProgress: vi.fn(() => null),
}));

import DashboardClient from '@/features/dashboard/DashboardClient';

function makeFactionMap(overrides = {}) {
    const map = {};
    for (let r = 0; r <= 11; r++) {
        map[r] = { region: `Region ${r}`, status: 'lost', event: 'idle', percent: 0 };
    }
    for (const [key, val] of Object.entries(overrides)) {
        map[Number(key)] = { ...map[Number(key)], ...val };
    }
    return map;
}

const baseMapState = {
    0: makeFactionMap(),
    1: makeFactionMap(),
    2: makeFactionMap(),
    3: makeFactionMap(), // Super Earth
};

function getCardProps(testId) {
    const node = screen.queryByTestId(testId);
    if (!node) return null;
    return JSON.parse(node.getAttribute('data-props'));
}

describe('DashboardClient — base rendering', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.mocked(useLiveDataContext).mockReturnValue({
            data: {
                status: [
                    {
                        enemy: 0,
                        points: 1_000_000,
                        points_max: 5_000_000,
                        status: 'active',
                    },
                    { enemy: 1, points: 0, points_max: 5_000_000, status: 'active' },
                    { enemy: 2, points: 0, points_max: 5_000_000, status: 'active' },
                ],
                events: [],
                last_updated: '2025-01-01',
            },
            mapState: baseMapState,
            status: 'live',
            prevData: null,
            isLeader: true,
        });
    });

    afterEach(() => cleanup());

    test('renders child components', () => {
        render(<DashboardClient />);
        expect(screen.getByTestId('faction-tabs')).toBeInTheDocument();
        expect(screen.getByTestId('stat-grid')).toBeInTheDocument();
    });

    test('shows "Stats — Global" heading initially', () => {
        render(<DashboardClient />);
        expect(screen.getByText('Stats — Global')).toBeInTheDocument();
    });

    test('click Bugs tab updates stat-grid faction', () => {
        render(<DashboardClient />);
        fireEvent.click(screen.getByText('Bugs'));
        expect(screen.getByTestId('stat-grid').textContent).toBe('bugs');
    });

    test('shows SIGNAL LOST when data is null', () => {
        vi.mocked(useLiveDataContext).mockReturnValue({
            data: null,
            mapState: null,
            status: 'connecting',
            prevData: null,
            isLeader: false,
        });
        render(<DashboardClient />);
        expect(screen.getByText('SIGNAL LOST')).toBeInTheDocument();
    });

    test('renders Regions header with view toggle', () => {
        render(<DashboardClient />);
        expect(screen.getByText('Regions')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /sector|campaign/i })).toBeDefined();
    });

    test('regions toggle defaults to sector view (EventCard receives view="sector")', () => {
        render(<DashboardClient />);
        const props = getCardProps('event-card-0-SECTOR_PROGRESS');
        expect(props).not.toBeNull();
        expect(props.view).toBe('sector');
    });
});

describe('DashboardClient — regions view toggle persistence', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.mocked(useLiveDataContext).mockReturnValue({
            data: {
                status: [
                    {
                        enemy: 0,
                        points: 1_000_000,
                        points_max: 5_000_000,
                        status: 'active',
                    },
                    { enemy: 1, points: 0, points_max: 5_000_000, status: 'active' },
                    { enemy: 2, points: 0, points_max: 5_000_000, status: 'active' },
                ],
                events: [],
                last_updated: '2025-01-01',
            },
            mapState: baseMapState,
            status: 'live',
            prevData: null,
            isLeader: true,
        });
    });

    afterEach(() => cleanup());

    test('hydrates from localStorage when persisted value is campaign', async () => {
        localStorage.setItem('hd1-regions-view', 'campaign');
        render(<DashboardClient />);
        // Effect runs after mount — wait a microtask
        await new Promise((r) => setTimeout(r, 0));
        const props = getCardProps('event-card-0-SECTOR_PROGRESS');
        expect(props.view).toBe('campaign');
    });

    test('clicking toggle persists new value to localStorage', () => {
        render(<DashboardClient />);
        const toggle = screen.getByRole('button', { name: /switch to campaign/i });
        fireEvent.click(toggle);
        expect(localStorage.getItem('hd1-regions-view')).toBe('campaign');
    });

    test('ignores garbage localStorage values', async () => {
        localStorage.setItem('hd1-regions-view', 'totally-bogus');
        render(<DashboardClient />);
        await new Promise((r) => setTimeout(r, 0));
        const props = getCardProps('event-card-0-SECTOR_PROGRESS');
        // garbage falls through → default 'sector'
        expect(props.view).toBe('sector');
    });
});

describe('DashboardClient — Super Earth defense branch', () => {
    beforeEach(() => {
        localStorage.clear();
    });
    afterEach(() => cleanup());

    test('attacker shown as defending Super Earth in sector view regardless of toggle', () => {
        localStorage.setItem('hd1-regions-view', 'campaign');
        vi.mocked(useLiveDataContext).mockReturnValue({
            data: {
                status: [
                    {
                        enemy: 0,
                        points: 500_000,
                        points_max: 5_000_000,
                        status: 'active',
                    },
                    {
                        enemy: 1,
                        points: 0,
                        points_max: 5_000_000,
                        status: 'active',
                    },
                    {
                        enemy: 2,
                        points: 0,
                        points_max: 5_000_000,
                        status: 'active',
                    },
                ],
                events: [
                    {
                        type: 'defend',
                        region: 0,
                        enemy: 0,
                        status: 'active',
                        start_time: 100,
                        end_time: Math.floor(Date.now() / 1000) + 3600,
                        points: 100,
                        points_max: 1000,
                    },
                ],
                last_updated: '2025-01-01',
            },
            mapState: baseMapState,
            status: 'live',
            prevData: null,
            isLeader: true,
        });

        render(<DashboardClient />);
        // Defender (enemy=0) should get the SUPER_EARTH_DEFENSE card, not a
        // campaign-view frontier card
        const seCard = getCardProps('event-card-0-SUPER_EARTH_DEFENSE');
        expect(seCard).not.toBeNull();
        expect(seCard.action).toBe('defending');
        expect(seCard.region).toBe('Super Earth');
        // SE card is event-focused — view prop stays undefined (defaults to 'sector')
        expect(seCard.view).toBeUndefined();

        // Non-defenders still get their normal frontier cards
        expect(getCardProps('event-card-1-SECTOR_PROGRESS')).not.toBeNull();
        expect(getCardProps('event-card-2-SECTOR_PROGRESS')).not.toBeNull();
    });
});

describe('DashboardClient — homeworld card suppression', () => {
    function setupHomeworldAttack(view) {
        localStorage.setItem('hd1-regions-view', view);
        vi.mocked(useLiveDataContext).mockReturnValue({
            data: {
                status: [
                    {
                        enemy: 0,
                        points: 5_000_000,
                        points_max: 5_000_000,
                        status: 'active',
                    },
                    {
                        enemy: 1,
                        points: 0,
                        points_max: 5_000_000,
                        status: 'active',
                    },
                    {
                        enemy: 2,
                        points: 0,
                        points_max: 5_000_000,
                        status: 'active',
                    },
                ],
                events: [
                    {
                        type: 'attack',
                        region: 11,
                        enemy: 0,
                        status: 'active',
                        start_time: 100,
                        end_time: Math.floor(Date.now() / 1000) + 3600,
                        points: 300,
                        points_max: 1000,
                    },
                ],
                last_updated: '2025-01-01',
            },
            mapState: {
                ...baseMapState,
                0: makeFactionMap({
                    11: {
                        event: 'active',
                        status: 'active',
                        points: 300,
                        points_max: 1000,
                    },
                }),
            },
            status: 'live',
            prevData: null,
            isLeader: true,
        });
    }

    beforeEach(() => {
        localStorage.clear();
    });
    afterEach(() => cleanup());

    test('sector view renders separate HOMEWORLD_ASSAULT card', async () => {
        setupHomeworldAttack('sector');
        render(<DashboardClient />);
        await new Promise((r) => setTimeout(r, 0));
        expect(getCardProps('event-card-0-HOMEWORLD_ASSAULT')).not.toBeNull();
    });

    test('campaign view suppresses the separate homeworld card', async () => {
        setupHomeworldAttack('campaign');
        render(<DashboardClient />);
        await new Promise((r) => setTimeout(r, 0));
        expect(getCardProps('event-card-0-HOMEWORLD_ASSAULT')).toBeNull();
    });
});

describe('DashboardClient — campaign view passes cumulative points', () => {
    beforeEach(() => {
        localStorage.clear();
    });
    afterEach(() => cleanup());

    test('campaign view: EventCard receives points = campaignData.points (not per-sector)', async () => {
        localStorage.setItem('hd1-regions-view', 'campaign');
        vi.mocked(useLiveDataContext).mockReturnValue({
            data: {
                status: [
                    {
                        enemy: 0,
                        points: 3_200_000,
                        points_max: 5_000_000,
                        status: 'active',
                    },
                    { enemy: 1, points: 0, points_max: 5_000_000, status: 'active' },
                    { enemy: 2, points: 0, points_max: 5_000_000, status: 'active' },
                ],
                events: [],
                last_updated: '2025-01-01',
            },
            mapState: baseMapState,
            status: 'live',
            prevData: null,
            isLeader: true,
        });

        render(<DashboardClient />);
        await new Promise((r) => setTimeout(r, 0));
        const props = getCardProps('event-card-0-SECTOR_PROGRESS');
        expect(props.view).toBe('campaign');
        expect(props.points).toBe(3_200_000);
        expect(props.pointsMax).toBe(5_000_000);
        // factionMap must be forwarded in campaign view so the card can
        // render the 11-segment bar
        expect(props.hasFactionMap).toBe(true);
    });

    test('sector view: EventCard receives per-sector points (frontier.points)', async () => {
        localStorage.setItem('hd1-regions-view', 'sector');
        vi.mocked(useLiveDataContext).mockReturnValue({
            data: {
                status: [
                    {
                        enemy: 0,
                        points: 3_200_000,
                        points_max: 5_000_000,
                        status: 'active',
                    },
                    { enemy: 1, points: 0, points_max: 5_000_000, status: 'active' },
                    { enemy: 2, points: 0, points_max: 5_000_000, status: 'active' },
                ],
                events: [],
                last_updated: '2025-01-01',
            },
            mapState: baseMapState,
            status: 'live',
            prevData: null,
            isLeader: true,
        });

        render(<DashboardClient />);
        await new Promise((r) => setTimeout(r, 0));
        const props = getCardProps('event-card-0-SECTOR_PROGRESS');
        expect(props.view).toBe('sector');
        // pointsPerSector = 500K; sectorsEarned = 6; pointsIntoFrontier = 200K
        expect(props.points).toBe(200_000);
        expect(props.pointsMax).toBe(500_000);
    });
});

describe('DashboardClient — defeated faction branch', () => {
    beforeEach(() => {
        localStorage.clear();
    });
    afterEach(() => cleanup());

    test('renders DefeatedCard for a defeated faction in sector view', () => {
        vi.mocked(useLiveDataContext).mockReturnValue({
            data: {
                status: [
                    { enemy: 0, points: 0, points_max: 5_000_000, status: 'active' },
                    { enemy: 1, points: 0, points_max: 5_000_000, status: 'active' },
                    { enemy: 2, points: 0, points_max: 5_000_000, status: 'defeated' },
                ],
                events: [
                    {
                        type: 'attack',
                        region: 11,
                        enemy: 2,
                        status: 'success',
                        start_time: 1000,
                        end_time: 2000,
                        points: 1000,
                        points_max: 1000,
                    },
                ],
                last_updated: '2025-01-01',
            },
            mapState: baseMapState,
            status: 'live',
            prevData: null,
            isLeader: true,
        });

        render(<DashboardClient />);
        const props = getCardProps('defeated-card-2');
        expect(props).not.toBeNull();
        expect(props.factionIndex).toBe(2);
        expect(props.endTime).toBe(2000);
        expect(props.startTime).toBe(1000);
        expect(props.view).toBe('sector');
    });

    test('passes view=campaign to DefeatedCard when toggle is active', async () => {
        localStorage.setItem('hd1-regions-view', 'campaign');
        vi.mocked(useLiveDataContext).mockReturnValue({
            data: {
                status: [
                    { enemy: 0, points: 0, points_max: 5_000_000, status: 'active' },
                    { enemy: 1, points: 0, points_max: 5_000_000, status: 'active' },
                    { enemy: 2, points: 0, points_max: 5_000_000, status: 'defeated' },
                ],
                events: [
                    {
                        type: 'attack',
                        region: 11,
                        enemy: 2,
                        status: 'success',
                        start_time: 1000,
                        end_time: 2000,
                        points: 1000,
                        points_max: 1000,
                    },
                ],
                last_updated: '2025-01-01',
            },
            mapState: baseMapState,
            status: 'live',
            prevData: null,
            isLeader: true,
        });

        render(<DashboardClient />);
        await new Promise((r) => setTimeout(r, 0));
        const props = getCardProps('defeated-card-2');
        expect(props.view).toBe('campaign');
    });
});
