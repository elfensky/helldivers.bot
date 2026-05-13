import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Dependency mocks ---

vi.mock('web-push', () => ({
    default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() },
}));
vi.mock('@/db/db', () => ({
    default: {
        push_subscription: {
            deleteMany: vi.fn(),
            findMany: vi.fn(),
        },
        h1_season: { findFirst: vi.fn() },
    },
}));
vi.mock('@/shared/utils/tryCatch.mjs', () => ({
    tryCatch: vi.fn(async (p) => {
        try {
            const data = await p;
            return { data, error: null };
        } catch (e) {
            return { data: null, error: e };
        }
    }),
}));
vi.mock('@/shared/utils/game/detectChanges.mjs', () => ({ detectChanges: vi.fn() }));

import { buildPayload, sendWithConcurrencyLimit } from '@/update/pushNotifier';

describe('buildPayload', () => {
    const bugAttackStarted = {
        kind: 'event_started',
        event: { enemy: 0, type: 'attack', region: 1, season: 142, event_id: 58291 },
    };

    const cyborgDefendWon = {
        kind: 'event_won',
        event: { enemy: 1, type: 'defend', region: 3, season: 142, event_id: 58292 },
    };

    const illuminateLost = {
        kind: 'event_lost',
        event: { enemy: 2, type: 'attack', region: 5, season: 142, event_id: 58293 },
    };

    test('returns a JSON string', () => {
        const result = buildPayload(bugAttackStarted);
        expect(() => JSON.parse(result)).not.toThrow();
    });

    test('uses region-centric title for attack started', () => {
        const payload = JSON.parse(buildPayload(bugAttackStarted));
        expect(payload.title).toBe('Attacking Wise Region');
    });

    test('uses region-centric title for defend won', () => {
        const payload = JSON.parse(buildPayload(cyborgDefendWon));
        expect(payload.title).toBe('Pictor Sector defended');
    });

    test('uses region-centric title for attack lost', () => {
        const payload = JSON.parse(buildPayload(illuminateLost));
        expect(payload.title).toBe('Orionis Region held');
    });

    test('includes event type in body', () => {
        const payload = JSON.parse(buildPayload(bugAttackStarted));
        expect(payload.body).toBe('Attack event started');
    });

    test('uses faction icon', () => {
        const payload = JSON.parse(buildPayload(bugAttackStarted));
        expect(payload.icon).toBe('/icons/faction0.webp');
    });

    test('falls back to superearth icon for unknown faction', () => {
        const unknownFaction = {
            kind: 'event_started',
            event: { enemy: 99, type: 'attack', region: 1, season: 1, event_id: 1 },
        };
        const payload = JSON.parse(buildPayload(unknownFaction));
        expect(payload.icon).toBe('/icons/superearth.webp');
    });

    test('includes badge as favicon PNG', () => {
        const payload = JSON.parse(buildPayload(bugAttackStarted));
        expect(payload.badge).toBe('/favicons/favicon-96x96.png');
    });

    test('includes tag based on event_id', () => {
        const payload = JSON.parse(buildPayload(bugAttackStarted));
        expect(payload.tag).toBe('event-58291');
    });

    test('sets renotify to true', () => {
        const payload = JSON.parse(buildPayload(bugAttackStarted));
        expect(payload.renotify).toBe(true);
    });

    test('omits tag when event_id is missing', () => {
        const noEventId = {
            kind: 'event_started',
            event: { enemy: 0, type: 'attack', region: 1, season: 1 },
        };
        const payload = JSON.parse(buildPayload(noEventId));
        expect(payload.tag).toBeUndefined();
        expect(payload.renotify).toBeUndefined();
    });

    test('includes tag for event_id 0', () => {
        const zeroId = {
            kind: 'event_started',
            event: { enemy: 0, type: 'attack', region: 1, season: 1, event_id: 0 },
        };
        const payload = JSON.parse(buildPayload(zeroId));
        expect(payload.tag).toBe('event-0');
        expect(payload.renotify).toBe(true);
    });

    test('falls back to "Campaign Update" for unknown kind', () => {
        const unknownKind = {
            kind: 'event_unknown',
            event: { enemy: 0, type: 'attack', region: 1, season: 1, event_id: 1 },
        };
        const payload = JSON.parse(buildPayload(unknownKind));
        expect(payload.title).toBe('Campaign Update');
    });

    test('Super Earth defend event (region=0) shows "Super Earth under attack"', () => {
        const seDefendStarted = {
            kind: 'event_started',
            event: {
                enemy: 1, // Cyborgs attacking
                type: 'defend',
                region: 0,
                season: 156,
                event_id: 4921,
            },
        };
        const payload = JSON.parse(buildPayload(seDefendStarted));
        expect(payload.title).toBe('Super Earth under attack');
    });

    test('Super Earth defend won shows "Super Earth defended"', () => {
        const seDefendWon = {
            kind: 'event_won',
            event: {
                enemy: 0, // Bugs
                type: 'defend',
                region: 0,
                season: 156,
                event_id: 4922,
            },
        };
        const payload = JSON.parse(buildPayload(seDefendWon));
        expect(payload.title).toBe('Super Earth defended');
    });

    test('Super Earth defend lost shows "Super Earth lost"', () => {
        const seDefendLost = {
            kind: 'event_lost',
            event: {
                enemy: 2, // Illuminate
                type: 'defend',
                region: 0,
                season: 156,
                event_id: 4923,
            },
        };
        const payload = JSON.parse(buildPayload(seDefendLost));
        expect(payload.title).toBe('Super Earth lost');
    });
});

