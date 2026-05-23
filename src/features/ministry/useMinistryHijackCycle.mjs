import { useState, useRef, useCallback, useEffect } from 'react';

export const TAKEOVER_MS = 800;
export const HOLD_MS = 1000;
export const RESTORE_MS = 800;
export const CYCLE_MS = TAKEOVER_MS + HOLD_MS + RESTORE_MS; // 2600

/**
 * One-shot hijack state machine. Idle until trigger() fires, then
 * walks takeover → hold → restore → idle in exactly CYCLE_MS.
 *
 * Replaces the deleted useGlitchCycle.mjs. The continuous loop's
 * `fight` phase is intentionally omitted — for a single-shot hijack,
 * a clean takeover→hold→restore arc reads better.
 *
 * @returns {{ phase: 'idle' | 'takeover' | 'hold' | 'restore', trigger: () => void }}
 */
export function useMinistryHijackCycle() {
    const [phase, setPhase] = useState('idle');
    const timersRef = useRef([]);

    const clearTimers = useCallback(() => {
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];
    }, []);

    const trigger = useCallback(() => {
        clearTimers();
        setPhase('takeover');
        timersRef.current.push(
            setTimeout(() => setPhase('hold'), TAKEOVER_MS),
            setTimeout(() => setPhase('restore'), TAKEOVER_MS + HOLD_MS),
            setTimeout(() => setPhase('idle'), CYCLE_MS),
        );
    }, [clearTimers]);

    useEffect(() => clearTimers, [clearTimers]);

    return { phase, trigger };
}
