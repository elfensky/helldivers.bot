import { useState, useEffect } from 'react';

const NO_EFFECTS = {
    headerScramble: false,
    watermark: false,
};

const STORAGE_KEY = 'cyberstan-effects-disabled';

/**
 * Cyberstan interference effects for defeat seasons.
 *
 * Disabled by: localStorage toggle or prefers-reduced-motion.
 * Dice rolled in useEffect (client-only) to avoid SSR hydration mismatch.
 */
export function useCyberstanEffects(isDefeat) {
    const [effects, setEffects] = useState(NO_EFFECTS);

    useEffect(() => {
        if (!isDefeat) {
            setEffects(NO_EFFECTS);
            return;
        }

        const reducedMotion =
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const userDisabled =
            typeof localStorage !== 'undefined' &&
            localStorage.getItem(STORAGE_KEY) === 'true';

        if (reducedMotion || userDisabled) {
            setEffects({ headerScramble: false, watermark: false });
            return;
        }

        setEffects({
            headerScramble: true,
            watermark: Math.random() < 0.5,
        });
    }, [isDefeat]);

    return effects;
}

/**
 * Toggle the effects-disabled preference in localStorage.
 * Returns the new disabled state.
 */
export function toggleCyberstanEffects() {
    const current = localStorage.getItem(STORAGE_KEY) === 'true';
    localStorage.setItem(STORAGE_KEY, String(!current));
    return !current;
}
