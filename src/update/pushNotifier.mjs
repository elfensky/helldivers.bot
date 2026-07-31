import webpush from 'web-push';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { detectChanges } from '@/shared/utils/game/detectChanges.mjs';
import { getEventRegionLabel } from '@/shared/utils/game/getEventRegionLabel.mjs';
import factions from '@/shared/enums/factions.mjs';
import { EVENT_TYPE } from '@/shared/enums/events.mjs';
import db from '@/db/db';

const MAX_CONCURRENT = 50;
let prevEvents = null;
let configured = false;

export function ensureVapid() {
    if (configured) return true;
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;

    if (!publicKey || !privateKey || !subject) return false;

    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
    return true;
}

export function buildPayload(change) {
    const region = getEventRegionLabel(change.event);
    const isDefend = change.event.type === EVENT_TYPE.DEFEND;

    const titles = {
        event_started: isDefend ? `${region} under attack` : `Capturing ${region}`,
        event_won: isDefend ? `${region} defended` : `${region} captured`,
        event_lost: isDefend ? `${region} lost` : `${region} held`,
    };

    const subtitles = {
        event_started: `${isDefend ? 'Defend' : 'Attack'} event started`,
        event_won: `${isDefend ? 'Defend' : 'Attack'} event won!`,
        event_lost: `${isDefend ? 'Defend' : 'Attack'} event lost`,
    };

    const eventId = change.event.event_id;
    const tag = eventId != null ? `event-${eventId}` : undefined;

    return JSON.stringify({
        title: titles[change.kind] || 'Campaign Update',
        body: subtitles[change.kind] || `Season ${change.event.season || ''}`,
        icon: factions[change.event.enemy]?.icon || '/icons/superearth.webp',
        badge: '/favicons/favicon-96x96.png',
        ...(tag && { tag, renotify: true }),
    });
}

export async function sendWithConcurrencyLimit(subscriptions, payload) {
    const staleEndpoints = [];
    let sentCount = 0;

    for (let i = 0; i < subscriptions.length; i += MAX_CONCURRENT) {
        const batch = subscriptions.slice(i, i + MAX_CONCURRENT);
        const batchResults = await Promise.allSettled(
            batch.map((sub) =>
                webpush.sendNotification(
                    {
                        endpoint: sub.endpoint,
                        keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
                    },
                    payload,
                ),
            ),
        );

        for (let j = 0; j < batchResults.length; j++) {
            const result = batchResults[j];
            if (result.status === 'fulfilled') {
                sentCount++;
            } else {
                // Reject — clean up stale (410 Gone / 404 Not Found); other
                // failures (network, 5xx) are counted as neither sent nor stale.
                const statusCode = result.reason?.statusCode;
                if (statusCode === 410 || statusCode === 404) {
                    staleEndpoints.push(batch[j].endpoint);
                }
            }
        }
    }

    // Delete stale subscriptions
    if (staleEndpoints.length > 0) {
        const { error } = await tryCatch(
            db.push_subscription.deleteMany({
                where: { endpoint: { in: staleEndpoints } },
            }),
        );
        if (error) {
            console.error('Failed to cleanup stale push subscriptions:', error.message);
        } else {
            console.info(`Cleaned up ${staleEndpoints.length} stale push subscriptions`);
        }
    }

    return {
        sent: sentCount,
        stale: staleEndpoints.length,
    };
}

/**
 * Check for event transitions and send push notifications.
 * Called after updateStatus() — async, non-blocking.
 * Fetches current events from DB to avoid coupling with the update pipeline.
 */
export async function checkAndNotify() {
    if (!ensureVapid()) return;

    const { data: season, error: fetchError } = await tryCatch(
        db.h1_season.findFirst({
            where: { last_updated: { not: null } },
            orderBy: { season: 'desc' },
            select: {
                events: {
                    // Ordered so push notifications fan out in a stable, chronological
                    // order rather than whatever the planner returns.
                    orderBy: [{ start_time: 'asc' }, { event_id: 'asc' }],
                    select: {
                        type: true,
                        event_id: true,
                        status: true,
                        enemy: true,
                        region: true,
                        season: true,
                    },
                },
            },
        }),
    );

    if (fetchError || !season) return;
    const currentEvents = season.events;

    if (prevEvents !== null) {
        const changes = detectChanges(prevEvents, currentEvents);

        if (changes.length > 0) {
            const { data: subscriptions, error } = await tryCatch(
                db.push_subscription.findMany(),
            );

            if (error) {
                console.error('Failed to fetch push subscriptions:', error.message);
            } else if (subscriptions.length > 0) {
                for (const change of changes) {
                    const payload = buildPayload(change);
                    await sendWithConcurrencyLimit(subscriptions, payload);
                }
            }
        }
    }

    prevEvents = currentEvents;
}
