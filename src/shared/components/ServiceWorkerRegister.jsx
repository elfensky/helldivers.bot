'use client';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

const AUTO_RELOAD_MS = 5 * 60 * 1000; // 5 minutes
const TOAST_RESHOW_MS = 15 * 1000; // 15 seconds

export default function ServiceWorkerRegister() {
    const registrationRef = useRef(null);
    const updateTriggeredRef = useRef(false);
    const deadlineRef = useRef(null);
    const toastIntervalRef = useRef(null);
    const autoReloadTimerRef = useRef(null);

    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        function triggerUpdate() {
            const waiting = registrationRef.current?.waiting;
            if (!waiting || updateTriggeredRef.current) return;
            updateTriggeredRef.current = true;
            waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        function showUpdateToast() {
            toast('App update available', {
                id: 'sw-update',
                duration: Infinity,
                action: {
                    label: 'Reload',
                    onClick: triggerUpdate,
                },
            });
        }

        function onUpdateAvailable() {
            deadlineRef.current = Date.now() + AUTO_RELOAD_MS;

            showUpdateToast();
            toastIntervalRef.current = setInterval(showUpdateToast, TOAST_RESHOW_MS);

            autoReloadTimerRef.current = setTimeout(() => {
                triggerUpdate();
            }, AUTO_RELOAD_MS);
        }

        // Reload when the new SW takes over (only if we triggered the update)
        function onControllerChange() {
            if (updateTriggeredRef.current) {
                window.location.reload();
            }
        }

        // Check deadline on visibility change (handles iOS timer suspension)
        function onVisibilityChange() {
            if (
                deadlineRef.current &&
                Date.now() >= deadlineRef.current &&
                !updateTriggeredRef.current
            ) {
                triggerUpdate();
            }
        }

        navigator.serviceWorker
            .register('/sw.js')
            .then((registration) => {
                registrationRef.current = registration;

                // Case 1: SW already waiting from a prior visit
                if (registration.waiting) {
                    navigator.serviceWorker.addEventListener(
                        'controllerchange',
                        onControllerChange,
                    );
                    onUpdateAvailable();
                    return;
                }

                // Case 2: New SW found during this visit
                registration.addEventListener('updatefound', () => {
                    const installing = registration.installing;
                    if (!installing) return;

                    installing.addEventListener('statechange', () => {
                        if (
                            installing.state === 'installed' &&
                            navigator.serviceWorker.controller
                        ) {
                            // New SW installed while an existing one controls the page
                            navigator.serviceWorker.addEventListener(
                                'controllerchange',
                                onControllerChange,
                            );
                            onUpdateAvailable();
                        }
                    });
                });
            })
            .catch((err) => {
                console.error('SW registration failed:', err.message);
            });

        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', onVisibilityChange);
            navigator.serviceWorker.removeEventListener(
                'controllerchange',
                onControllerChange,
            );
            if (toastIntervalRef.current) clearInterval(toastIntervalRef.current);
            if (autoReloadTimerRef.current) clearTimeout(autoReloadTimerRef.current);
            toast.dismiss('sw-update');
        };
    }, []);

    return null;
}
