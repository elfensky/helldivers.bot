'use client';
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { sendTestNotification } from '@/features/admin/actions';

export default function DebugTools() {
    const [status, setStatus] = useState('idle');
    const [message, setMessage] = useState(null);

    const handleTestPush = useCallback(async () => {
        setStatus('sending');
        setMessage(null);

        const result = await sendTestNotification();

        if (result.error) {
            setMessage({ text: result.error, isError: true });
            setStatus('idle');
        } else {
            const parts = [`Sent to ${result.sent} subscribers`];
            if (result.stale > 0) parts.push(`${result.stale} stale cleaned`);
            setMessage({ text: parts.join(', '), isError: false });
            setStatus('cooldown');
            setTimeout(() => setStatus('idle'), 10_000);
        }
    }, []);

    // Test toast using new JSX format with faction icon and region name.
    function handleTestToast() {
        toast(
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img src="/icons/faction0.webp" alt="" width={24} height={24} />
                <div>
                    <div style={{ fontWeight: 600 }}>Wise Region under attack</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        Defend event started
                    </div>
                </div>
            </div>,
            {
                duration: 8000,
                style: {
                    borderRight: '4px solid var(--color-faction-bugs)',
                    animation: 'action-flash var(--duration-pulse-fast) ease-in-out infinite',
                },
            },
        );
    }

    const pushDisabled = status !== 'idle';
    const btnClass =
        'cursor-pointer border border-ghost px-2 py-0.5 text-small text-text-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-50';

    return (
        <section>
            <h3 className="mb-2 font-mono text-small text-text-muted uppercase">Debug</h3>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={handleTestPush}
                    disabled={pushDisabled}
                    className={btnClass}
                >
                    {status === 'sending' ? 'Sending...' :
                     status === 'cooldown' ? 'Sent' :
                     'Test Push'}
                </button>
                <button type="button" onClick={handleTestToast} className={btnClass}>
                    Test Toast
                </button>
                {message && (
                    <span className={`text-small ${message.isError ? 'text-danger' : 'text-text-muted'}`}>
                        {message.text}
                    </span>
                )}
            </div>
        </section>
    );
}
