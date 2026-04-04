import webpush from 'web-push';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { detectChanges } from '@/shared/utils/game/detectChanges.mjs';
import factions from '@/shared/enums/factions.mjs';
import db from '@/db/db';

const MAX_CONCURRENT = 50;
let prevEvents = null;
let configured = false;

function ensureVapid() {
    if (configured) return true;
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;

    if (!publicKey || !privateKey || !subject) return false;

    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
    return true;
}

function buildPayload(change) {
    const faction = factions[change.event.enemy]?.name ?? 'Unknown';
    const titles = {
        event_started: `${faction} ${change.event.type} event started`,
        event_won: `${faction} ${change.event.type} event won!`,
        event_lost: `${faction} ${change.event.type} event lost`,
    };

    return JSON.stringify({
        title: titles[change.kind] || 'Campaign Update',
        body: `Season ${change.event.season || ''}`,
        icon: factions[change.event.enemy]?.icon || '/icon.svg',
    });
}

async function sendWithConcurrencyLimit(subscriptions, payload) {
    const results = [];

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

        // Clean up stale subscriptions (410 Gone or 404 Not Found)
        for (let j = 0; j < batchResults.length; j++) {
            const result = batchResults[j];
            if (result.status === 'rejected') {
                const statusCode = result.reason?.statusCode;
                if (statusCode === 410 || statusCode === 404) {
                    results.push(batch[j].endpoint);
                }
            }
        }
    }

    // Delete stale subscriptions
    if (results.length > 0) {
        const { error } = await tryCatch(
            db.push_subscription.deleteMany({
                where: { endpoint: { in: results } },
            }),
        );
        if (error) {
            console.error('Failed to cleanup stale push subscriptions:', error.message);
        } else {
            console.log(`Cleaned up ${results.length} stale push subscriptions`);
        }
    }
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
                    select: {
                        type: true,
                        event_id: true,
                        status: true,
                        enemy: true,
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
