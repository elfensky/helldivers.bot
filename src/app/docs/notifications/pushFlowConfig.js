import { createFlowConfig } from './createFlowConfig';

export const pushFlowConfig = createFlowConfig({
    views: [{ key: 'all', label: 'All' }],

    legend: [
        { color: '#a855f7', label: 'Server' },
        { color: '#22c55e', label: 'Database' },
        { color: '#3b82f6', label: 'Transport' },
        { color: '#f59e0b', label: 'Notification' },
    ],

    title: 'Push Notification Flow',
    description:
        "How push notifications are sent from the update route to the user's device via web-push and the service worker",

    details: {
        post_update: {
            title: 'Update Route',
            subtitle: 'src/app/api/h1/update/route.js',
            sections: [
                {
                    type: 'text',
                    content:
                        'After DB writes, calls checkAndNotify() as a fire-and-forget async call. The update route does not wait for push delivery to complete.',
                },
            ],
        },
        check_notify: {
            title: 'checkAndNotify()',
            subtitle: 'src/update/pushNotifier.mjs',
            sections: [
                {
                    type: 'text',
                    content:
                        'Non-blocking function that keeps previous events in memory. Resets on server restart (acceptable \u2014 misses one transition at most).',
                },
            ],
        },
        detect_changes: {
            title: 'detectChanges()',
            subtitle: 'src/shared/utils/game/detectChanges.mjs',
            sections: [
                {
                    type: 'text',
                    content:
                        'Same pure function used client-side. Compares previous and current event arrays to find started/won/lost transitions.',
                },
            ],
        },
        query_subs: {
            title: 'Subscription Query',
            subtitle: 'push_subscription table',
            sections: [
                {
                    type: 'text',
                    content:
                        'Reads all push_subscription rows. Each row has an endpoint URL and encryption keys (p256dh + auth).',
                },
            ],
        },
        web_push: {
            title: 'web-push Fan-out',
            subtitle: 'web-push npm library',
            sections: [
                {
                    type: 'text',
                    content:
                        'Fans out notifications with a concurrency limit of 50. Automatically deletes stale subscriptions (410/404 responses).',
                },
            ],
        },
        sw_push: {
            title: 'Service Worker',
            subtitle: 'src/sw.js (push handler)',
            sections: [
                {
                    type: 'text',
                    content:
                        'Handles the push event. Parses the notification payload and validates icon/badge same-origin before passing to showNotification().',
                },
            ],
        },
        show_noti: {
            title: 'showNotification()',
            subtitle: 'ServiceWorkerRegistration API',
            sections: [
                {
                    type: 'text',
                    content:
                        'Displays the OS notification with faction icon, badge, per-event tag, and renotify: true so updated events replace previous notifications.',
                },
            ],
        },
    },
});
