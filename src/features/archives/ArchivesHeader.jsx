'use client';

import './CyberstanInterference.css';
import GlitchText from '@/features/archives/GlitchText';
import { toggleCyberstanEffects } from '@/features/archives/useCyberstanEffects.mjs';

const PROPAGANDA_TITLE = 'Declassified Campaign Archives';
const RESISTANCE_TITLE = 'Leaked Campaign Records';

const PROPAGANDA_BODY =
    'Records verified by the Bureau of War Information. All outcomes reflect the supreme tactical genius of High Command. Unauthorized interpretation of campaign data is a Class-3 offense.';

const RESISTANCE_BODY =
    'This channel has been intercepted by Cyberstan intelligence. The records below are the real outcomes \u2014 not the sanitized version High Command approved for broadcast. The truth cannot be redacted.';

function PropagandaHeader() {
    return (
        <>
            <h1 className="font-display text-body text-primary">
                {PROPAGANDA_TITLE}
            </h1>
            <p className="mt-1 text-small text-text-muted">{PROPAGANDA_BODY}</p>
        </>
    );
}

function ResistanceHeader({ animate }) {
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
            <p className="mt-1 text-small">
                <GlitchText
                    text={RESISTANCE_BODY}
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

export default function ArchivesHeader({ isDefeat, effects }) {
    return (
        <div className="pb-2">
            {isDefeat ?
                <>
                    <ResistanceHeader animate={effects.headerScramble} />
                    <EffectsToggle active={effects.headerScramble} />
                </>
            :   <PropagandaHeader />}
        </div>
    );
}
