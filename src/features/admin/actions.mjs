'use server';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { tryCatch } from '@/shared/utils/tryCatch';
import { ensureVapid, sendWithConcurrencyLimit } from '@/update/pushNotifier';
import db from '@/db/db';

export async function sendTestNotification() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || session.user.role !== 'admin') {
        return { error: 'Unauthorized' };
    }

    if (!ensureVapid()) {
        return { error: 'VAPID keys not configured' };
    }

    const payload = JSON.stringify({
        title: 'Bugs attack event started',
        body: 'Season 0 — Test notification',
        icon: '/icons/faction0.webp',
        badge: '/favicons/favicon-96x96.png',
        tag: 'test-0',
        renotify: true,
    });

    const { data: subscriptions, error: fetchError } = await tryCatch(db.push_subscription.findMany());
    if (fetchError) return { error: fetchError.message };
    if (!subscriptions || subscriptions.length === 0) return { error: 'No push subscribers' };

    const { data: result, error: sendError } = await tryCatch(sendWithConcurrencyLimit(subscriptions, payload));
    if (sendError) return { error: sendError.message };
    return result;
}