describe('sendWithConcurrencyLimit', () => {
    const sub1 = {
        endpoint: 'https://example.com/push/1',
        keys_p256dh: 'key1',
        keys_auth: 'auth1',
    };
    const sub2 = {
        endpoint: 'https://example.com/push/2',
        keys_p256dh: 'key2',
        keys_auth: 'auth2',
    };

    let webpush;
    let db;

    beforeEach(async () => {
        vi.clearAllMocks();
        webpush = (await import('web-push')).default;
        db = (await import('@/db/db')).default;
    });

    afterEach(() => {
        // Restore any console spies created inside individual tests so they
        // don't leak silencing into later tests (and into other suites in this
        // file).
        vi.restoreAllMocks();
    });

    test('returns { sent: 2, stale: 0 } when all sends succeed', async () => {
        webpush.sendNotification.mockResolvedValue({ statusCode: 201 });

        const result = await sendWithConcurrencyLimit([sub1, sub2], 'payload');

        expect(result).toEqual({ sent: 2, stale: 0 });
    });

    test('returns { sent: 1, stale: 1 } when one subscription returns 410', async () => {
        webpush.sendNotification
            .mockResolvedValueOnce({ statusCode: 201 })
            .mockRejectedValueOnce({ statusCode: 410 });

        const result = await sendWithConcurrencyLimit([sub1, sub2], 'payload');

        expect(result).toEqual({ sent: 1, stale: 1 });
    });

    test('calls db.push_subscription.deleteMany with stale endpoints', async () => {
        webpush.sendNotification
            .mockResolvedValueOnce({ statusCode: 201 })
            .mockRejectedValueOnce({ statusCode: 410 });
        db.push_subscription.deleteMany.mockResolvedValue({ count: 1 });

        await sendWithConcurrencyLimit([sub1, sub2], 'payload');

        expect(db.push_subscription.deleteMany).toHaveBeenCalledWith({
            where: { endpoint: { in: [sub2.endpoint] } },
        });
    });

    test('returns { sent: 0, stale: 0 } for empty subscriptions array', async () => {
        const result = await sendWithConcurrencyLimit([], 'payload');

        expect(result).toEqual({ sent: 0, stale: 0 });
        expect(webpush.sendNotification).not.toHaveBeenCalled();
        expect(db.push_subscription.deleteMany).not.toHaveBeenCalled();
    });

    test('treats 404 (Not Found) the same as 410 (Gone) — both are stale', async () => {
        webpush.sendNotification.mockRejectedValue({ statusCode: 404 });
        db.push_subscription.deleteMany.mockResolvedValue({ count: 1 });

        const result = await sendWithConcurrencyLimit([sub1], 'payload');

        expect(result).toEqual({ sent: 0, stale: 1 });
        expect(db.push_subscription.deleteMany).toHaveBeenCalledWith({
            where: { endpoint: { in: [sub1.endpoint] } },
        });
    });

    test('5xx rejections are counted as NEITHER sent nor stale — `sent` reflects only fulfilled sendNotification calls', async () => {
        // Updated contract (was: 5xx counted as sent). `sent` now means
        // "actually accepted by web-push" — failed sends regardless of cause
        // are excluded. 410/404 are tagged stale separately.
        webpush.sendNotification.mockRejectedValue({ statusCode: 500 });

        const result = await sendWithConcurrencyLimit([sub1, sub2], 'payload');

        // First assert sendNotification was actually invoked — otherwise a
        // no-op implementation would also produce { sent: 0, stale: 0 }.
        expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
        expect(result).toEqual({ sent: 0, stale: 0 });
        expect(db.push_subscription.deleteMany).not.toHaveBeenCalled();
    });

    test('rejection without statusCode (network error) is counted as neither sent nor stale', async () => {
        webpush.sendNotification.mockRejectedValue(new Error('network timeout'));

        const result = await sendWithConcurrencyLimit([sub1], 'payload');

        // Lock that we DID try to send — distinguishes "fails open" from
        // "never attempted".
        expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ sent: 0, stale: 0 });
        expect(db.push_subscription.deleteMany).not.toHaveBeenCalled();
    });

    test('mixed batch: 1 success + 1 stale (410) + 1 network error → sent:1 stale:1', async () => {
        webpush.sendNotification
            .mockResolvedValueOnce({ statusCode: 201 })
            .mockRejectedValueOnce({ statusCode: 410 })
            .mockRejectedValueOnce(new Error('timeout'));
        db.push_subscription.deleteMany.mockResolvedValue({ count: 1 });

        const sub3 = { endpoint: 'e3', keys_p256dh: 'p3', keys_auth: 'a3' };
        const result = await sendWithConcurrencyLimit([sub1, sub2, sub3], 'payload');

        // All three subs were dispatched (no early bail-out on the rejected ones).
        expect(webpush.sendNotification).toHaveBeenCalledTimes(3);
        expect(result).toEqual({ sent: 1, stale: 1 });
    });

    test('batch boundary: first 50 all reject, second batch still dispatches (no early exit)', async () => {
        // Per-call mocks: first 50 reject with 410 (stale), next 5 succeed.
        // If the loop bailed out after the first batch's rejections, the
        // second batch's 5 calls would never happen.
        let callCount = 0;
        webpush.sendNotification.mockImplementation(() => {
            callCount += 1;
            if (callCount <= 50) {
                return Promise.reject({ statusCode: 410 });
            }
            return Promise.resolve({ statusCode: 201 });
        });
        db.push_subscription.deleteMany.mockResolvedValue({ count: 50 });

        const subs = Array.from({ length: 55 }, (_, i) => ({
            endpoint: `https://example.com/push/${i}`,
            keys_p256dh: `p${i}`,
            keys_auth: `a${i}`,
        }));

        const result = await sendWithConcurrencyLimit(subs, 'payload');

        // All 55 dispatched (the second batch of 5 ran despite the first
        // batch's 50 rejections).
        expect(webpush.sendNotification).toHaveBeenCalledTimes(55);
        expect(result).toEqual({ sent: 5, stale: 50 });
    });

    test('batches sends at MAX_CONCURRENT (50) — second batch waits for first to settle', async () => {
        // Prove batching by gating the first 50 sends: their promises only
        // resolve when we say so. If the implementation fired all 75 at once
        // (no batching), the call count would already be 75 before we resolve.
        // With batching, only 50 should be in flight until the first batch
        // settles. Then the second batch of 25 starts.
        const resolvers = [];
        webpush.sendNotification.mockImplementation(
            () =>
                new Promise((res) => {
                    resolvers.push(res);
                }),
        );

        const subs = Array.from({ length: 75 }, (_, i) => ({
            endpoint: `https://example.com/push/${i}`,
            keys_p256dh: `p${i}`,
            keys_auth: `a${i}`,
        }));

        const promise = sendWithConcurrencyLimit(subs, 'payload');

        // Let the synchronous chunk of the first batch dispatch.
        await Promise.resolve();
        await Promise.resolve();

        // First batch only: 50 in flight.
        expect(resolvers.length).toBe(50);
        expect(webpush.sendNotification).toHaveBeenCalledTimes(50);

        // Resolve the first batch and let the loop pick up the next iteration.
        resolvers.slice(0, 50).forEach((res) => res({ statusCode: 201 }));
        await Promise.resolve();
        await Promise.resolve();

        // Second batch of 25 now dispatched.
        expect(resolvers.length).toBe(75);
        expect(webpush.sendNotification).toHaveBeenCalledTimes(75);

        // Drain the rest so the outer promise resolves.
        resolvers.slice(50, 75).forEach((res) => res({ statusCode: 201 }));
        const result = await promise;
        expect(result.sent).toBe(75);
    });

    test('DB cleanup failure is logged but does NOT throw (push continues)', async () => {
        webpush.sendNotification.mockRejectedValue({ statusCode: 410 });
        db.push_subscription.deleteMany.mockRejectedValue(new Error('db down'));
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const result = await sendWithConcurrencyLimit([sub1], 'payload');

        // Still returns the result — DB failure does NOT crash send loop.
        expect(result).toEqual({ sent: 0, stale: 1 });
        expect(errSpy).toHaveBeenCalledWith(
            'Failed to cleanup stale push subscriptions:',
            'db down',
        );
    });

    test('logs cleanup count when stale subscriptions are successfully deleted', async () => {
        webpush.sendNotification
            .mockResolvedValueOnce({ statusCode: 201 })
            .mockRejectedValueOnce({ statusCode: 410 })
            .mockRejectedValueOnce({ statusCode: 404 });
        db.push_subscription.deleteMany.mockResolvedValue({ count: 2 });
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

        await sendWithConcurrencyLimit(
            [sub1, sub2, { endpoint: 'sub3', keys_p256dh: 'p3', keys_auth: 'a3' }],
            'payload',
        );

        expect(logSpy).toHaveBeenCalledWith('Cleaned up 2 stale push subscriptions');
    });

    test('webpush.sendNotification is called with the correct subscription shape (endpoint + keys)', async () => {
        webpush.sendNotification.mockResolvedValue({ statusCode: 201 });

        await sendWithConcurrencyLimit([sub1], 'payload-bytes');

        expect(webpush.sendNotification).toHaveBeenCalledWith(
            {
                endpoint: sub1.endpoint,
                keys: { p256dh: sub1.keys_p256dh, auth: sub1.keys_auth },
            },
            'payload-bytes',
        );
    });
});

