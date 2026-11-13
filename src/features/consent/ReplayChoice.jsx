'use client';

import { useEffect, useState } from 'react';

import {
    privacySignal,
    readReplayConsent,
    writeReplayConsent,
} from '@/features/consent/replayConsent.mjs';
import { reloadDocument } from '@/features/consent/reloadDocument.mjs';

/**
 * The recording choice on /privacy (#617, #619): shows the stored answer and one
 * button to change it. Switching recording off ends the document with one full
 * navigation, because a running recorder cannot be stopped (analytics-standard
 * trap 19). It does not go through guardedReload(): that guard can decline, and
 * the recorder would then keep running. Switching it on applies from the next
 * page load.
 *
 * @returns {import('react').ReactElement}
 */
export default function ReplayChoice() {
    const [state, setState] = useState(
        /** @type {'loading' | 'signal' | 'blocked' | 'on' | 'off'} */ ('loading'),
    );

    useEffect(() => {
        const check = async () => {
            if (privacySignal()) return setState('signal');
            const consent = await readReplayConsent();
            setState(
                consent === null ? 'blocked'
                : consent === 'yes' ? 'on'
                : 'off',
            );
        };
        check();
    }, []);

    const toggle = async () => {
        const turnOn = state !== 'on';
        if (!(await writeReplayConsent(turnOn ? 'yes' : 'no'))) {
            setState('blocked');
            return;
        }
        if (!turnOn) {
            reloadDocument();
            return;
        }
        setState('on');
    };

    if (state === 'loading') {
        return <p className="text-small text-text-muted">Checking recording status…</p>;
    }
    if (state === 'signal') {
        return (
            <p className="text-small text-text-muted">
                Recording: off. Your browser sends a privacy signal (GPC or Do Not Track),
                so this site never records it.
            </p>
        );
    }
    if (state === 'blocked') {
        return (
            <p className="text-small text-text-muted">
                Recording: off. This browser blocks local storage, so a yes cannot be
                stored here and recording stays off.
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <p className="text-small text-text" aria-live="polite">
                Recording: {state}.
            </p>
            <button
                type="button"
                onClick={toggle}
                data-umami-event="privacy-replay-toggle"
                className="hover:text-bg w-fit cursor-pointer border border-primary px-4 py-2 font-display text-small text-primary uppercase transition-colors hover:bg-primary"
            >
                {state === 'on' ? 'Stop recording' : 'Allow session recording'}
            </button>
        </div>
    );
}
