import { computeReplicas } from '@/shared/utils/admin/computeReplicas.mjs';

const now = Date.parse('2026-10-25T12:00:00Z');
const ago = (ms) => new Date(now - ms);

let n = 0;
function row(overrides = {}) {
    n += 1;
    return {
        id: `host-${n}:1:aaaa`,
        host: `host-${n}`,
        version: '0.96.4',
        worker_enabled: true,
        started_at: ago(3_600_000),
        last_seen: ago(30_000),
        ...overrides,
    };
}
const lease = (id, ms = 30_000) => ({
    holder_id: id,
    lease_until: new Date(now + ms),
});

describe('computeReplicas roles', () => {
    test('lease holder with a live lease is the poller, listed first', () => {
        const a = row({ host: 'a' });
        const b = row({ host: 'b' });
        const r = computeReplicas([a, b], lease(b.id), now);
        expect(r.replicas[0]).toMatchObject({ id: b.id, role: 'poller', state: 'live' });
        expect(r.replicas[1]).toMatchObject({ id: a.id, role: 'standby' });
        expect(r.hasPoller).toBe(true);
    });

    test('an expired lease makes the holder a standby', () => {
        const a = row();
        const r = computeReplicas([a], lease(a.id, -1_000), now);
        expect(r.replicas[0].role).toBe('standby');
        expect(r.hasPoller).toBe(false);
    });

    test('worker_enabled false is web only', () => {
        const r = computeReplicas(
            [row({ worker_enabled: false, last_seen: ago(10_000) })],
            null,
            now,
        );
        expect(r.replicas[0].role).toBe('web');
    });

    test('no heartbeat: every enabled replica is a standby, no poller', () => {
        const r = computeReplicas([row(), row()], null, now);
        expect(r.replicas.map((x) => x.role)).toEqual(['standby', 'standby']);
        expect(r.hasPoller).toBe(false);
    });

    test('a null lease_until never makes a poller', () => {
        const a = row();
        const r = computeReplicas([a], { holder_id: a.id, lease_until: null }, now);
        expect(r.replicas[0].role).toBe('standby');
    });

    test('replicas sort poller first, then by host', () => {
        const a = row({ host: 'zeta' });
        const b = row({ host: 'alpha' });
        const c = row({ host: 'mid' });
        const r = computeReplicas([a, b, c], lease(a.id), now);
        expect(r.replicas.map((x) => x.host)).toEqual(['zeta', 'alpha', 'mid']);
    });
});

describe('computeReplicas states', () => {
    test('live up to 90 s, late after', () => {
        const live = row({ last_seen: ago(90_000) });
        const late = row({ last_seen: ago(90_001) });
        const r = computeReplicas([live, late], null, now);
        expect(r.replicas.find((x) => x.id === live.id).state).toBe('live');
        expect(r.replicas.find((x) => x.id === late.id).state).toBe('late');
    });

    test('late up to 5 min, gone after', () => {
        const late = row({ last_seen: ago(300_000) });
        const gone = row({ last_seen: ago(300_001) });
        const r = computeReplicas([late, gone], null, now);
        expect(r.replicas.map((x) => x.id)).toEqual([late.id]);
        expect(r.replicas[0].state).toBe('late');
        expect(r.gone.map((x) => x.id)).toEqual([gone.id]);
    });

    test('gone is sorted newest last_seen first', () => {
        const older = row({ last_seen: ago(3_600_000) });
        const newer = row({ last_seen: ago(600_000) });
        const r = computeReplicas([older, newer], null, now);
        expect(r.gone.map((x) => x.id)).toEqual([newer.id, older.id]);
    });

    test('accepts ISO strings as well as Dates', () => {
        const a = row({
            last_seen: ago(30_000).toISOString(),
            started_at: ago(60_000).toISOString(),
        });
        const r = computeReplicas(
            [a],
            { holder_id: a.id, lease_until: new Date(now + 5_000).toISOString() },
            now,
        );
        expect(r.replicas[0]).toMatchObject({ role: 'poller', state: 'live' });
    });
});

describe('computeReplicas version skew', () => {
    const skewed = (ageMs) => [
        row({ version: '0.96.4' }),
        row({ version: '0.97.0', started_at: ago(ageMs) }),
        row({ version: '0.97.0', started_at: ago(ageMs - 60_000) }),
    ];

    test('lists live versions oldest to newest', () => {
        const r = computeReplicas(skewed(300_000), null, now);
        expect(r.liveVersions).toEqual(['0.96.4', '0.97.0']);
    });

    test('quiet for the first 10 min, alert after', () => {
        const quiet = computeReplicas(skewed(9 * 60_000), null, now);
        expect(quiet.skew.alert).toBe(false);
        const loud = computeReplicas(skewed(11 * 60_000), null, now);
        expect(loud.skew.alert).toBe(true);
    });

    test('since is the earliest start of the newest version', () => {
        const rows = skewed(11 * 60_000);
        const r = computeReplicas(rows, null, now);
        expect(r.skew.since).toEqual(rows[1].started_at);
    });

    test('numeric order: 0.100.0 is newer than 0.99.9', () => {
        const r = computeReplicas(
            [row({ version: '0.100.0' }), row({ version: '0.99.9' })],
            null,
            now,
        );
        expect(r.liveVersions).toEqual(['0.99.9', '0.100.0']);
    });

    test('a late replica on another version creates no skew', () => {
        const r = computeReplicas(
            [row(), row({ version: '0.95.0', last_seen: ago(120_000) })],
            null,
            now,
        );
        expect(r.liveVersions).toEqual(['0.96.4']);
        expect(r.skew).toBeNull();
    });

    test('a single live version has no skew', () => {
        expect(computeReplicas([row(), row()], null, now).skew).toBeNull();
    });
});
