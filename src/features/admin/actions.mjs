'use server';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { tryCatch } from '@/shared/utils/tryCatch';
import { ensureVapid, sendWithConcurrencyLimit, buildPayload } from '@/update/pushNotifier';
import db from '@/db/db';

/**
 * Send a test push notification using the same payload format as real events.
 *
 * @param {{ enemy: number, region: number, type: string, kind: string }} opts
 */
export async function sendTestNotification({ enemy = 0, region = 3, type = 'defend', kind = 'event_started' } = {}) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || session.user.role !== 'admin') {
        return { error: 'Unauthorized' };
    }

    if (!ensureVapid()) {
        return { error: 'VAPID keys not configured' };
    }

    const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const change = {
        kind,
        event: { enemy, region, type, event_id: `test-${Date.now()}`, season: 0 },
    };
    const base = JSON.parse(buildPayload(change));
    base.body = `${base.body} — ${time}`;
    const payload = JSON.stringify(base);

    const { data: subscriptions, error: fetchError } = await tryCatch(db.push_subscription.findMany());
    if (fetchError) return { error: fetchError.message };
    if (!subscriptions || subscriptions.length === 0) return { error: 'No push subscribers' };

    const { data: result, error: sendError } = await tryCatch(sendWithConcurrencyLimit(subscriptions, payload));
    if (sendError) return { error: sendError.message };
    return result;
}
