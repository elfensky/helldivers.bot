import db from '@/db/db';
import { HOLDER_ID } from '@/update/lease.mjs';
import { registerInstance, listInstances, pruneInstances } from '@/update/instance.mjs';

// The 20 s throttle is module state, so every test passes its own, strictly
// increasing clock.
const HOUR = 3_600_000;
const BASE = Date.parse('2030-01-01T00:00:00Z');

describe('registerInstance', () => {
    test('upserts this process under HOLDER_ID', async () => {
        const now = BASE;
        await registerInstance(now);

        const row = {
            host: HOLDER_ID.split(':')[0],
            version: expect.any(String),
            worker_enabled: true,
            started_at: expect.any(Date),
            last_seen: new Date(now),
        };
        expect(db.app_instance.upsert).toHaveBeenCalledWith({
            where: { id: HOLDER_ID },
            create: { id: HOLDER_ID, ...row },
            update: row,
        });
    });

    test('writes at most once per 20 s', async () => {
        const now = BASE + HOUR;
        await registerInstance(now);
        await registerInstance(now + 19_999);
        expect(db.app_instance.upsert).toHaveBeenCalledTimes(1);

        await registerInstance(now + 20_000);
        expect(db.app_instance.upsert).toHaveBeenCalledTimes(2);
    });

    test('records worker_enabled false when WORKER_ENABLED=false', async () => {
        vi.stubEnv('WORKER_ENABLED', 'false');
        await registerInstance(BASE + 2 * HOUR);
        expect(db.app_instance.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                update: expect.objectContaining({ worker_enabled: false }),
            }),
        );
        vi.unstubAllEnvs();
    });
});

describe('listInstances', () => {
    test('reads rows seen in the last 24 h', async () => {
        const rows = [{ id: 'a' }];
        db.app_instance.findMany.mockResolvedValue(rows);
        const now = BASE + 3 * HOUR;
        await expect(listInstances(now)).resolves.toBe(rows);
        expect(db.app_instance.findMany).toHaveBeenCalledWith({
            where: { last_seen: { gte: new Date(now - 86_400_000) } },
        });
    });
});

describe('pruneInstances', () => {
    test('deletes rows last seen more than 24 h ago', async () => {
        const now = BASE + 4 * HOUR;
        await pruneInstances(now);
        expect(db.app_instance.deleteMany).toHaveBeenCalledWith({
            where: { last_seen: { lt: new Date(now - 86_400_000) } },
        });
    });
});
