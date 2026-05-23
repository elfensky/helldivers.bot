'use server';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/shared/utils/time.mjs';
import {
    ensureVapid,
    sendWithConcurrencyLimit,
    buildPayload,
} from '@/update/pushNotifier.mjs';
import db from '@/db/db';
import { requireAdmin } from '@/db/queries/_authGuards.mjs';

/**
 * Send a test push notification using the same payload format as real events.
 *
 * `event_id` is optional — if provided, the notification will share a tag
 * with any prior test push using the same id, so the browser replaces the
 * existing notification in place (matching how real event transitions
 * update notifications via tag + renotify).
 *
 * @param {{ enemy: number, region: number, type: string, kind: string, event_id?: number }} opts - Test notification parameters
 */
export async function sendTestNotification({
    enemy = 0,
    region = 3,
    type = 'defend',
    kind = 'event_started',
    event_id,
} = {}) {
    const start = performance.now();
    const { error: authError } = await requireAdmin();
    if (authError) return { errors: { auth: authError }, time: performanceTime(start) };

    if (!ensureVapid()) {
        return {
            errors: { vapid: 'VAPID keys not configured' },
            time: performanceTime(start),
        };
    }

    const timestamp = new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
    // Fallback to a fresh high-range random id (900M+) when the caller
    // omits event_id, so admin-fabricated events still avoid colliding with
    // real game ids.
    const id = event_id ?? 900_000_000 + Math.floor(Math.random() * 100_000_000);
    const change = {
        kind,
        event: { enemy, region, type, event_id: id, season: 0 },
    };
    const base = JSON.parse(buildPayload(change));
    base.body = `${base.body} — ${timestamp}`;
    const payload = JSON.stringify(base);

    const { data: subscriptions, error: fetchError } = await tryCatch(
        db.push_subscription.findMany(),
    );
    if (fetchError)
        return { errors: { db: fetchError.message }, time: performanceTime(start) };
    if (!subscriptions || subscriptions.length === 0)
        return {
            errors: { subscribers: 'No push subscribers' },
            time: performanceTime(start),
        };

    const { data: result, error: sendError } = await tryCatch(
        sendWithConcurrencyLimit(subscriptions, payload),
    );
    if (sendError)
        return { errors: { send: sendError.message }, time: performanceTime(start) };
    return { data: result, time: performanceTime(start) };
}
