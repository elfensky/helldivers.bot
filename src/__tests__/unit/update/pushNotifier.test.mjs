import { describe, test, expect, vi, beforeEach } from 'vitest';

// --- Dependency mocks ---

vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() } }));
vi.mock('@/db/db', () => ({ default: { push_subscription: { deleteMany: vi.fn() } } }));
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
        event: { enemy: 0, type: 'attack', season: 142, event_id: 58291 },
    };

    const cyborgDefendWon = {
        kind: 'event_won',
        event: { enemy: 1, type: 'defend', season: 142, event_id: 58292 },
    };

    const illuminateLost = {
        kind: 'event_lost',
        event: { enemy: 2, type: 'attack', season: 142, event_id: 58293 },
    };

    test('returns a JSON string', () => {
        const result = buildPayload(bugAttackStarted);
        expect(() => JSON.parse(result)).not.toThrow();
    });

    test('includes faction name and event type in title', () => {
        const payload = JSON.parse(buildPayload(bugAttackStarted));
        expect(payload.title).toBe('Bugs attack event started');
    });

    test('uses "won!" suffix for event_won', () => {
        const payload = JSON.parse(buildPayload(cyborgDefendWon));
        expect(payload.title).toBe('Cyborgs defend event won!');
    });

    test('uses plain suffix for event_lost', () => {
        const payload = JSON.parse(buildPayload(illuminateLost));
        expect(payload.title).toBe('The Illuminate attack event lost');
    });

    test('includes season in body', () => {
        const payload = JSON.parse(buildPayload(bugAttackStarted));
        expect(payload.body).toBe('Season 142');
    });

    test('uses faction icon', () => {
        const payload = JSON.parse(buildPayload(bugAttackStarted));
        expect(payload.icon).toBe('/icons/faction0.webp');
    });

    test('falls back to superearth icon for unknown faction', () => {
        const unknownFaction = {
            kind: 'event_started',
            event: { enemy: 99, type: 'attack', season: 1, event_id: 1 },
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
            event: { enemy: 0, type: 'attack', season: 1 },
        };
        const payload = JSON.parse(buildPayload(noEventId));
        expect(payload.tag).toBeUndefined();
        expect(payload.renotify).toBeUndefined();
    });

    test('includes tag for event_id 0', () => {
        const zeroId = {
            kind: 'event_started',
            event: { enemy: 0, type: 'attack', season: 1, event_id: 0 },
        };
        const payload = JSON.parse(buildPayload(zeroId));
        expect(payload.tag).toBe('event-0');
        expect(payload.renotify).toBe(true);
    });

    test('falls back to "Campaign Update" for unknown kind', () => {
        const unknownKind = {
            kind: 'event_unknown',
            event: { enemy: 0, type: 'attack', season: 1, event_id: 1 },
        };
        const payload = JSON.parse(buildPayload(unknownKind));
        expect(payload.title).toBe('Campaign Update');
    });
});

describe('sendWithConcurrencyLimit', () => {
    const sub1 = { endpoint: 'https://example.com/push/1', keys_p256dh: 'key1', keys_auth: 'auth1' };
    const sub2 = { endpoint: 'https://example.com/push/2', keys_p256dh: 'key2', keys_auth: 'auth2' };

    let webpush;
    let db;

    beforeEach(async () => {
        vi.clearAllMocks();
        webpush = (await import('web-push')).default;
        db = (await import('@/db/db')).default;
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
});
