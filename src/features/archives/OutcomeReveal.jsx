'use client';

/**
 * OutcomeReveal — animated OUTCOME stat card value for defeat seasons.
 *
 * Usage:
 *   <StatCard label="OUTCOME" value={<OutcomeReveal variant={variant} />} />
 *
 * Variants:
 *   0 — shows VICTORY for 2500ms, then scrambles into DEFEAT (one-shot)
 *   1 — shows DEFEAT immediately; random brief VICTORY flashes forever
 *   2 — rapidly alternates VICTORY/DEFEAT with decelerating intervals for
 *       2500ms, then permanently settles on DEFEAT
 */

import { useState, useEffect, useRef } from 'react';

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const VICTORY = 'VICTORY';
const DEFEAT = 'DEFEAT';

function randomChar() {
    return CHARSET[Math.floor(Math.random() * CHARSET.length)];
}

/** Build a chars array where every character is scrambled. */
function scrambledChars(text) {
    return text.split('').map(() => ({ char: randomChar(), scrambled: true }));
}

/** Build a plain chars array (no scrambling). */
function plainChars(text) {
    return text.split('').map((c) => ({ char: c, scrambled: false }));
}

function ScrambledSpan({ chars, colorClass }) {
    return (
        <span className={colorClass}>
            {chars.map((c, i) =>
                c.scrambled ? (
                    <span key={i} className="glitch-char">
                        {c.char}
                    </span>
                ) : (
                    c.char
                ),
            )}
        </span>
    );
}

// ---------------------------------------------------------------------------
// Variant 0: VICTORY → scramble → DEFEAT (one-shot)
// ---------------------------------------------------------------------------
function Variant0() {
    // phase: 'victory' | 'scrambling' | 'defeat'
    const [phase, setPhase] = useState('victory');
    const [chars, setChars] = useState(() => plainChars(VICTORY));
    const timersRef = useRef([]);

    useEffect(() => {
        const add = (fn, ms) => {
            const id = setTimeout(fn, ms);
            timersRef.current.push(id);
            return id;
        };

        // After 2500ms, start 1000ms scramble period with 50ms ticks
        add(() => {
            setPhase('scrambling');
            setChars(scrambledChars(DEFEAT));

            const TICK = 50;
            const SCRAMBLE_DURATION = 1000;
            let elapsed = 0;

            const tick = () => {
                elapsed += TICK;
                if (elapsed >= SCRAMBLE_DURATION) {
                    setPhase('defeat');
                    setChars(plainChars(DEFEAT));
                    return;
                }
                setChars(scrambledChars(DEFEAT));
                add(tick, TICK);
            };

            add(tick, TICK);
        }, 2500);

        return () => {
            timersRef.current.forEach(clearTimeout);
            timersRef.current = [];
        };
    }, []);

    if (phase === 'victory') {
        return <span className="text-success">{VICTORY}</span>;
    }
    if (phase === 'defeat') {
        return <span className="text-danger">{DEFEAT}</span>;
    }
    // scrambling
    return <ScrambledSpan chars={chars} colorClass="text-danger" />;
}

// ---------------------------------------------------------------------------
// Variant 1: DEFEAT always; random brief VICTORY flashes
// ---------------------------------------------------------------------------
function Variant1() {
    // phase: 'defeat' | 'flashing'
    const [phase, setPhase] = useState('defeat');
    const [chars, setChars] = useState(() => plainChars(DEFEAT));
    const timersRef = useRef([]);

    useEffect(() => {
        function scheduleNextGlitch() {
            // Random interval between 8000–15000ms
            const delay = 8000 + Math.random() * 7000;
            const id = setTimeout(() => {
                // Show a 300ms scrambled flash of VICTORY
                setPhase('flashing');
                setChars(scrambledChars(VICTORY));

                const restoreId = setTimeout(() => {
                    setPhase('defeat');
                    setChars(plainChars(DEFEAT));
                    scheduleNextGlitch();
                }, 300);

                timersRef.current.push(restoreId);
            }, delay);

            timersRef.current.push(id);
        }

        scheduleNextGlitch();

        return () => {
            timersRef.current.forEach(clearTimeout);
            timersRef.current = [];
        };
    }, []);

    if (phase === 'defeat') {
        return <span className="text-danger">{DEFEAT}</span>;
    }
    return <ScrambledSpan chars={chars} colorClass="text-success" />;
}

// ---------------------------------------------------------------------------
// Variant 2: Alternating VICTORY/DEFEAT at decelerating intervals → DEFEAT
// ---------------------------------------------------------------------------
function Variant2() {
    // label: 'victory' | 'defeat'
    const [label, setLabel] = useState('victory');
    const [settled, setSettled] = useState(false);
    const [scramble, setScramble] = useState(false);
    const timersRef = useRef([]);

    useEffect(() => {
        const TOTAL = 2500;
        const INITIAL_INTERVAL = 100;
        const GROWTH = 1.3;
        let currentLabel = 'victory';
        let elapsed = 0;
        let interval = INITIAL_INTERVAL;

        function flip() {
            if (elapsed >= TOTAL) {
                setLabel('defeat');
                setScramble(false);
                setSettled(true);
                return;
            }

            currentLabel = currentLabel === 'victory' ? 'defeat' : 'victory';
            // Some flips show scrambled characters (every other)
            const shouldScramble = Math.random() > 0.4;
            setLabel(currentLabel);
            setScramble(shouldScramble);

            elapsed += interval;
            interval = Math.min(interval * GROWTH, TOTAL - elapsed + 1);

            const id = setTimeout(flip, interval);
            timersRef.current.push(id);
        }

        const id = setTimeout(flip, interval);
        timersRef.current.push(id);

        return () => {
            timersRef.current.forEach(clearTimeout);
            timersRef.current = [];
        };
    }, []);

    if (settled) {
        return <span className="text-danger">{DEFEAT}</span>;
    }

    const colorClass = label === 'victory' ? 'text-success' : 'text-danger';
    const text = label === 'victory' ? VICTORY : DEFEAT;

    if (scramble) {
        return <ScrambledSpan chars={scrambledChars(text)} colorClass={colorClass} />;
    }
    return <span className={colorClass}>{text}</span>;
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

/**
 * @param {{ variant: 0 | 1 | 2 }} props
 */
export default function OutcomeReveal({ variant }) {
    // Reduced-motion: skip all animations, show DEFEAT immediately
    const prefersReduced =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
        return <span className="text-danger">{DEFEAT}</span>;
    }

    if (variant === 0) return <Variant0 />;
    if (variant === 1) return <Variant1 />;
    if (variant === 2) return <Variant2 />;

    // Fallback
    return <span className="text-danger">{DEFEAT}</span>;
}
