import { useState, useEffect, useRef, useCallback } from 'react';

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const TICK_MS = 50;

// Phase durations
const IDLE_MIN_MS = 6000;
const IDLE_MAX_MS = 12000;
const TAKEOVER_MS = 300;
const HOLD_MS = 1000;
const FIGHT_MIN_MS = 1000;
const FIGHT_MAX_MS = 2000;
const RESTORE_MS = 500;

function randomChar() {
    return CHARSET[Math.floor(Math.random() * CHARSET.length)];
}

function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}

/**
 * Get word boundaries: [{ start, end }, ...] for each word in text.
 * Spaces between words are not included in any word span.
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
 * Build a chars array where every position shows the target text in normal style.
 */
function settled(text) {
    return text.split('').map((ch) => ({ display: ch, style: 'normal' }));
}

/**
 * Build a chars array showing altText in alt style.
 */
function settledAlt(text, altText) {
    const alt = altText || text;
    return text.split('').map((_, i) => ({
        display: i < alt.length ? alt[i] : ' ',
        style: 'alt',
    }));
}

/**
 * GlitchText — 5-phase persistent glitch cycle.
 *
 * Phases: IDLE → TAKEOVER → HOLD → FIGHT → RESTORE → IDLE
 *
 * Props:
 *   text         — base text (the "truth")
 *   altText      — alternate text (propaganda) — optional
 *   className    — base color/styling
 *   altClassName — color for altText chars (defaults to className)
 *   active       — enables animation (false = static base text)
 */
export default function GlitchText({
    text,
    altText,
    className,
    altClassName,
    active = true,
}) {
    const [chars, setChars] = useState(() => settled(text));
    const timersRef = useRef([]);
    const intervalRef = useRef(null);
    const phaseRef = useRef('idle');

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
        if (!active) {
            setChars(settled(text));
            return;
        }

        const reducedMotion =
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (reducedMotion) {
            setChars(settled(text));
            return;
        }

        const alt = altText || text;
        const len = text.length;
        const words = getWordBounds(text);

        // --- Phase transitions ---

        function startIdle() {
            phaseRef.current = 'idle';
            clearTimers();
            setChars(settled(text));
            addTimeout(startTakeover, randomBetween(IDLE_MIN_MS, IDLE_MAX_MS));
        }

        function startTakeover() {
            phaseRef.current = 'takeover';
            clearTimers();

            // Start scramble ticker for unsettled chars
            intervalRef.current = setInterval(() => {
                setChars((prev) =>
                    prev.map((c) =>
                        c.style === 'normal' && c.display !== ' '
                            ? { display: randomChar(), style: 'cyberstan' }
                            : c,
                    ),
                );
            }, TICK_MS);

            // Settle word by word onto altText
            const perWord = words.length > 0 ? TAKEOVER_MS / words.length : TAKEOVER_MS;
            words.forEach((w, wi) => {
                addTimeout(() => {
                    setChars((prev) =>
                        prev.map((c, idx) =>
                            idx >= w.start && idx < w.end
                                ? { display: idx < alt.length ? alt[idx] : ' ', style: 'alt' }
                                : c,
                        ),
                    );
                }, wi * perWord);
            });

            // When done → HOLD
            addTimeout(() => {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
                setChars(settledAlt(text, altText));
                startHold();
            }, TAKEOVER_MS + 50);
        }

        function startHold() {
            phaseRef.current = 'hold';
            addTimeout(startFight, HOLD_MS);
        }

        function startFight() {
            phaseRef.current = 'fight';
            clearTimers();

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

            // After random fight duration → RESTORE
            addTimeout(startRestore, randomBetween(FIGHT_MIN_MS, FIGHT_MAX_MS));
        }

        function startRestore() {
            phaseRef.current = 'restore';
            clearTimers();

            // Start scramble ticker for unsettled chars
            intervalRef.current = setInterval(() => {
                setChars((prev) =>
                    prev.map((c) =>
                        c.style !== 'normal'
                            ? { display: randomChar(), style: 'cyberstan' }
                            : c,
                    ),
                );
            }, TICK_MS);

            // Settle word by word back to base text
            const perWord = words.length > 0 ? RESTORE_MS / words.length : RESTORE_MS;
            words.forEach((w, wi) => {
                addTimeout(() => {
                    setChars((prev) =>
                        prev.map((c, idx) =>
                            idx >= w.start && idx < w.end
                                ? { display: text[idx], style: 'normal' }
                                : c,
                        ),
                    );
                }, wi * perWord);
            });

            // When done → back to IDLE
            addTimeout(() => {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
                startIdle();
            }, RESTORE_MS + 50);
        }

        // Kick off the cycle
        startIdle();

        return clearTimers;
    }, [text, altText, active, clearTimers, addTimeout]);

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
