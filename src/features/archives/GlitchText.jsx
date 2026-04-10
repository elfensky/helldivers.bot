'use client';

import { useState, useEffect, useRef } from 'react';

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const TICK_MS = 50;

function randomChar() {
    return CHARSET[Math.floor(Math.random() * CHARSET.length)];
}

function buildChars(text) {
    return text.split('').map((char) => ({
        real: char,
        display: char === ' ' ? ' ' : randomChar(),
        settled: char === ' ',
    }));
}

/**
 * GlitchText — letter-scramble animation (slot machine / hacker decode)
 *
 * Usage:
 *   <GlitchText text="OPERATION MELTDOWN" duration={1200} delay={200} />
 *   <GlitchText text="STATUS: DEFEATED" active={false} className="text-danger" />
 */
export default function GlitchText({
    text,
    delay = 0,
    duration = 1000,
    active = true,
    className,
}) {
    const [chars, setChars] = useState(() => buildChars(text));
    const intervalRef = useRef(null);
    const timeoutsRef = useRef([]);

    useEffect(() => {
        // Rebuild chars if text changes while inactive
        if (!active) {
            setChars(
                text.split('').map((char) => ({
                    real: char,
                    display: char,
                    settled: true,
                })),
            );
            return;
        }

        const reducedMotion =
            typeof window !== 'undefined' &&
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (reducedMotion) {
            setChars(
                text.split('').map((char) => ({
                    real: char,
                    display: char,
                    settled: true,
                })),
            );
            return;
        }

        // Reset to scrambling state
        setChars(buildChars(text));

        // Schedule per-character settle timeouts
        text.split('').forEach((char, i) => {
            if (char === ' ') return;
            const settleAt = delay + (i / text.length) * duration;
            const t = setTimeout(() => {
                setChars((prev) =>
                    prev.map((c, idx) =>
                        idx === i ? { ...c, settled: true, display: c.real } : c,
                    ),
                );
            }, settleAt);
            timeoutsRef.current.push(t);
        });

        // Start scramble ticker after delay
        const startT = setTimeout(() => {
            intervalRef.current = setInterval(() => {
                setChars((prev) => {
                    const allSettled = prev.every((c) => c.settled);
                    if (allSettled) {
                        clearInterval(intervalRef.current);
                        intervalRef.current = null;
                        return prev;
                    }
                    return prev.map((c) =>
                        c.settled || c.real === ' '
                            ? c
                            : { ...c, display: randomChar() },
                    );
                });
            }, TICK_MS);
        }, delay);

        timeoutsRef.current.push(startT);

        return () => {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
            timeoutsRef.current.forEach(clearTimeout);
            timeoutsRef.current = [];
        };
    }, [text, delay, duration, active]);

    return (
        <span className={className}>
            {chars.map((char, i) =>
                char.settled ? (
                    char.real
                ) : (
                    <span key={i} className="glitch-char">
                        {char.display}
                    </span>
                ),
            )}
        </span>
    );
}
