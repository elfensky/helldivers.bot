'use client';
import { useState, useCallback } from 'react';
import * as Sentry from '@sentry/nextjs';
import { toast } from 'sonner';
import { sendTestNotification } from '@/features/admin/actions';
import { showEventToast } from '@/features/notifications/eventToast';

const PUSH_KINDS = ['event_started', 'event_won', 'event_lost'];
const TOAST_KINDS = ['event_started', 'event_won', 'event_lost', 'catch_up'];
const KIND_LABELS = {
    event_started: 'Started',
    event_won: 'Won',
    event_lost: 'Lost',
    catch_up: 'Active',
};

/** Build a fake event with random faction and region. */
function randomEvent(type) {
    const enemy = Math.floor(Math.random() * 3);
    const region = type === 'attack' ? 11 : Math.floor(Math.random() * 10) + 1;
    return { id: `test-${Date.now()}`, enemy, region, type };
}

/** Pick a random event type, biased by kind. */
function randomType(kind) {
    if (kind === 'event_started' || kind === 'catch_up') return 'defend';
    return Math.random() > 0.5 ? 'defend' : 'attack';
}

const BTN =
    'cursor-pointer border border-ghost px-2 py-0.5 text-small text-text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-50';
const LABEL = 'font-mono text-small text-text-muted uppercase';

export default function DebugTools() {
    const [pushStatus, setPushStatus] = useState({});
    const [pushMessage, setPushMessage] = useState(null);

    const handleTestPush = useCallback(async (kind) => {
        setPushStatus((prev) => ({ ...prev, [kind]: 'sending' }));
        setPushMessage(null);

        const type = randomType(kind);
        const event = randomEvent(type);
        const result = await sendTestNotification({ enemy: event.enemy, region: event.region, type, kind });

        if (result.error) {
            setPushMessage({ text: result.error, isError: true });
            setPushStatus((prev) => ({ ...prev, [kind]: 'idle' }));
        } else {
            const parts = [`Sent to ${result.sent}`];
            if (result.stale > 0) parts.push(`${result.stale} stale`);
            setPushMessage({ text: parts.join(', '), isError: false });
            setPushStatus((prev) => ({ ...prev, [kind]: 'cooldown' }));
            setTimeout(() => setPushStatus((prev) => ({ ...prev, [kind]: 'idle' })), 5_000);
        }
    }, []);

    return (
        <section>
            <h3 className="mb-2 font-mono text-small text-text-muted uppercase">Debug</h3>
            <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    <span className={LABEL}>Toasts</span>
                    {TOAST_KINDS.map((kind) => (
                        <button
                            key={kind}
                            type="button"
                            onClick={() => {
                                const type = randomType(kind);
                                const alertColor = kind === 'event_won' ? 'var(--color-success)' : 'var(--color-danger)';
                                showEventToast(randomEvent(type), kind, { duration: 8000, alertColor });
                            }}
                            className={BTN}
                        >
                            {KIND_LABELS[kind]}
                        </button>
                    ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className={LABEL}>Push</span>
                    {PUSH_KINDS.map((kind) => {
                        const s = pushStatus[kind] || 'idle';
                        return (
                            <button
                                key={kind}
                                type="button"
                                onClick={() => handleTestPush(kind)}
                                disabled={s !== 'idle'}
                                className={BTN}
                            >
                                {s === 'sending' ? '...' : s === 'cooldown' ? 'Sent' : KIND_LABELS[kind]}
                            </button>
                        );
                    })}
                    {pushMessage && (
                        <span className={`text-small ${pushMessage.isError ? 'text-danger' : 'text-text-muted'}`}>
                            {pushMessage.text}
                        </span>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className={LABEL}>Error</span>
                    <button
                        type="button"
                        onClick={() => {
                            const err = new Error('Admin test error — verifying GlitchTip integration');
                            Sentry.captureException(err);
                            toast.success('Error sent to GlitchTip');
                        }}
                        className={BTN}
                        data-umami-event="debug-trigger-error"
                    >
                        Trigger
                    </button>
                </div>
            </div>
        </section>
    );
}
