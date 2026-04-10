import { useState } from 'react';

const NO_EFFECTS = {
    outcomeReveal: null,
    headerScramble: false,
    watermark: false,
    statFlickers: false,
};

/**
 * Roll dice for Cyberstan interference effects on defeat seasons.
 * Each slot has ~50% independent chance of firing.
 * Returns a stable object (lazy useState — no re-rolls on re-render).
 */
export function useCyberstanEffects(isDefeat) {
    return useState(() => {
        if (!isDefeat) return NO_EFFECTS;
        return {
            outcomeReveal:
                Math.random() < 0.5 ? Math.floor(Math.random() * 3) : null,
            headerScramble: Math.random() < 0.5,
            watermark: Math.random() < 0.5,
            statFlickers: Math.random() < 0.5,
        };
    })[0];
}
