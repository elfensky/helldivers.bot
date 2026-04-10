import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendTestNotification } from '@/features/admin/actions.mjs';

vi.mock('@/auth', () => ({
    auth: { api: { getSession: vi.fn() } },
}));
vi.mock('next/headers', () => ({
    headers: vi.fn(() => new Headers()),
}));
vi.mock('@/shared/utils/tryCatch', () => ({
    tryCatch: vi.fn(async (p) => {
        try {
            const data = await p;
            return { data, error: null };
        } catch (e) {
            return { data: null, error: e };
        }
    }),
}));
vi.mock('@/update/pushNotifier', () => ({
    ensureVapid: vi.fn(),
    sendWithConcurrencyLimit: vi.fn(),
    buildPayload: vi.fn(() => JSON.stringify({
        title: 'Test Region under attack',
        body: 'Defend event started',
        icon: '/icons/faction0.webp',
        badge: '/favicons/favicon-96x96.png',
        tag: 'event-test',
        renotify: true,
    })),
}));
vi.mock('@/db/db', () => ({
    default: { push_subscription: { findMany: vi.fn() } },
}));

import { auth } from '@/auth';
import { ensureVapid, sendWithConcurrencyLimit } from '@/update/pushNotifier';
import db from '@/db/db';

const adminSession = { user: { role: 'admin', id: '1' } };

beforeEach(() => {
    vi.resetAllMocks();
    auth.api.getSession.mockResolvedValue(adminSession);
    ensureVapid.mockReturnValue(true);
    db.push_subscription.findMany.mockResolvedValue([{ endpoint: 'a' }, { endpoint: 'b' }]);
    sendWithConcurrencyLimit.mockResolvedValue({ sent: 2, stale: 0 });
});

describe('sendTestNotification', () => {
    it('returns { error: "Unauthorized" } when session is null', async () => {
        auth.api.getSession.mockResolvedValue(null);
        const result = await sendTestNotification();
        expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('returns { error: "Unauthorized" } when user is not admin', async () => {
        auth.api.getSession.mockResolvedValue({ user: { role: 'user' } });
        const result = await sendTestNotification();
        expect(result).toEqual({ error: 'Unauthorized' });
    });

    it('returns { error: "VAPID keys not configured" } when ensureVapid returns false', async () => {
        ensureVapid.mockReturnValue(false);
        const result = await sendTestNotification();
        expect(result).toEqual({ error: 'VAPID keys not configured' });
    });

    it('returns { error: "No push subscribers" } when no subscriptions', async () => {
        db.push_subscription.findMany.mockResolvedValue([]);
        const result = await sendTestNotification();
        expect(result).toEqual({ error: 'No push subscribers' });
    });

    it('returns { sent, stale } on success', async () => {
        const result = await sendTestNotification();
        expect(result).toEqual({ sent: 2, stale: 0 });
    });

    it('returns { error } when sendWithConcurrencyLimit throws', async () => {
        sendWithConcurrencyLimit.mockRejectedValue(new Error('send failed'));
        const result = await sendTestNotification();
        expect(result).toEqual({ error: 'send failed' });
    });

    it('returns { error } when findMany throws', async () => {
        db.push_subscription.findMany.mockRejectedValue(new Error('db error'));
        const result = await sendTestNotification();
        expect(result).toEqual({ error: 'db error' });
    });
});
