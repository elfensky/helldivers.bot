'use server';
import { z } from 'zod';
import db from '@/db/db';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/shared/utils/time.mjs';
import { revalidatePath } from 'next/cache';
import {
    ensureVapid,
    sendWithConcurrencyLimit,
    buildPayload,
} from '@/update/pushNotifier.mjs';
import { computeWorkerHealth } from '@/shared/utils/admin/computeWorkerHealth.mjs';
import { ROLE } from '@/shared/enums/roles.mjs';
import { requireAdmin } from '@/shared/utils/api/authGuards.mjs';

// ─── User management ────────────────────────────────────────────────

export async function getAllUsers() {
    const start = performance.now();
    const { error: authError } = await requireAdmin();
    if (authError) return { errors: { auth: authError }, time: performanceTime(start) };

    const { data: users, error } = await tryCatch(
        db.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                role: true,
                banned: true,
                createdAt: true,
                _count: { select: { apiKeys: true } },
                accounts: { select: { providerId: true } },
            },
        }),
    );
    if (error) throw error;

    return { data: users, time: performanceTime(start) };
}

export async function updateUserRole(_, formData) {
    const start = performance.now();
    const { user, error: authError } = await requireAdmin();
    if (authError) return { errors: { auth: authError }, time: performanceTime(start) };

    const formValues = {
        userId: formData.get('userId'),
        newRole: formData.get('newRole'),
    };

    const schema = z.object({
        userId: z.string().min(1),
        newRole: z.enum(Object.values(ROLE)),
    });
    const check = schema.safeParse(formValues);
    if (!check.success) {
        return {
            errors: check.error.flatten().fieldErrors,
            time: performanceTime(start),
        };
    }

    if (user.id === check.data.userId) {
        return {
            errors: { auth: 'Cannot change your own role' },
            time: performanceTime(start),
        };
    }

    const isDemotion = check.data.newRole === ROLE.USER;

    const { data: updated, error } = await tryCatch(
        db.$transaction(
            async (tx) => {
                if (isDemotion) {
                    const adminCount = await tx.user.count({
                        where: { role: ROLE.ADMIN },
                    });
                    if (adminCount === 1) {
                        throw new Error('LAST_ADMIN');
                    }
                }
                return tx.user.update({
                    where: { id: check.data.userId },
                    data: { role: check.data.newRole },
                });
            },
            { isolationLevel: 'Serializable' },
        ),
    );
    if (error) {
        if (error.message === 'LAST_ADMIN') {
            return {
                errors: { auth: 'Cannot demote the last admin' },
                time: performanceTime(start),
            };
        }
        throw error;
    }

    revalidatePath('/profile', 'layout');
    return { data: updated, time: performanceTime(start) };
}

export async function toggleUserBan(_, formData) {
    const start = performance.now();
    const { user, error: authError } = await requireAdmin();
    if (authError) return { errors: { auth: authError }, time: performanceTime(start) };

    const formValues = {
        userId: formData.get('userId'),
        banned: formData.get('banned'),
    };

    const schema = z.object({
        userId: z.string().min(1),
        banned: z.enum(['true', 'false']).transform((v) => v === 'true'),
    });
    const check = schema.safeParse(formValues);
    if (!check.success) {
        return {
            errors: check.error.flatten().fieldErrors,
            time: performanceTime(start),
        };
    }

    if (user.id === check.data.userId) {
        return {
            errors: { auth: 'Cannot ban your own account' },
            time: performanceTime(start),
        };
    }

    const { data: updated, error } = await tryCatch(
        db.$transaction(
            async (tx) => {
                if (check.data.banned === true) {
                    const target = await tx.user.findUnique({
                        where: { id: check.data.userId },
                        select: { role: true },
                    });
                    if (target?.role === ROLE.ADMIN) {
                        const adminCount = await tx.user.count({
                            where: { role: ROLE.ADMIN },
                        });
                        if (adminCount === 1) {
                            throw new Error('LAST_ADMIN');
                        }
                    }
                }
                return tx.user.update({
                    where: { id: check.data.userId },
                    data: { banned: check.data.banned },
                });
            },
            { isolationLevel: 'Serializable' },
        ),
    );
    if (error) {
        if (error.message === 'LAST_ADMIN') {
            return {
                errors: { auth: 'Cannot ban the last admin' },
                time: performanceTime(start),
            };
        }
        throw error;
    }

    revalidatePath('/profile', 'layout');
    return { data: updated, time: performanceTime(start) };
}

