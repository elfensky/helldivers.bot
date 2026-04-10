'use client';

import './CyberstanInterference.css';
import GlitchText from '@/features/archives/ClientGlitchText';
import { toggleCyberstanEffects } from '@/features/archives/useCyberstanEffects.mjs';
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
            <p className="mt-1 max-w-screen-md text-small text-text-muted">{PROPAGANDA_BODY}</p>
        </>
    );
}

function ResistanceHeader({ animate, message }) {
    return (
        <>
            <h1 className="font-display text-body">
                <GlitchText
                    text={RESISTANCE_TITLE}
                    altText={PROPAGANDA_TITLE}
                    className="text-primary"
                    active={animate}
                />
            </h1>
            <p className="mt-1 max-w-screen-md text-small">
                <GlitchText
                    text={message}
                    altText={PROPAGANDA_BODY}
                    className="text-text-muted"
                    active={animate}
                />
            </p>
        </>
    );
}

function EffectsToggle({ active }) {
    function handleToggle() {
        toggleCyberstanEffects();
        window.location.reload();
    }

    return (
        <button
            onClick={handleToggle}
            className="mt-1 cursor-pointer font-mono text-[10px] text-text-muted opacity-50 hover:opacity-100"
            data-umami-event="archive-effects-toggle"
        >
            [{active ? 'Disable' : 'Enable'} interference]
        </button>
    );
}

export default function ArchivesHeader({ isDefeat, effects, defeatMessageIndex }) {
    if (!isDefeat) {
        return (
            <div className="pb-2">
                <PropagandaHeader />
            </div>
        );
    }

    const message = RESISTANCE_MESSAGES[defeatMessageIndex] ?? RESISTANCE_MESSAGES[0];

    return (
        <div className="pb-2">
            <ResistanceHeader animate={effects.headerScramble} message={message} />
            <EffectsToggle active={effects.headerScramble} />
        </div>
    );
}
