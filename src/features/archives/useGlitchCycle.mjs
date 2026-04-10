import { useState, useEffect, useRef, useCallback } from 'react';

const IDLE_MIN_MS = 6000;
const IDLE_MAX_MS = 12000;
const TAKEOVER_MS = 800;
const HOLD_MS = 1000;
const FIGHT_MIN_MS = 1000;
const FIGHT_MAX_MS = 2000;
const RESTORE_MS = 800;

function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}

/**
 * Shared glitch cycle clock. All GlitchText instances on the page
 * receive the same phase, so they animate in sync.
 *
 * Phases: 'idle' → 'takeover' → 'hold' → 'fight' → 'restore' → 'idle'
 *
 * Returns { phase, TAKEOVER_MS, RESTORE_MS } so consumers know the
 * durations for their word-by-word settling.
 */
export function useGlitchCycle(active) {
    const [phase, setPhase] = useState('idle');
    const timerRef = useRef(null);

    const clear = useCallback(() => {
        clearTimeout(timerRef.current);
        timerRef.current = null;
    }, []);

    useEffect(() => {
        if (!active) {
            setPhase('idle');
            return;
        }

        function schedule(nextPhase, delay) {
            timerRef.current = setTimeout(() => setPhase(nextPhase), delay);
        }

        // Each phase transition schedules the next
        switch (phase) {
            case 'idle':
                schedule('takeover', randomBetween(IDLE_MIN_MS, IDLE_MAX_MS));
                break;
            case 'takeover':
                schedule('hold', TAKEOVER_MS);
                break;
            case 'hold':
                schedule('fight', HOLD_MS);
                break;
            case 'fight':
                schedule('restore', randomBetween(FIGHT_MIN_MS, FIGHT_MAX_MS));
                break;
            case 'restore':
                schedule('idle', RESTORE_MS);
                break;
        }

        return clear;
    }, [phase, active, clear]);

    return { phase, TAKEOVER_MS, RESTORE_MS };
}