// ─── Admin-only API key management ──────────────────────────────────

export async function adminRevokeApiKey(formData) {
    const start = performance.now();
    const { error: authError } = await requireAdmin();
    if (authError) return { errors: { auth: authError }, time: performanceTime(start) };

    const apikeyId = formData.get('apikeyId');
    const schema = z.string().min(1);
    const check = schema.safeParse(apikeyId);
    if (!check.success) {
        return {
            errors: { apikeyId: 'Invalid API key ID' },
            time: performanceTime(start),
        };
    }

    const { data: deleted, error } = await tryCatch(
        db.ApiKey.delete({ where: { id: apikeyId } }),
    );
    if (error) throw error;

    revalidatePath('/profile', 'layout');
    return { data: deleted, time: performanceTime(start) };
}

export async function getAllApiKeys() {
    const start = performance.now();
    const { error: authError } = await requireAdmin();
    if (authError) return { errors: { auth: authError }, time: performanceTime(start) };

    const { data: keys, error } = await tryCatch(
        db.ApiKey.findMany({
            select: {
                id: true,
                description: true,
                visible: true,
                enabled: true,
                createdAt: true,
                user: { select: { email: true } },
            },
            orderBy: { createdAt: 'desc' },
        }),
    );
    if (error) throw error;

    return { data: keys, time: performanceTime(start) };
}

// ─── System overview ────────────────────────────────────────────────

export async function getSystemStats() {
    const start = performance.now();
    const { error: authError } = await requireAdmin();
    if (authError) return { errors: { auth: authError }, time: performanceTime(start) };

    // Step 1: Get current season (needed for active factions query)
    const { data: latestSeason, error: seasonError } = await tryCatch(
        db.h1_season.findFirst({ orderBy: { season: 'desc' }, select: { season: true } }),
    );
    if (seasonError) throw seasonError;

    const currentSeason = latestSeason?.season ?? null;

    // Step 2: All remaining queries in parallel
    const { data: results, error } = await tryCatch(
        Promise.all([
            db.worker_heartbeat.findUnique({ where: { worker_type: 'cron_api_poller' } }),
            currentSeason !== null ?
                // Count factions currently active in the current season.
                // Reads latest h1_status row per enemy via $queryRaw DISTINCT ON,
                // filters by status='active' in SQL.
                db.$queryRaw`
                    SELECT COUNT(*)::int AS count FROM (
                        SELECT DISTINCT ON (enemy) status
                        FROM h1_status
                        WHERE season = ${currentSeason}
                        ORDER BY enemy ASC, bucket DESC
                    ) latest
                    WHERE latest.status = 'active'
                `.then((rows) => rows[0]?.count ?? 0)
            :   Promise.resolve(0),
            db.h1_event.count(),
            db.h1_season.count(),
            db.user.count(),
            db.ApiKey.count(),
            db.push_subscription.count(),
        ]),
    );
    if (error) throw error;

    const [
        heartbeat,
        activeFactions,
        totalEvents,
        seasonsStored,
        totalUsers,
        totalApiKeys,
        pushSubscribers,
    ] = results;

    return {
        data: {
            heartbeat,
            workerHealth: computeWorkerHealth(heartbeat),
            currentSeason,
            activeFactions,
            totalEvents,
            seasonsStored,
            totalUsers,
            totalApiKeys,
            pushSubscribers,
        },
        time: performanceTime(start),
    };
}

// ─── Push notifications (admin testing) ─────────────────────────────

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