describe('ensureVapid', () => {
    // ensureVapid uses module-level state (`configured` flag), so we reset
    // modules per test and dynamic-import a fresh copy.

    beforeEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    test('returns false when VAPID_PUBLIC_KEY is missing', async () => {
        vi.stubEnv('VAPID_PUBLIC_KEY', '');
        vi.stubEnv('VAPID_PRIVATE_KEY', 'priv');
        vi.stubEnv('VAPID_SUBJECT', 'mailto:x@y.z');
        const { ensureVapid } = await import('@/update/pushNotifier');

        expect(ensureVapid()).toBe(false);
    });

    test('returns false when VAPID_PRIVATE_KEY is missing', async () => {
        vi.stubEnv('VAPID_PUBLIC_KEY', 'pub');
        vi.stubEnv('VAPID_PRIVATE_KEY', '');
        vi.stubEnv('VAPID_SUBJECT', 'mailto:x@y.z');
        const { ensureVapid } = await import('@/update/pushNotifier');

        expect(ensureVapid()).toBe(false);
    });

    test('returns false when VAPID_SUBJECT is missing', async () => {
        vi.stubEnv('VAPID_PUBLIC_KEY', 'pub');
        vi.stubEnv('VAPID_PRIVATE_KEY', 'priv');
        vi.stubEnv('VAPID_SUBJECT', '');
        const { ensureVapid } = await import('@/update/pushNotifier');

        expect(ensureVapid()).toBe(false);
    });

    test('returns true and configures web-push when all three VAPID env vars are set', async () => {
        vi.stubEnv('VAPID_PUBLIC_KEY', 'pub-key');
        vi.stubEnv('VAPID_PRIVATE_KEY', 'priv-key');
        vi.stubEnv('VAPID_SUBJECT', 'mailto:admin@example.com');
        const webpush = (await import('web-push')).default;
        webpush.setVapidDetails.mockClear();

        const { ensureVapid } = await import('@/update/pushNotifier');

        expect(ensureVapid()).toBe(true);
        expect(webpush.setVapidDetails).toHaveBeenCalledTimes(1);
        expect(webpush.setVapidDetails).toHaveBeenCalledWith(
            'mailto:admin@example.com',
            'pub-key',
            'priv-key',
        );
    });

    test('is memoised — subsequent calls do NOT re-configure web-push', async () => {
        vi.stubEnv('VAPID_PUBLIC_KEY', 'pub-key');
        vi.stubEnv('VAPID_PRIVATE_KEY', 'priv-key');
        vi.stubEnv('VAPID_SUBJECT', 'mailto:admin@example.com');
        const webpush = (await import('web-push')).default;
        webpush.setVapidDetails.mockClear();

        const { ensureVapid } = await import('@/update/pushNotifier');

        ensureVapid();
        ensureVapid();
        ensureVapid();

        expect(webpush.setVapidDetails).toHaveBeenCalledTimes(1);
    });
});

