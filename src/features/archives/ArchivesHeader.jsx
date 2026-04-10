'use client';

import './CyberstanInterference.css';
import GlitchText from '@/features/archives/GlitchText';

function PlainText() {
    return (
        <p className="mt-1 text-small text-text-muted">
            Records verified by the Bureau of War Information. All outcomes
            reflect the supreme tactical genius of High Command. Unauthorized
            interpretation of campaign data is a Class-3 offense.
        </p>
    );
}

function ScrambledText() {
    return (
        <p className="mt-1 text-small text-text-muted">
            Records{' '}
            <GlitchText text="verified" delay={500} duration={800} />
            {' '}by the Bureau of War Information. All outcomes reflect the{' '}
            <GlitchText text="supreme tactical genius" delay={1300} duration={1000} />
            {' '}of High Command. Unauthorized interpretation of campaign
            data is a{' '}
            <GlitchText text="Class-3 offense" delay={2500} duration={800} />
            .
        </p>
    );
}

export default function ArchivesHeader({ effects }) {
    return (
        <div className="pb-2">
            <h1 className="font-display text-body text-primary">
                Declassified Campaign Archives
            </h1>
            {effects.headerScramble ? <ScrambledText /> : <PlainText />}
        </div>
    );
}
