import { useState, useEffect, useRef, useCallback } from 'react';

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const TICK_MS = 50;

function randomChar() {
    return CHARSET[Math.floor(Math.random() * CHARSET.length)];
}

/**
 * Get word boundaries: [{ start, end }, ...] for each word in text.
 */
function getWordBounds(text) {
    const words = [];
    let i = 0;
    while (i < text.length) {
        if (text[i] === ' ') { i++; continue; }
        const start = i;
        while (i < text.length && text[i] !== ' ') i++;
        words.push({ start, end: i });
    }
    return words;
}

/**
 * Group words into batches of 1-3 for settling.
 */
function batchWords(words) {
    const batches = [];
    let i = 0;
    while (i < words.length) {
        const size = Math.min(1 + Math.floor(Math.random() * 3), words.length - i);
        batches.push(words.slice(i, i + size));
        i += size;
    }
    return batches;
}

function settled(text, maxLen) {
    const len = maxLen ?? text.length;
    return Array.from({ length: len }, (_, i) => ({
        display: i < text.length ? text[i] : '',
        style: 'normal',
    }));
}

function settledAlt(text, altText, maxLen) {
    const alt = altText || text;
    const len = maxLen ?? Math.max(text.length, alt.length);
    return Array.from({ length: len }, (_, i) => ({
        display: i < alt.length ? alt[i] : '',
        style: 'alt',
    }));
}

/**
 * GlitchText — renders text with synchronized glitch effects.
 *
 * Phase is controlled externally by useGlitchCycle hook (shared clock).
 * This component only handles per-character rendering and word-by-word settling.
 *
 * Props:
 *   text         — base text (the "truth")
 *   altText      — alternate text (propaganda) — optional
 *   className    — base color/styling
 *   altClassName — color for altText chars (defaults to className)
 *   phase        — current cycle phase from useGlitchCycle
 *   takeoverMs   — duration of takeover phase (for word settle timing)
 *   restoreMs    — duration of restore phase (for word settle timing)
 */
export default function GlitchText({
    text,
    altText,
    className,
    altClassName,
    phase = 'idle',
    takeoverMs = 800,
    restoreMs = 800,
}) {
    const [chars, setChars] = useState(() => settled(text));
    const intervalRef = useRef(null);
    const timersRef = useRef([]);

    const clearTimers = useCallback(() => {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];
    }, []);

    const addTimeout = useCallback((fn, ms) => {
        const id = setTimeout(fn, ms);
        timersRef.current.push(id);
        return id;
    }, []);

    useEffect(() => {
        clearTimers();

        const alt = altText || text;
        const words = getWordBounds(text);
        const batches = batchWords(words);

        switch (phase) {
            case 'idle':
                setChars(settled(text));
                break;

            case 'takeover': {
                // Scramble unsettled chars
                intervalRef.current = setInterval(() => {
                    setChars((prev) =>
                        prev.map((c) =>
                            c.style === 'normal' && c.display !== ' '
                                ? { display: randomChar(), style: 'cyberstan' }
                                : c,
                        ),
                    );
                }, TICK_MS);

                // Settle word batches (1-3 words) left to right onto altText
                const perBatch = batches.length > 0 ? takeoverMs / batches.length : takeoverMs;
                batches.forEach((batch, bi) => {
                    addTimeout(() => {
                        setChars((prev) =>
                            prev.map((c, idx) => {
                                for (const w of batch) {
                                    if (idx >= w.start && idx < w.end) {
                                        return { display: idx < alt.length ? alt[idx] : ' ', style: 'alt' };
                                    }
                                }
                                return c;
                            }),
                        );
                    }, bi * perBatch);
                });
                break;
            }

            case 'hold':
                setChars(settledAlt(text, altText));
                break;

            case 'fight':
                // Chaotic ticker — every char randomly picks a state
                intervalRef.current = setInterval(() => {
                    setChars((prev) =>
                        prev.map((_, i) => {
                            if (text[i] === ' ') return { display: ' ', style: 'normal' };
                            const roll = Math.random();
                            if (roll < 0.25) return { display: text[i], style: 'normal' };
                            if (roll < 0.50) return { display: i < alt.length ? alt[i] : text[i], style: 'alt' };
                            if (roll < 0.80) return { display: randomChar(), style: 'cyberstan' };
                            return { display: randomChar(), style: 'normal' };
                        }),
                    );
                }, TICK_MS);
                break;

            case 'restore': {
                // Scramble unsettled chars
                intervalRef.current = setInterval(() => {
                    setChars((prev) =>
                        prev.map((c) =>
                            c.style !== 'normal'
                                ? { display: randomChar(), style: 'cyberstan' }
                                : c,
                        ),
                    );
                }, TICK_MS);

                // Settle word batches back to base text
                const perBatchR = batches.length > 0 ? restoreMs / batches.length : restoreMs;
                batches.forEach((batch, bi) => {
                    addTimeout(() => {
                        setChars((prev) =>
                            prev.map((c, idx) => {
                                for (const w of batch) {
                                    if (idx >= w.start && idx < w.end) {
                                        return { display: text[idx], style: 'normal' };
                                    }
                                }
                                return c;
                            }),
                        );
                    }, bi * perBatchR);
                });
                break;
            }
        }

        return clearTimers;
    }, [phase, text, altText, takeoverMs, restoreMs, clearTimers, addTimeout]);

    // Fast path: all normal — single text node
    const allNormal = chars.every((c) => c.style === 'normal');
    if (allNormal) {
        return <span className={className}>{chars.map((c) => c.display).join('')}</span>;
    }

    return (
        <span className={className}>
            {chars.map((c, i) => {
                if (c.style === 'cyberstan')
                    return (
                        <span key={i} className="glitch-char">
                            {c.display}
                        </span>
                    );
                if (c.style === 'alt' && altClassName && altClassName !== className)
                    return (
                        <span key={i} className={altClassName}>
                            {c.display}
                        </span>
                    );
                return c.display;
            })}
        </span>
    );
}