describe('checkAndNotify', () => {
    // checkAndNotify uses module-level `prevEvents` state. Reset modules per
    // test for clean state. Stub VAPID env so ensureVapid() returns true
    // (skipped explicitly in the first test).

    beforeEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
        vi.stubEnv('VAPID_PUBLIC_KEY', 'pub');
        vi.stubEnv('VAPID_PRIVATE_KEY', 'priv');
        vi.stubEnv('VAPID_SUBJECT', 'mailto:x@y.z');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        // Restore any console.error/log spies created inside individual tests
        // so they don't leak silencing into later tests.
        vi.restoreAllMocks();
    });

    test('returns early (no fetch) when ensureVapid is false', async () => {
        vi.stubEnv('VAPID_PUBLIC_KEY', '');
        const dbModule = (await import('@/db/db')).default;
        const { checkAndNotify } = await import('@/update/pushNotifier');

        await checkAndNotify();

        expect(dbModule.h1_season.findFirst).not.toHaveBeenCalled();
    });

    test('returns early when h1_season.findFirst returns null (no seasons)', async () => {
        const dbModule = (await import('@/db/db')).default;
        dbModule.h1_season.findFirst.mockResolvedValue(null);
        const { checkAndNotify } = await import('@/update/pushNotifier');

        await checkAndNotify();

        // No subscription fetch, no send.
        expect(dbModule.push_subscription.findMany).not.toHaveBeenCalled();
    });

    test('returns early on findFirst error — resolves cleanly, does not fetch subscriptions', async () => {
        const dbModule = (await import('@/db/db')).default;
        dbModule.h1_season.findFirst.mockRejectedValue(new Error('db connect'));
        const { checkAndNotify } = await import('@/update/pushNotifier');

        await expect(checkAndNotify()).resolves.toBeUndefined();
        expect(dbModule.push_subscription.findMany).not.toHaveBeenCalled();
    });

    test('first call (prevEvents=null) ESTABLISHES baseline — does NOT detect changes or send', async () => {
        const dbModule = (await import('@/db/db')).default;
        const events = [
            { event_id: 1, status: 'active', enemy: 0, region: 5, type: 'defend' },
        ];
        dbModule.h1_season.findFirst.mockResolvedValue({ events });
        const { detectChanges } = await import('@/shared/utils/game/detectChanges.mjs');
        const { checkAndNotify } = await import('@/update/pushNotifier');

        await checkAndNotify();

        // detectChanges is NOT called on the first run — we just snapshot.
        expect(detectChanges).not.toHaveBeenCalled();
        expect(dbModule.push_subscription.findMany).not.toHaveBeenCalled();
    });

    test('second call: detectChanges is invoked with (prevEvents, currentEvents) in that order', async () => {
        // Strengthened from "called once" to also assert the actual args:
        // baseline events FIRST, then the new snapshot. A regression that
        // swaps the order would still get "called once" but compare the
        // wrong snapshots.
        const dbModule = (await import('@/db/db')).default;
        const events1 = [
            { event_id: 1, status: 'active', enemy: 0, region: 5, type: 'defend' },
        ];
        const events2 = [
            { event_id: 1, status: 'active', enemy: 0, region: 5, type: 'defend' },
        ];
        dbModule.h1_season.findFirst
            .mockResolvedValueOnce({ events: events1 })
            .mockResolvedValueOnce({ events: events2 });
        const { detectChanges } = await import('@/shared/utils/game/detectChanges.mjs');
        detectChanges.mockReturnValue([]); // No changes between calls.
        const { checkAndNotify } = await import('@/update/pushNotifier');

        await checkAndNotify(); // baseline
        await checkAndNotify(); // diff against baseline → no changes

        expect(detectChanges).toHaveBeenCalledTimes(1);
        expect(detectChanges).toHaveBeenCalledWith(events1, events2);
        expect(dbModule.push_subscription.findMany).not.toHaveBeenCalled();
    });

    test('second call WITH changes: fetches subs and sends one batch per change', async () => {
        const dbModule = (await import('@/db/db')).default;
        const webpush = (await import('web-push')).default;
        const events1 = [
            { event_id: 1, status: 'active', enemy: 0, region: 5, type: 'defend' },
        ];
        const events2 = [
            { event_id: 1, status: 'success', enemy: 0, region: 5, type: 'defend' },
        ];

        dbModule.h1_season.findFirst
            .mockResolvedValueOnce({ events: events1 })
            .mockResolvedValueOnce({ events: events2 });
        dbModule.push_subscription.findMany.mockResolvedValue([
            { endpoint: 'e1', keys_p256dh: 'p1', keys_auth: 'a1' },
        ]);
        const { detectChanges } = await import('@/shared/utils/game/detectChanges.mjs');
        detectChanges.mockReturnValue([
            { kind: 'event_won', event: events2[0] },
            { kind: 'event_started', event: { ...events2[0], event_id: 2 } },
        ]);
        webpush.sendNotification.mockResolvedValue({ statusCode: 201 });

        const { checkAndNotify } = await import('@/update/pushNotifier');
        await checkAndNotify(); // baseline
        await checkAndNotify(); // diff → changes → send

        // findMany called ONCE (not per change — it's outside the changes loop).
        expect(dbModule.push_subscription.findMany).toHaveBeenCalledTimes(1);
        // 2 changes × 1 subscription = 2 sendNotification calls.
        expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
    });

    test('subscription fetch error is logged, no send happens, but no exception thrown', async () => {
        const dbModule = (await import('@/db/db')).default;
        const events1 = [
            { event_id: 1, status: 'active', enemy: 0, region: 5, type: 'defend' },
        ];
        const events2 = [
            { event_id: 1, status: 'success', enemy: 0, region: 5, type: 'defend' },
        ];

        dbModule.h1_season.findFirst
            .mockResolvedValueOnce({ events: events1 })
            .mockResolvedValueOnce({ events: events2 });
        const { detectChanges } = await import('@/shared/utils/game/detectChanges.mjs');
        detectChanges.mockReturnValue([{ kind: 'event_won', event: events2[0] }]);
        dbModule.push_subscription.findMany.mockRejectedValue(
            new Error('subs query failed'),
        );
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const webpush = (await import('web-push')).default;
        webpush.sendNotification.mockClear();

        const { checkAndNotify } = await import('@/update/pushNotifier');
        await checkAndNotify();
        await expect(checkAndNotify()).resolves.toBeUndefined();

        expect(errSpy).toHaveBeenCalledWith(
            'Failed to fetch push subscriptions:',
            'subs query failed',
        );
        expect(webpush.sendNotification).not.toHaveBeenCalled();
    });

    test('changes detected but ZERO subscriptions → does NOT call sendNotification', async () => {
        const dbModule = (await import('@/db/db')).default;
        const events1 = [
            { event_id: 1, status: 'active', enemy: 0, region: 5, type: 'defend' },
        ];
        const events2 = [
            { event_id: 1, status: 'success', enemy: 0, region: 5, type: 'defend' },
        ];

        dbModule.h1_season.findFirst
            .mockResolvedValueOnce({ events: events1 })
            .mockResolvedValueOnce({ events: events2 });
        const { detectChanges } = await import('@/shared/utils/game/detectChanges.mjs');
        detectChanges.mockReturnValue([{ kind: 'event_won', event: events2[0] }]);
        dbModule.push_subscription.findMany.mockResolvedValue([]);
        const webpush = (await import('web-push')).default;
        webpush.sendNotification.mockClear();

        const { checkAndNotify } = await import('@/update/pushNotifier');
        await checkAndNotify();
        await checkAndNotify();

        expect(webpush.sendNotification).not.toHaveBeenCalled();
    });
});
