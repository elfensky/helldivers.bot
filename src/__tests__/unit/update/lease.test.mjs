import { vi, describe, test, expect, beforeEach } from 'vitest';
import db from '@/db/db';
import {
    claimLease,
    persistPollerState,
    HOLDER_ID,
    WORKER_TYPE,
} from '@/update/lease.mjs';

describe('claimLease', () => {
    beforeEach(() => {
        vi.mocked(db.$queryRaw).mockReset();
        vi.mocked(db.$queryRaw).mockResolvedValue([]);
    });

    test('returns the persisted poller state when the row comes back (lease held)', async () => {
        const prev = [{ event_id: 1, status: 'active' }];
        vi.mocked(db.$queryRaw).mockResolvedValue([
            { holder_id: 'h1', prev_events: prev, last_season_observed: 156 },
        ]);
        const state = await claimLease('h1');
        expect(state).toEqual({ prevEvents: prev, lastSeasonObserved: 156 });
    });

    test('returns null when no row comes back (another instance holds the lease)', async () => {
        vi.mocked(db.$queryRaw).mockResolvedValue([]);
        expect(await claimLease('h1')).toBeNull();
    });

    test('a fresh row has null state, not undefined', async () => {
        vi.mocked(db.$queryRaw).mockResolvedValue([
            { holder_id: 'h1', prev_events: null, last_season_observed: null },
        ]);
        expect(await claimLease('h1')).toEqual({
            prevEvents: null,
            lastSeasonObserved: null,
        });
    });

    test('HOLDER_ID names this process (hostname + pid) so the dashboard can show who polls', () => {
        expect(HOLDER_ID).toContain(String(process.pid));
        expect(HOLDER_ID.split(':').length).toBeGreaterThanOrEqual(3);
    });
});

describe('persistPollerState', () => {
    test('writes only through a holder-guarded updateMany, never an unconditional upsert', async () => {
        const prev = [{ event_id: 2, status: 'success' }];
        await persistPollerState('h1', { prevEvents: prev, lastSeasonObserved: 157 });
        expect(db.worker_heartbeat.updateMany).toHaveBeenCalledWith({
            where: { worker_type: WORKER_TYPE, holder_id: 'h1' },
            data: { prev_events: prev, last_season_observed: 157 },
        });
        expect(db.worker_heartbeat.upsert).not.toHaveBeenCalled();
    });

    test('omits fields that were not supplied', async () => {
        await persistPollerState('h1', { lastSeasonObserved: 3 });
        expect(db.worker_heartbeat.updateMany).toHaveBeenLastCalledWith({
            where: { worker_type: WORKER_TYPE, holder_id: 'h1' },
            data: { last_season_observed: 3 },
        });
    });
});
