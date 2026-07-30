// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { useLiveDataContext } from '@/shared/providers/LiveDataContext.mjs';

vi.mock('@/features/dashboard/DashboardClient.css', () => ({}));
vi.mock('@/features/notifications/NotificationToggle', () => ({
    default: () => null,
}));

// Capture-style mock: each EventCard render emits a <div> carrying the
// props it received as JSON. Tests can then query and parse to inspect
// exactly what the parent passed in (view, points, factionMap, barLabel…).
// `computeFrontier` is preserved from the real module so tests exercise the
// actual frontier math (avoids drift between mock + production).
vi.mock('@/features/galaxy/EventCard', async () => {
    const actual = await vi.importActual('@/features/galaxy/EventCard');
    return {
        ...actual,
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
    };
});

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

vi.mock('@/shared/components/FactionTabs', () => ({
    default: ({ active: _active, onChange }) => (
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

function makeDashboardMap(overrides = {}) {
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
    0: makeDashboardMap(),
    1: makeDashboardMap(),
    2: makeDashboardMap(),
    3: makeDashboardMap(), // Super Earth
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
                season: 42,
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

    test('renders Stats heading', () => {
        render(<DashboardClient />);
        expect(screen.getByRole('heading', { name: 'Stats' })).toBeInTheDocument();
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

    test('renders Season header with view toggle', () => {
        render(<DashboardClient />);
        expect(screen.getByText('Season 42')).toBeInTheDocument();
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

    test('initializes regions view from initialRegionsView prop', () => {
        render(<DashboardClient initialRegionsView="campaign" />);
        const props = getCardProps('event-card-0-SECTOR_PROGRESS');
        expect(props?.view).toBe('campaign');
    });

    test('clicking toggle persists new value to cookie', () => {
        render(<DashboardClient />);
        const toggle = screen.getByRole('button', { name: /switch to campaign/i });
        fireEvent.click(toggle);
        expect(document.cookie).toContain('hd1-regions-view=campaign');
    });
});

describe('DashboardClient — Super Earth defense branch', () => {
    beforeEach(() => {
        localStorage.clear();
    });
    afterEach(() => cleanup());

    test('attacker shown as defending Super Earth in sector view regardless of toggle', () => {
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

        render(<DashboardClient initialRegionsView="campaign" />);
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
    function setupHomeworldAttack() {
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
                0: makeDashboardMap({
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
        setupHomeworldAttack();
        render(<DashboardClient initialRegionsView="sector" />);
        await waitFor(() =>
            expect(getCardProps('event-card-0-HOMEWORLD_ASSAULT')).not.toBeNull(),
        );
    });

    test('campaign view homeworld card receives view=campaign + factionMap', async () => {
        setupHomeworldAttack();
        render(<DashboardClient initialRegionsView="campaign" />);
        // When all 10 sectors are captured and the homeworld is under attack,
        // the frontier card returns null (computeFrontier → null) and the
        // homeworld card becomes the faction's primary card. In campaign view
        // it must carry the 11-segment bar, so we pass view + factionMap.
        await waitFor(() => {
            const props = getCardProps('event-card-0-HOMEWORLD_ASSAULT');
            expect(props?.view).toBe('campaign');
        });
        const props = getCardProps('event-card-0-HOMEWORLD_ASSAULT');
        expect(props.hasFactionMap).toBe(true);
    });
});

describe('DashboardClient — campaign view passes cumulative points', () => {
    beforeEach(() => {
        localStorage.clear();
    });
    afterEach(() => cleanup());

    test('campaign view: EventCard receives points = campaignData.points (not per-sector)', async () => {
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

        render(<DashboardClient initialRegionsView="campaign" />);
        await waitFor(() => {
            const props = getCardProps('event-card-0-SECTOR_PROGRESS');
            expect(props?.view).toBe('campaign');
        });
        const props = getCardProps('event-card-0-SECTOR_PROGRESS');
        expect(props.points).toBe(3_200_000);
        expect(props.pointsMax).toBe(5_000_000);
        // factionMap must be forwarded in campaign view so the card can
        // render the 11-segment bar
        expect(props.hasFactionMap).toBe(true);
    });

    test('sector view: EventCard receives per-sector points (frontier.points)', async () => {
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
        await waitFor(() => {
            const p = getCardProps('event-card-0-SECTOR_PROGRESS');
            expect(p?.view).toBe('sector');
        });
        const props = getCardProps('event-card-0-SECTOR_PROGRESS');
        // pointsPerSector = 500K; sectorsEarned = 6; pointsIntoFrontier = 200K
        expect(props.points).toBe(200_000);
        expect(props.pointsMax).toBe(500_000);
    });
});

describe('DashboardClient — next-wave forecast card', () => {
    beforeEach(() => {
        localStorage.clear();
    });
    afterEach(() => cleanup());

    test('renders NextWaveCard when a completed defend train exists', () => {
        const now = Math.floor(Date.now() / 1000);
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
                // A single, non-active defend for enemy 0 that ended 30h ago —
                // deriveTrainStarts (waveForecast.mjs) treats it as a train
                // start since it's the only defend on record for that enemy,
                // putting waveForecast into 'window' mode.
                events: [
                    {
                        type: 'defend',
                        region: 3,
                        enemy: 0,
                        status: 'fail',
                        start_time: now - 40 * 3600,
                        end_time: now - 30 * 3600,
                        points: 400,
                        points_max: 1000,
                    },
                ],
                last_updated: '2025-01-01',
                war_start: now - 100 * 24 * 3600,
            },
            mapState: baseMapState,
            status: 'live',
            prevData: null,
            isLeader: true,
        });

        render(<DashboardClient />);
        expect(screen.getByText(/next defend wave/i)).toBeInTheDocument();
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

        render(<DashboardClient initialRegionsView="campaign" />);
        await waitFor(() => {
            const props = getCardProps('defeated-card-2');
            expect(props?.view).toBe('campaign');
        });
    });
});
