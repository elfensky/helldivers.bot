// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getSystemStats } from '@/features/admin/actions.mjs';
import SystemOverview from '@/features/admin/SystemOverview.jsx';

vi.mock('@/features/admin/actions.mjs', () => ({ getSystemStats: vi.fn() }));

const ago = (ms) => new Date(Date.now() - ms);

function replica(overrides = {}) {
    return {
        id: 'production01-2:1:aaaa',
        host: 'production01-2',
        version: '0.96.4',
        worker_enabled: true,
        started_at: ago(3_600_000),
        last_seen: ago(10_000),
        role: 'poller',
        state: 'live',
        ...overrides,
    };
}

function data(overrides = {}) {
    return {
        heartbeat: {
            last_beat: ago(5_000),
            poll_duration_ms: 85,
            last_error: null,
            started_at: ago(7_200_000),
            holder_id: 'production01-2:1:aaaa',
        },
        workerHealth: { status: 'healthy', label: 'Worker healthy' },
        currentSeason: 160,
        activeFactions: 2,
        totalEvents: 1842,
        seasonsStored: 160,
        totalUsers: 24,
        totalApiKeys: 9,
        pushSubscribers: 6,
        replicas: [replica()],
        gone: [],
        liveVersions: ['0.96.4'],
        skew: null,
        hasPoller: true,
        ...overrides,
    };
}

async function renderWith(overrides) {
    vi.mocked(getSystemStats).mockResolvedValue({ data: data(overrides) });
    render(await SystemOverview());
}

describe('SystemOverview', () => {
    test('renders the poller first, the late standby, and the table groups', async () => {
        await renderWith({
            replicas: [
                replica(),
                replica({
                    id: 'production01-3:1:bbbb',
                    host: 'production01-3',
                    role: 'standby',
                    state: 'late',
                }),
            ],
        });
        expect(screen.getByText('Poller')).toBeTruthy();
        expect(screen.getByTitle('production01-2')).toBeTruthy();
        expect(screen.getByText(/Late/)).toBeTruthy();
        for (const heading of ['Health', 'Game data', 'Community']) {
            expect(screen.getByRole('heading', { name: heading })).toBeTruthy();
        }
        expect(screen.getByText('Polling since')).toBeTruthy();
        expect(screen.queryByText(/^Uptime$/i)).toBeNull();
        const hosts = screen.getAllByTitle(/production01-/).map((el) => el.title);
        expect(hosts).toEqual(['production01-2', 'production01-3']);
    });

    test('folds gone replicas under a counted summary', async () => {
        const g = (id) => replica({ id, host: id, last_seen: ago(3_600_000) });
        await renderWith({ gone: [g('old-1'), g('old-2')] });
        const summary = screen.getByText('Gone in the last 24 h (2)');
        expect(summary.tagName).toBe('SUMMARY');
        expect(summary.getAttribute('data-umami-event')).toBe(
            'debug-replicas-gone-toggle',
        );
    });

    test('renders no summary when nothing is gone', async () => {
        await renderWith({});
        expect(document.querySelector('summary')).toBeNull();
    });

    test('alerts on version skew, a missing poller and the last error', async () => {
        await renderWith({
            skew: { since: ago(11 * 60_000), alert: true },
            liveVersions: ['0.96.4', '0.97.0'],
            hasPoller: false,
            heartbeat: { ...data().heartbeat, last_error: 'boom' },
        });
        expect(screen.getByText(/Version skew/)).toBeTruthy();
        expect(screen.getByText(/No poller/)).toBeTruthy();
        expect(screen.getByText(/boom/)).toBeTruthy();
    });

    test('shows a quiet note while a rollout is young', async () => {
        await renderWith({
            skew: { since: ago(2 * 60_000), alert: false },
            liveVersions: ['0.96.4', '0.97.0'],
        });
        expect(screen.getByText(/Rollout in progress/)).toBeTruthy();
        expect(screen.queryByText(/Version skew/)).toBeNull();
    });

    test('shows an empty state when no replica reported', async () => {
        await renderWith({ replicas: [], hasPoller: false });
        expect(
            screen.getByText('No replica has reported in the last 5 minutes.'),
        ).toBeTruthy();
    });
});
