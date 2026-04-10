'use client';

import { useEffect } from 'react';
import './CyberstanInterference.css';
import GlitchText from '@/features/archives/ClientGlitchText';
import { toggleCyberstanEffects } from '@/features/archives/useCyberstanEffects.mjs';
import { useGlitchCycle } from '@/features/archives/useGlitchCycle.mjs';
import {
    RESISTANCE_MESSAGES,
    PROPAGANDA_BODY,
} from '@/features/archives/resistanceMessages.mjs';

const PROPAGANDA_TITLE = 'Declassified Campaign Archives';
const RESISTANCE_TITLE = 'Leaked Campaign Records';

function PropagandaHeader() {
    return (
        <>
            <h1 className="font-display text-body text-primary">
                {PROPAGANDA_TITLE}
            </h1>
            <p className="mt-1 max-w-screen-md text-small text-text-muted">
                {PROPAGANDA_BODY}
            </p>
        </>
    );
}

function ResistanceHeader({ message, phase, takeoverMs, restoreMs }) {
    return (
        <>
            <h1 className="font-display text-body">
                <GlitchText
                    text={RESISTANCE_TITLE}
                    altText={PROPAGANDA_TITLE}
                    className="text-primary"
                    phase={phase}
                    takeoverMs={takeoverMs}
                    restoreMs={restoreMs}
                />
            </h1>
            <p className="mt-1 max-w-screen-md text-small">
                <GlitchText
                    text={message}
                    altText={PROPAGANDA_BODY}
                    className="text-text-muted"
                    phase={phase}
                    takeoverMs={takeoverMs}
                    restoreMs={restoreMs}
                />
            </p>
        </>
    );
}

export function EffectsToggle({ active }) {
    function handleToggle() {
        toggleCyberstanEffects();
        window.location.reload();
    }

    return (
        <button
            onClick={handleToggle}
            className={`inline-flex items-center justify-center size-[30px] border border-primary text-primary font-mono cursor-pointer hover:bg-primary hover:text-surface-0${active ? '' : ' opacity-40'}`}
            title={`${active ? 'Disable' : 'Enable'} interference`}
            data-umami-event="archive-effects-toggle"
        >
            ⚡
        </button>
    );
}

export default function ArchivesHeader({
    isDefeat,
    effects,
    defeatMessageIndex,
    onPhaseChange,
}) {
    const { phase, TAKEOVER_MS, RESTORE_MS } = useGlitchCycle(
        isDefeat && effects.headerScramble,
    );

    // Expose phase to parent so ArchiveStats can sync its GlitchText
    useEffect(() => {
        onPhaseChange?.(phase, TAKEOVER_MS, RESTORE_MS);
    }, [phase, TAKEOVER_MS, RESTORE_MS, onPhaseChange]);

    if (!isDefeat) {
        return (
            <div className="pb-2">
                <PropagandaHeader />
            </div>
        );
    }

    const message =
        RESISTANCE_MESSAGES[defeatMessageIndex] ?? RESISTANCE_MESSAGES[0];

    return (
        <div className="pb-2">
            <ResistanceHeader
                message={message}
                phase={phase}
                takeoverMs={TAKEOVER_MS}
                restoreMs={RESTORE_MS}
            />
        </div>
    );
}
