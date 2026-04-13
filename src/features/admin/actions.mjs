'use server';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { tryCatch } from '@/shared/utils/tryCatch';
import {
    ensureVapid,
    sendWithConcurrencyLimit,
    buildPayload,
} from '@/update/pushNotifier';
import db from '@/db/db';

/**
 * Send a test push notification using the same payload format as real events.
 *
 * `event_id` is optional — if provided, the notification will share a tag
 * with any prior test push using the same id, so the browser replaces the
 * existing notification in place (matching how real event transitions
 * update notifications via tag + renotify).
 *
 * @param {{ enemy: number, region: number, type: string, kind: string, event_id?: number }} opts
 */
export async function sendTestNotification({
    enemy = 0,
    region = 3,
    type = 'defend',
    kind = 'event_started',
    event_id,
} = {}) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || session.user.role !== 'admin') {
        return { error: 'Unauthorized' };
    }

    if (!ensureVapid()) {
        return { error: 'VAPID keys not configured' };
    }

    const time = new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
    // Fallback to a fresh high-range random id (900M+) so legacy callers
    // without an explicit event_id still avoid collisions with real ids.
    const id = event_id ?? 900_000_000 + Math.floor(Math.random() * 100_000_000);
    const change = {
        kind,
        event: { enemy, region, type, event_id: id, season: 0 },
    };
    const base = JSON.parse(buildPayload(change));
    base.body = `${base.body} — ${time}`;
    const payload = JSON.stringify(base);

    const { data: subscriptions, error: fetchError } = await tryCatch(
        db.push_subscription.findMany(),
    );
    if (fetchError) return { error: fetchError.message };
    if (!subscriptions || subscriptions.length === 0)
        return { error: 'No push subscribers' };

    const { data: result, error: sendError } = await tryCatch(
        sendWithConcurrencyLimit(subscriptions, payload),
    );
    if (sendError) return { error: sendError.message };
    return result;
}
